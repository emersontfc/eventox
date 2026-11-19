import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth';
import { getDb } from '../../../../db';
import { events, eventMemberships } from '../../../../db/schema';
import { eq, or } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null, events: [] });
  }

  const db = getDb();
  let userEvents: Array<{
    id: number;
    slug: string;
    title: string;
    hostName: string;
    eventDate: string;
    venue: string;
    role: string;
    permissions: string[];
  }> = [];

  if (user.globalRole === 'admin') {
    const all = await db.select().from(events);
    userEvents = all.map((e: any) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      hostName: e.hostName,
      eventDate: e.eventDate,
      venue: e.venue,
      role: 'proprietario',
      permissions: ['*'],
    }));
  } else {
    const owned = await db.select().from(events).where(eq(events.ownerId, user.id));
    const memberships = await db
      .select({
        eventId: eventMemberships.eventId,
        role: eventMemberships.role,
        permissions: eventMemberships.permissions,
      })
      .from(eventMemberships)
      .where(eq(eventMemberships.userId, user.id));

    const memberEventIds = memberships.map((m: any) => m.eventId);
    const memberEvents = memberEventIds.length > 0
      ? await db.select().from(events).where(or(...memberEventIds.map((id: any) => eq(events.id, id))))
      : [];

    const memberMap = new Map(memberships.map((m: any) => [m.eventId, m]));

    const combined = new Map<number, typeof userEvents[0]>();
    for (const e of owned) {
      combined.set(e.id, {
        id: e.id,
        slug: e.slug,
        title: e.title,
        hostName: e.hostName,
        eventDate: e.eventDate,
        venue: e.venue,
        role: 'proprietario',
        permissions: ['*'],
      });
    }

    for (const e of memberEvents) {
      if (!combined.has(e.id)) {
        const mem: any = memberMap.get(e.id);
        let perms: string[] = [];
        try {
          perms = JSON.parse(mem?.permissions || '[]');
        } catch {
          perms = [];
        }
        combined.set(e.id, {
          id: e.id,
          slug: e.slug,
          title: e.title,
          hostName: e.hostName,
          eventDate: e.eventDate,
          venue: e.venue,
          role: mem?.role || 'coorganizador',
          permissions: perms,
        });
      }
    }

    userEvents = Array.from(combined.values());
  }

  return NextResponse.json({
    authenticated: true,
    user,
    events: userEvents,
  });
}
