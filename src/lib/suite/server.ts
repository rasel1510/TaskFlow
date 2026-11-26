/**
 * src/lib/suite/server.ts — server-side guard for every Software Company suite endpoint.
 *
 * `requireSuite(module)` answers, from the database (never from the session cookie alone):
 *   - who is asking, and which company is open right now
 *   - whether that company has the software suite switched on
 *   - the person's company role and department, and whether they may use `module`
 * It returns a ready-made 401 / 403 / 404 response otherwise, in the standard error envelope.
 */
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/access';
import {
  canUseModule,
  effectiveDepartment,
  isCompanyManager,
  type Department,
  type SuiteModule,
} from '@/lib/suite/departments';

export interface SuiteContext {
  userId: string;
  teamId: string;
  teamName: string;
  role: string;
  department: Department;
  isManager: boolean;
  isAdmin: boolean;
  settings: SuiteSettings;
}

export interface SuiteSettings {
  autoReviewOnPrOpen?: boolean;
  autoDoneOnPrMerge?: boolean;
  launchChecklistOnRelease?: boolean;
  projectOnDealWon?: boolean;
  notifyOnCallForSev1?: boolean;
}

export const DEFAULT_SETTINGS: Required<SuiteSettings> = {
  autoReviewOnPrOpen: true,
  autoDoneOnPrMerge: true,
  launchChecklistOnRelease: true,
  projectOnDealWon: true,
  notifyOnCallForSev1: true,
};

type Result<T> = { ok: true; value: T } | { ok: false; response: NextResponse };

export function fail(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export function ok<T>(data: T, meta?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ success: true, data, ...(meta ? { meta } : {}) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

/** Resolves the open company and checks the suite is on and `module` is allowed for this person. */
export async function requireSuite(module?: SuiteModule, opts: { adminOnly?: boolean } = {}): Promise<Result<SuiteContext>> {
  const access = await requireUser();
  if (!access.ok) return access;
  const user = access.value;

  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { teamId: true } });
  const teamId = me?.teamId;
  if (!teamId) return { ok: false, response: fail(404, 'NO_COMPANY', 'Open a company to use this feature.') };

  const [team, membership] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, kind: true, workspaceType: true, suiteSettings: true },
    }),
    prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId: user.id } },
      select: { role: true, department: true },
    }),
  ]);
  if (!team || team.kind !== 'company' || team.workspaceType !== 'software') {
    return { ok: false, response: fail(404, 'SUITE_OFF', 'The software company tools are not switched on for this company.') };
  }
  if (!membership && !user.isSuperAdmin) {
    return { ok: false, response: fail(403, 'FORBIDDEN', 'You are not a member of this company.') };
  }

  const role = user.isSuperAdmin ? 'Admin' : membership?.role || 'Member';
  const department = effectiveDepartment(membership?.department);
  const isAdmin = role.toLowerCase() === 'admin' || role.toLowerCase() === 'owner' || user.isSuperAdmin;
  if (opts.adminOnly && !isAdmin) {
    return { ok: false, response: fail(403, 'ADMIN_ONLY', 'Only company Admins can do this.') };
  }
  if (module && !canUseModule(module, department, role)) {
    return { ok: false, response: fail(403, 'NOT_YOUR_DEPARTMENT', 'This area is not available for your department.') };
  }

  return {
    ok: true,
    value: {
      userId: user.id,
      teamId,
      teamName: team.name,
      role,
      department,
      isManager: isCompanyManager(role),
      isAdmin,
      settings: { ...DEFAULT_SETTINGS, ...((team.suiteSettings as SuiteSettings | null) || {}) },
    },
  };
}

/** Records an important action (also drives live updates for suite screens). Never throws. */
export async function audit(ctx: { teamId: string; userId?: string | null }, action: string, target = '', meta?: Record<string, unknown>) {
  try {
    await prisma.auditLog.create({
      data: { teamId: ctx.teamId, actorId: ctx.userId ?? null, action, target: target.slice(0, 200), meta: (meta ?? undefined) as object | undefined },
    });
  } catch (err) {
    console.warn('[suite/audit] could not record', action, (err as Error)?.message);
  }
}

/* ─────────────────────────── encryption for connection tokens ─────────────────────────── */

/**
 * AES-256-GCM. The key comes from INTEGRATIONS_ENCRYPTION_KEY (32+ characters) when set, otherwise it
 * is derived from AUTH_SECRET with HKDF — so tokens are never stored in plain text, with no extra setup.
 */
function encryptionKey(): Buffer {
  const explicit = process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim();
  const base = explicit || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!base) throw new Error('No encryption secret configured (AUTH_SECRET)');
  return Buffer.from(crypto.hkdfSync('sha256', base, 'flowsync-integrations', 'token-encryption-v1', 32));
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.');
}

export function decryptSecret(sealed: string): string {
  const [v, iv, tag, data] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('Unknown secret format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

/** Constant-time comparison of two HMAC signatures. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
