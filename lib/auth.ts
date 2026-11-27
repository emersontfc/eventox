import { cookies } from 'next/headers';
import { getDb } from '../db';
import { events, users, eventMemberships, auditLogs } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import type { NextResponse } from 'next/server';
import { hasPermission } from './permissions';

// Fallback session secret - constant key ensures server reloads don't invalidate active sessions
const DEFAULT_SESSION_SECRET = 'eventox_super_secure_production_secret_2026_kazix_key_live_55a9aa80';
export function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  return DEFAULT_SESSION_SECRET;
}

export interface SessionData {
  eventId: number;
  slug: string;
  exp: number; // Unix timestamp in seconds
}

export interface UserAuthTokenData {
  userId: number;
  email: string;
  globalRole: string;
  name: string;
  exp: number;
}

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  avatarUrl: string | null;
  phone: string | null;
  globalRole: string;
  isActive: boolean;
}

export interface EventMembershipContext {
  user: CurrentUser;
  event: typeof events.$inferSelect;
  role: string;
  permissions: string[];
  status: string;
  authenticatedByPasscode?: true;
}

// ============================================================================
// 1. Password & Passcode Hashing (scrypt with cryptographically random salt)
// ============================================================================

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password.trim(), salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const clean = password.trim();
  if (!clean || !storedHash) return false;

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

  // Legacy fallback (constant-time)
  const bufA = Buffer.from(clean, 'utf-8');
  const bufB = Buffer.from(storedHash, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Aliases for backward compatibility
export const hashPasscode = hashPassword;
export const verifyPasscode = verifyPassword;

// ============================================================================
// 2. Cryptographically Signed Session Tokens (HMAC-SHA256)
// ============================================================================

export function signToken<T>(data: T): string {
  const payloadStr = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadStr)
    .digest('base64url');
  return `${payloadStr}.${signature}`;
}

export function verifyToken<T>(token: string): T | null {
  if (!token || typeof token !== 'string') return null;
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const payloadStr = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  const expectedSignature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadStr)
    .digest('base64url');

  if (Buffer.byteLength(signature) !== Buffer.byteLength(expectedSignature)) {
    return null;
  }

  try {
    const isSigValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'utf-8'),
      Buffer.from(expectedSignature, 'utf-8')
    );
    if (!isSigValid) return null;

    const json = Buffer.from(payloadStr, 'base64url').toString('utf-8');
    const data = JSON.parse(json) as T & { exp?: number };

    // Check expiration if present
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export function signSessionToken(data: SessionData): string {
  return signToken<SessionData>(data);
}

export function parseAndVerifySessionToken(token: string, expectedSlug: string): SessionData | null {
  const data = verifyToken<SessionData>(token);
  if (!data) return null;
  if (data.slug.toLowerCase() !== expectedSlug.toLowerCase()) return null;
  return data;
}

// ============================================================================
// 3. User Authentication Cookie Management
// ============================================================================

const AUTH_COOKIE_NAME = 'eventox_auth_token';

export function createAuthToken(user: { id: number; email: string; globalRole: string; name: string }): string {
  const maxAge = 60 * 60 * 24 * 14; // 14 days
  const exp = Math.floor(Date.now() / 1000) + maxAge;
  return signToken<UserAuthTokenData>({
    userId: user.id,
    email: user.email,
    globalRole: user.globalRole,
    name: user.name,
    exp,
  });
}

export function setAuthCookie(
  response: NextResponse,
  user: { id: number; email: string; globalRole: string; name: string }
) {
  const token = createAuthToken(user);
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 14,
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;

    const data = verifyToken<UserAuthTokenData>(token);
    if (!data?.userId) return null;

    const db = getDb();
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        phone: users.phone,
        globalRole: users.globalRole,
        isActive: users.isActive,
      })
      .from(users)
      .where(and(eq(users.id, data.userId), eq(users.isActive, true)))
      .limit(1);

    return user || null;
  } catch {
    return null;
  }
}

// ============================================================================
// 4. Multi-Tenant Event Authorization & Role Checking
// ============================================================================

