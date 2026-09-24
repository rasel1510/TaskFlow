import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { findStoredUserByEmail, saveStoredUser } from '@/data/userStore';

interface VerificationRecord {
  email: string;
  code: string;
  expiresAt: string; // ISO string for JSON serialization
}

const OTPS_FILE = path.join(process.cwd(), 'src', 'data', 'otps.json');

// Global memory cache attached to globalThis to survive Next.js HMR reloads
const globalForOtp = globalThis as unknown as {
  __flowsyncOtpStore?: Map<string, VerificationRecord>;
};

if (!globalForOtp.__flowsyncOtpStore) {
  globalForOtp.__flowsyncOtpStore = new Map<string, VerificationRecord>();
}

const memoryOtpStore = globalForOtp.__flowsyncOtpStore;

// File persistence helpers
function loadOtpsFromFile(): Map<string, VerificationRecord> {
  try {
    if (fs.existsSync(OTPS_FILE)) {
      const raw = fs.readFileSync(OTPS_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((item: VerificationRecord) => {
          if (item?.email && item?.code) {
            memoryOtpStore.set(item.email.toLowerCase().trim(), item);
          }
        });
      }
    }
  } catch (err) {
    console.warn('[verification] Warning reading otps.json:', err);
  }
  return memoryOtpStore;
}

function saveOtpsToFile(): void {
  try {
    const dir = path.dirname(OTPS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const list = Array.from(memoryOtpStore.values());
    fs.writeFileSync(OTPS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[verification] Warning writing otps.json:', err);
  }
}

// Initial load
loadOtpsFromFile();

/**
 * Generate a cryptographically secure 6-digit numeric OTP
 */
export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Store a 6-digit OTP code for an email with an expiration window (default 10 minutes)
 */
export async function storeVerificationOtp(
  email: string,
  code: string,
  expiresInMinutes = 10
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  const record: VerificationRecord = {
    email: normalizedEmail,
    code: code.trim(),
    expiresAt: expiresAt.toISOString(),
  };

  // 1. Store in memory map
  memoryOtpStore.set(normalizedEmail, record);

  // 2. Persist to file
  saveOtpsToFile();

  // 3. Persist to database if available
  try {
    // Try raw query or Prisma client
    await prisma.$executeRawUnsafe(
      `DELETE FROM "VerificationCode" WHERE "email" = $1`,
      normalizedEmail
    ).catch(() => {});

    await prisma.$executeRawUnsafe(
      `INSERT INTO "VerificationCode" ("id", "email", "code", "expiresAt", "createdAt")
       VALUES ($1, $2, $3, $4, NOW())`,
      `otp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      normalizedEmail,
      code.trim(),
      expiresAt
    ).catch(() => {});
  } catch {
    // DB write non-critical since file and memory stores are persistent
  }
}

/**
 * Verify a 6-digit OTP code for an email.
 * If valid, marks the user's emailVerified date and invalidates the code.
 */
export async function verifyOtp(
  email: string,
  code: string
): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const trimmedCode = code.trim();

  // Refresh from file to be sure
  loadOtpsFromFile();

  let matchedRecord: VerificationRecord | null = null;

  // 1. Check persistent memory/file store
  const fileRecord = memoryOtpStore.get(normalizedEmail);
  if (fileRecord) {
    matchedRecord = fileRecord;
  }

  // 2. Check database
  if (!matchedRecord) {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ email: string; code: string; expiresAt: Date }>>(
        `SELECT "email", "code", "expiresAt" FROM "VerificationCode"
         WHERE "email" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
        normalizedEmail
      );

      if (rows && rows.length > 0) {
        matchedRecord = {
          email: rows[0].email,
          code: rows[0].code,
          expiresAt: new Date(rows[0].expiresAt).toISOString(),
        };
      }
    } catch {
      // DB check fallback
    }
  }

  if (!matchedRecord) {
    return {
      success: false,
      message: 'Invalid verification code. Please check your email or request a new code.',
    };
  }

  // Check code match
  if (matchedRecord.code !== trimmedCode) {
    return {
      success: false,
      message: 'Invalid verification code. Please check your email or request a new code.',
    };
  }

  // Check expiration
  if (new Date() > new Date(matchedRecord.expiresAt)) {
    memoryOtpStore.delete(normalizedEmail);
    saveOtpsToFile();
    return {
      success: false,
      message: 'This verification code has expired. Please request a new one.',
    };
  }

  // Valid! Clear the code
  memoryOtpStore.delete(normalizedEmail);
  saveOtpsToFile();

  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "VerificationCode" WHERE "email" = $1`,
      normalizedEmail
    ).catch(() => {});
  } catch {
    // Non-critical
  }

  // Mark user as verified in database
  const verifiedAt = new Date();
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "emailVerified" = $1 WHERE "email" = $2`,
      verifiedAt,
      normalizedEmail
    ).catch(() => {});
  } catch {
    // Non-critical
  }

  // Update in local userStore
  const localUser = findStoredUserByEmail(normalizedEmail);
  if (localUser) {
    saveStoredUser({
      ...localUser,
      emailVerified: verifiedAt.toISOString(),
    });
  }

  return {
    success: true,
    message: 'Email verified successfully! Workspace access granted.',
  };
}
