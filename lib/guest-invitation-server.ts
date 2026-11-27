import 'server-only';
import { and, eq, inArray, ne, or } from 'drizzle-orm';
import { getDb } from '../db';
import { events, guestInvitations, guests, guestTables, menuItems } from '../db/schema';
import { invitationDates, type GuestInvitationData } from './guest-invitation';
import { readProgram } from './event-program-server';
import { readLiveProgram } from './live-program-server';

export const isGuestInvitationToken = (token: unknown): token is string =>
  typeof token === 'string' && /^[a-z0-9_-]{43}$/i.test(token);

export function hasGuestInvitation(eventId: number, guestId: number) {
  return Boolean(getDb().select({ token: guestInvitations.token }).from(guestInvitations)
    .where(and(eq(guestInvitations.eventId, eventId),
      or(eq(guestInvitations.guestId, guestId), eq(guestInvitations.companionId, guestId)))).get());
}

function findInvite(token: string) {
  if (!isGuestInvitationToken(token)) return undefined;
  return getDb().select().from(guestInvitations).where(eq(guestInvitations.token, token)).get() as
    typeof guestInvitations.$inferSelect | undefined;
}

export async function readGuestInvitation(token: string): Promise<GuestInvitationData | null> {
  const invite = findInvite(token);
  if (!invite) return null;
  const db = getDb();
  const event = db.select({
    slug: events.slug, title: events.title, hostName: events.hostName, venue: events.venue,
    coverTheme: events.coverTheme, eventDate: events.eventDate, photoAlbumUrl: events.photoAlbumUrl,
  }).from(events).where(eq(events.id, invite.eventId)).get();
  if (!event) return null;

  const ids = invite.companionId === null ? [invite.guestId] : [invite.guestId, invite.companionId];
  const found: { id: number; name: string; status: string; seat: number; tableName: string | null; tableNumber: number | null }[] =
    db.select({ id: guests.id, name: guests.name, status: guests.status, seat: guests.seat, tableName: guestTables.name, tableNumber: guestTables.id })
      .from(guests)
      .leftJoin(guestTables, and(eq(guestTables.id, guests.tableId), eq(guestTables.eventId, invite.eventId)))
      .where(and(eq(guests.eventId, invite.eventId), inArray(guests.id, ids))).all();
  if (found.length !== ids.length) return null;
  const dates = invitationDates(event.eventDate);
  const members = ids.map(id => {
    const member = found.find(row => row.id === id)!;
    return {
      name: member.name,
      status: member.status,
      seat: dates.dayOpen && member.status === 'presente' && member.tableName && member.tableNumber
        ? { tableName: member.tableName, tableNumber: member.tableNumber, number: member.seat }
        : null,
    };
  });

  const program = dates.dayOpen ? (await readProgram(invite.eventId, event.slug)).published : [];
  const menu = dates.dayOpen ? db.select({
    id: menuItems.id, name: menuItems.name, description: menuItems.description, category: menuItems.category, unit: menuItems.unit,
  }).from(menuItems).where(and(eq(menuItems.eventId, invite.eventId), eq(menuItems.available, true))).all() : [];

  return {
    title: event.title, hostName: event.hostName, venue: event.venue, coverTheme: event.coverTheme,
    eventSlug: dates.dayOpen ? event.slug : null,
    photoAlbumUrl: dates.dayOpen ? event.photoAlbumUrl : null,
    liveProgram: dates.dayOpen ? await readLiveProgram(invite.eventId, program) : null,
    ...dates, members, program, menu,
  };
}

export function updateInvitationResponse(token: string, memberIndex: number, status: 'confirmado' | 'recusado') {
  const db = getDb();
  return db.transaction(() => {
    const invite = findInvite(token);
    if (!invite) return false;
    const guestId = memberIndex === 0 ? invite.guestId : invite.companionId;
    if (!guestId) return false;
    return Boolean(db.update(guests).set({ status }).where(and(
      eq(guests.id, guestId), eq(guests.eventId, invite.eventId), ne(guests.status, 'presente'),
    )).returning({ id: guests.id }).get());
  }, { behavior: 'immediate' });
}
