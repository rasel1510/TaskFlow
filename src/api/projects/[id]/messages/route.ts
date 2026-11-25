/**
 * src/api/projects/[id]/messages/route.ts
 *
 * Project team chat, persisted in Postgres (ProjectMessage) so messages survive restarts and are
 * shared by every server instance. Live delivery uses the SSE broker when sender and reader share
 * an instance; clients also poll, so delivery never depends on that.
 *
 *   GET    /api/projects/:id/messages                 — latest 200 messages (oldest first)
 *   POST   /api/projects/:id/messages                 — send text and/or an image
 *   PATCH  /api/projects/:id/messages                 — toggle an emoji reaction
 *   DELETE /api/projects/:id/messages?messageId=...   — delete (author or project manager)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireProjectAccess, canManageProject } from '@/lib/access';
import { projectStreamBroker } from '@/lib/projectStreamBroker';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export interface ProjectMessage {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar: string;
  userRole?: string;
  content: string;
  imageUrl?: string | null;
  imageName?: string | null;
  imageSize?: number | null;
  createdAt: string;
  reactions?: Record<string, string[]>; // emoji -> array of userIds
}

const MESSAGE_PAGE = 200;
const MAX_CONTENT = 5000;
/** ~2 MB image as a base64 data URL (Vercel rejects request bodies over 4.5 MB) */
const MAX_IMAGE_URL_LENGTH = 2_900_000;

const messageSelect = {
  id: true,
  projectId: true,
  userId: true,
  content: true,
  imageUrl: true,
  imageName: true,
  imageSize: true,
  reactions: true,
  createdAt: true,
  user: { select: { name: true, email: true, avatar: true, role: true } },
} as const;

type MessageRow = {
  id: string;
  projectId: string;
  userId: string;
  content: string;
  imageUrl: string | null;
  imageName: string | null;
  imageSize: number | null;
  reactions: unknown;
  createdAt: Date;
  user: { name: string; email: string; avatar: string; role: string } | null;
};

function toDto(row: MessageRow): ProjectMessage {
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    userName: row.user?.name || 'User',
    userEmail: row.user?.email || '',
    userAvatar: row.user?.avatar || (row.user?.name ? row.user.name.slice(0, 2).toUpperCase() : 'U'),
    userRole: row.user?.role || 'Member',
    content: row.content,
    imageUrl: row.imageUrl,
    imageName: row.imageName,
    imageSize: row.imageSize,
    createdAt: row.createdAt.toISOString(),
    reactions: (row.reactions as Record<string, string[]> | null) ?? {},
  };
}

const fail = (status: number, message: string) =>
  NextResponse.json({ success: false, error: message }, { status });

/**
 * Accept only uploaded image data (data:image/...), within the size limit. Links to outside
 * images are refused so a message can't make every reader's browser call a third-party server.
 */
function validImageUrl(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  if (value.length > MAX_IMAGE_URL_LENGTH) return undefined;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value)) return value;
  return undefined;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;

    const rows = await prisma.projectMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: MESSAGE_PAGE,
      select: messageSelect,
    });
    const messages = rows.reverse().map(toDto);
    return NextResponse.json({ success: true, data: messages, meta: { total: messages.length } });
  } catch (error) {
    console.error('[GET /api/projects/:id/messages] Error:', error);
    return fail(500, 'Failed to retrieve messages');
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return fail(400, 'Invalid JSON payload');
    }

    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const imageUrl = validImageUrl(body.imageUrl);
    if (imageUrl === undefined) return fail(400, 'Images must be PNG, JPG, GIF or WebP and under 2 MB.');
    if (!content && !imageUrl) return fail(400, 'Message must include text content or an image attachment.');
    if (content.length > MAX_CONTENT) return fail(400, `Messages must be ${MAX_CONTENT} characters or fewer.`);

    const row = await prisma.projectMessage.create({
      data: {
        projectId,
        userId: access.value.user.id,
        content,
        imageUrl,
        imageName: imageUrl ? (typeof body.imageName === 'string' ? body.imageName.slice(0, 200) : 'image.png') : null,
        imageSize: imageUrl && typeof body.imageSize === 'number' ? Math.round(body.imageSize) : null,
      },
      select: messageSelect,
    });

    const message = toDto(row);
    projectStreamBroker.publish(projectId, 'message:created', message);
    return NextResponse.json({ success: true, data: message }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/projects/:id/messages] Error:', error);
    return fail(500, 'Failed to send message');
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const uid = access.value.user.id;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return fail(400, 'Invalid JSON payload');
    }
    const messageId = typeof body.messageId === 'string' ? body.messageId : '';
    const emoji = typeof body.emoji === 'string' ? body.emoji.slice(0, 16) : '';
    if (!messageId || !emoji) return fail(400, 'messageId and emoji are required');

    // Read-modify-write in a transaction so concurrent reactions on the same message don't clobber
    const row = await prisma.$transaction(async tx => {
      const existing = await tx.projectMessage.findFirst({
        where: { id: messageId, projectId },
        select: { reactions: true },
      });
      if (!existing) return null;
      const reactions = { ...((existing.reactions as Record<string, string[]> | null) ?? {}) };
      const users = reactions[emoji] ?? [];
      if (users.includes(uid)) {
        const remaining = users.filter(id => id !== uid);
        if (remaining.length) reactions[emoji] = remaining;
        else delete reactions[emoji];
      } else {
        reactions[emoji] = [...users, uid];
      }
      return tx.projectMessage.update({ where: { id: messageId }, data: { reactions }, select: messageSelect });
    });
    if (!row) return fail(404, 'Message not found');

    const message = toDto(row);
    projectStreamBroker.publish(projectId, 'message:updated', message);
    return NextResponse.json({ success: true, data: message });
  } catch (error) {
    console.error('[PATCH /api/projects/:id/messages] Error:', error);
    return fail(500, 'Failed to update reaction');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;

    const messageId = new URL(request.url).searchParams.get('messageId');
    if (!messageId) return fail(400, 'messageId query parameter is required');

    const existing = await prisma.projectMessage.findFirst({
      where: { id: messageId, projectId },
      select: { userId: true },
    });
    if (!existing) return fail(404, 'Message not found');

    const isAuthor = existing.userId === access.value.user.id;
    if (!isAuthor && !canManageProject(access.value)) {
      return fail(403, 'You can only delete your own messages.');
    }

    await prisma.projectMessage.delete({ where: { id: messageId } });
    projectStreamBroker.publish(projectId, 'message:deleted', { id: messageId });
    return NextResponse.json({ success: true, data: { id: messageId } });
  } catch (error) {
    console.error('[DELETE /api/projects/:id/messages] Error:', error);
    return fail(500, 'Failed to delete message');
  }
}