export async function getEventMembershipContext(
  slugOrId: string | number,
  currentUser?: CurrentUser | null
): Promise<EventMembershipContext | null> {
  const user = currentUser !== undefined ? currentUser : await getCurrentUser();

  try {
    const db = getDb();
    let eventRow: typeof events.$inferSelect | undefined;

    if (typeof slugOrId === 'number') {
      [eventRow] = await db.select().from(events).where(eq(events.id, slugOrId)).limit(1);
    } else {
      [eventRow] = await db.select().from(events).where(eq(events.slug, slugOrId.toLowerCase().trim())).limit(1);
    }

    if (!eventRow) return null;

    // 1. Authenticated user account with RBAC
    if (user) {
      // Global admin has full owner access to any event
      if (user.globalRole === 'admin') {
        return {
          user,
          event: eventRow,
          role: 'proprietario',
          permissions: ['*'],
          status: 'ativo',
        };
      }

      // Direct event owner
      if (eventRow.ownerId === user.id) {
        return {
          user,
          event: eventRow,
          role: 'proprietario',
          permissions: ['*'],
          status: 'ativo',
        };
      }

      // Check membership table
      const [membership] = await db
        .select()
        .from(eventMemberships)
        .where(and(eq(eventMemberships.userId, user.id), eq(eventMemberships.eventId, eventRow.id)))
        .limit(1);

      if (membership && membership.status === 'ativo') {
        let perms: string[] = [];
        try {
          perms = JSON.parse(membership.permissions || '[]');
        } catch {
          perms = [];
        }

        return {
          user,
          event: eventRow,
          role: membership.role,
          permissions: perms,
          status: membership.status,
        };
      }
    }

    // 2. Authenticated event admin via verified passcode session cookie
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get(`eventox_session_${eventRow.slug}`)?.value;
      if (token) {
        const session = parseAndVerifySessionToken(token, eventRow.slug);
        if (session && session.slug.toLowerCase() === eventRow.slug.toLowerCase()) {
          return {
            user: {
              id: eventRow.ownerId || 1,
              email: 'admin@eventox.local',
              name: eventRow.hostName || 'Administrador do Evento',
              avatarUrl: null,
              phone: null,
              globalRole: 'admin',
              isActive: true,
            },
            event: eventRow,
            role: 'proprietario',
            permissions: ['*'],
            status: 'ativo',
            authenticatedByPasscode: true,
          };
        }
      }
    } catch {
      // ignore cookie error
    }

    return null;
  } catch {
    return null;
  }
}

export async function isEventAdmin(slug = 'emerson', requiredPermission?: string): Promise<boolean> {
  const cleanSlug = slug.toLowerCase().trim();

  // 1. Check logged-in user membership with RBAC
  const context = await getEventMembershipContext(cleanSlug);
  if (context) {
    if (!requiredPermission) return true;
    return hasPermission(context.role, context.permissions, requiredPermission);
  }

  // 2. Legacy event passcode session check
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

// ============================================================================
// 5. Passcode Verification with Automatic Transparent Hash Upgrade
// ============================================================================

export async function verifyEventPasscode(slug: string, passcode: string): Promise<boolean> {
  const cleanPasscode = passcode.trim();
  const cleanSlug = slug.toLowerCase().trim();
  if (!cleanPasscode) return false;

  try {
    const db = getDb();
    const [event] = await db.select().from(events).where(eq(events.slug, cleanSlug)).limit(1);
    if (!event || !event.passcode) return false;

    const isValid = verifyPassword(cleanPasscode, event.passcode);
    if (!isValid) return false;

    // Upgrade legacy plain-text passcode to scrypt hash in the database
    if (!event.passcode.startsWith('scrypt:')) {
      const secureHash = hashPassword(cleanPasscode);
      await db.update(events).set({ passcode: secureHash }).where(eq(events.id, event.id));
    }

    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// 6. Legacy Session Cookie Helpers for Passcodes
// ============================================================================

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

// ============================================================================
// 7. Audit Logging Helper
// ============================================================================

export async function logAuditAction(params: {
  eventId?: number | null;
  userId?: number | null;
  userName?: string | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  details?: Record<string, unknown> | string | null;
  ipAddress?: string | null;
}) {
  try {
    const db = getDb();
    const detailsStr =
      typeof params.details === 'object' && params.details !== null
        ? JSON.stringify(params.details)
        : params.details || null;

    await db.insert(auditLogs).values({
      eventId: params.eventId || null,
      userId: params.userId || null,
      userName: params.userName || null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ? String(params.entityId) : null,
      details: detailsStr,
      ipAddress: params.ipAddress || null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Audit Log Warning]:', err);
  }
}
