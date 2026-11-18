import { cookies, headers } from 'next/headers';
import { getDb } from '../db';
import { events } from '../db/schema';
import { eq } from 'drizzle-orm';

const MASTER_EMAIL = 'emersontorres42@gmail.com';
const MASTER_PASSCODE = 'emerson2026';

export async function isEventAdmin(slug = 'emerson'): Promise<boolean> {
  // 1. Check ChatGPT / Sites header if present
  try {
    const reqHeaders = await headers();
    const email = reqHeaders.get('oai-authenticated-user-email');
    if (email && email.toLowerCase() === MASTER_EMAIL) {
      return true;
    }
  } catch {}

  // 2. Check cookies
  try {
    const cookieStore = await cookies();
    if (cookieStore.get('eventox_master')?.value === 'true') {
      return true;
    }
    const eventCookie = cookieStore.get(`eventox_admin_${slug}`)?.value;
    if (eventCookie === 'authenticated' || eventCookie === 'true') {
      return true;
    }
    // Also allow global dev cookie
    if (cookieStore.get('__sites_local_auth')?.value) {
      return true;
    }
  } catch {}

  // 3. In development / localhost, allow seamless management
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  return false;
}

export async function verifyEventPasscode(slug: string, passcode: string): Promise<boolean> {
  const cleanPasscode = passcode.trim();
  if (!cleanPasscode) return false;

  // Master passcode always works
  if (cleanPasscode === MASTER_PASSCODE) {
    return true;
  }

  try {
    const db = getDb();
    const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
    if (!event) return false;
    return event.passcode === cleanPasscode;
  } catch {
    return false;
  }
}
