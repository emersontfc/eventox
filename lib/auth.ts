import { cookies } from 'next/headers';
import { getDb } from '../db';
import { events } from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import type { NextResponse } from 'next/server';

// Fallback session secret generated securely if not provided in environment
let _fallbackSecret: string | null = null;
function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  if (!_fallbackSecret) {
    _fallbackSecret = crypto.randomBytes(32).toString('hex');
    if (process.env.NODE_ENV === 'production') {
      console.warn('[SEGURANÇA] SESSION_SECRET não definida no ambiente. Usando segredo volátil.');
    }
  }
  return _fallbackSecret;
}

export interface SessionData {
  eventId: number;
  slug: string;
  exp: number; // Unix timestamp in seconds
}

// 1. Password Hashing (scrypt with salt)
export function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode.trim(), salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPasscode(passcode: string, storedHash: string): boolean {
  const clean = passcode.trim();
  if (!clean || !storedHash) return false;

  // Stored with scrypt format: scrypt:salt:hash
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const [, salt, expectedHash] = parts;
    const derived = crypto.scryptSync(clean, salt, 64).toString('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(derived, 'utf-8'), Buffer.from(expectedHash, 'utf-8'));
    } catch {
      return false;
    }
  }

  // Legacy plain-text fallback for backward compatibility:
  // Constant-time check to prevent timing attacks
  const bufA = Buffer.from(clean, 'utf-8');
  const bufB = Buffer.from(storedHash, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// 2. Cryptographically Signed Session Token (HMAC-SHA256)
export function signSessionToken(data: SessionData): string {
  const payloadStr = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadStr)
    .digest('base64url');
  return `${payloadStr}.${signature}`;
}

export function parseAndVerifySessionToken(token: string, expectedSlug: string): SessionData | null {
  if (!token || typeof token !== 'string') return null;
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const payloadStr = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  const expectedSignature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadStr)
    .digest('base64url');

  try {
    const isSigValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'utf-8'),
      Buffer.from(expectedSignature, 'utf-8')
    );
    if (!isSigValid) return null;

    const json = Buffer.from(payloadStr, 'base64url').toString('utf-8');
    const data = JSON.parse(json) as SessionData;

    // Check expiration (exp in seconds)
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    // Check slug match
    if (data.slug.toLowerCase() !== expectedSlug.toLowerCase()) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

// 3. Server-side Authorization Check
export async function isEventAdmin(slug = 'emerson'): Promise<boolean> {
  const cleanSlug = slug.toLowerCase().trim();
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(`eventox_session_${cleanSlug}`)?.value;
    if (!token) return false;

    const session = parseAndVerifySessionToken(token, cleanSlug);
    return Boolean(session && session.slug.toLowerCase() === cleanSlug);
  } catch {
    return false;
  }
}

// 4. Passcode Verification with Automatic Transparent Hash Upgrade
export async function verifyEventPasscode(slug: string, passcode: string): Promise<boolean> {
  const cleanPasscode = passcode.trim();
  const cleanSlug = slug.toLowerCase().trim();
  if (!cleanPasscode) return false;

  try {
    const db = getDb();
    const [event] = await db.select().from(events).where(eq(events.slug, cleanSlug)).limit(1);
    if (!event || !event.passcode) return false;

    const isValid = verifyPasscode(cleanPasscode, event.passcode);
    if (!isValid) return false;

    // Upgrade legacy plain-text passcode to scrypt hash in the database
    if (!event.passcode.startsWith('scrypt:')) {
      const secureHash = hashPasscode(cleanPasscode);
      await db.update(events).set({ passcode: secureHash }).where(eq(events.id, event.id));
    }

    return true;
  } catch {
    return false;
  }
}

// 5. Session Cookie Helpers for Route Handlers
export function setSessionCookie(response: NextResponse, slug: string, eventId: number) {
  const cleanSlug = slug.toLowerCase().trim();
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  const exp = Math.floor(Date.now() / 1000) + maxAge;

  const token = signSessionToken({
    eventId,
    slug: cleanSlug,
    exp,
  });

  response.cookies.set(`eventox_session_${cleanSlug}`, token, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
  });
}

export function clearSessionCookie(response: NextResponse, slug: string) {
  const cleanSlug = slug.toLowerCase().trim();
  response.cookies.set(`eventox_session_${cleanSlug}`, '', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
  });
}
