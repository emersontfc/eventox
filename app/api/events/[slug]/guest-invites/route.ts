import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '../../../../../db';
import { guests, guestInvitations, guestTables } from '../../../../../db/schema';
import { getEventMembershipContext } from '../../../../../lib/auth';
import { hasPermission } from '../../../../../lib/permissions';
import { isGuestInvitationToken } from '../../../../../lib/guest-invitation-server';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ slug: string }> };
const json = (data: object, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });

async function eventForOrganizer(context: Context) {
  const { slug } = await context.params;
  const access = await getEventMembershipContext(slug);
  return access && hasPermission(access.role, access.permissions, 'guests:invite') ? access.event : null;
}

export async function GET(_request: Request, context: Context) {
  const event = await eventForOrganizer(context);
  if (!event) return json({ error: 'Acesso reservado à organização.' }, 403);
  const db = getDb();
  const invitations = db.select().from(guestInvitations).where(eq(guestInvitations.eventId, event.id))
    .orderBy(desc(guestInvitations.createdAt)).all();
  const inviteGuests = db.select({
    id: guests.id, name: guests.name, tableName: guestTables.name,
  }).from(guests)
    .leftJoin(guestTables, and(eq(guestTables.id, guests.tableId), eq(guestTables.eventId, event.id)))
    .where(eq(guests.eventId, event.id)).orderBy(asc(guests.name)).all();
  return json({ invitations, guests: inviteGuests });
}

export async function POST(request: Request, context: Context) {
  const event = await eventForOrganizer(context);
  if (!event) return json({ error: 'Acesso reservado à organização.' }, 403);
  const body = await request.json().catch(() => null);
  const ids: number[] = body?.guestIds;
  if (!Array.isArray(ids) || ![1, 2].includes(ids.length) ||
      !ids.every(id => Number.isSafeInteger(id) && id > 0) || new Set(ids).size !== ids.length) {
    return json({ error: 'Seleciona um ou dois convidados diferentes.' }, 400);
  }

  const db = getDb();
  const result = db.transaction((tx: typeof db) => {
    const found = tx.select({ id: guests.id }).from(guests)
      .where(and(eq(guests.eventId, event.id), inArray(guests.id, ids))).all();
    if (found.length !== ids.length) return { error: 'Um dos convidados já não está na lista.', status: 404 };

    const related: (typeof guestInvitations.$inferSelect)[] = tx.select().from(guestInvitations).where(and(
      eq(guestInvitations.eventId, event.id),
      or(inArray(guestInvitations.guestId, ids), inArray(guestInvitations.companionId, ids)),
    )).all();
    const existing = related.find(row =>
      ids.includes(row.guestId) && (ids.length === 1 ? row.companionId === null : row.companionId !== null && ids.includes(row.companionId)));
    if (existing) return { invitation: existing };
    if (related.some(row => row.companionId !== null)) {
      return { error: 'Um dos convidados já tem um convite de casal. Revoga esse convite antes de o reagrupar.', status: 409 };
    }
    if (related.length && body.replaceSingles !== true) {
      return { error: 'Confirma a substituição dos links individuais para criar o convite de casal.', status: 409 };
    }
    if (related.length) {
      tx.delete(guestInvitations).where(and(eq(guestInvitations.eventId, event.id),
        inArray(guestInvitations.token, related.map(row => row.token)))).run();
    }
    const invitation = tx.insert(guestInvitations).values({
      token: randomBytes(32).toString('base64url'), eventId: event.id, guestId: ids[0],
      companionId: ids[1] ?? null, createdAt: new Date().toISOString(),
    }).returning().get();
    return { invitation };
  }, { behavior: 'immediate' });
  return 'error' in result ? json({ error: result.error }, result.status) : json(result);
}

export async function DELETE(request: Request, context: Context) {
  const event = await eventForOrganizer(context);
  if (!event) return json({ error: 'Acesso reservado à organização.' }, 403);
  const body = await request.json().catch(() => null);
  if (!isGuestInvitationToken(body?.token)) return json({ error: 'Convite inválido.' }, 400);
  getDb().delete(guestInvitations).where(and(
    eq(guestInvitations.eventId, event.id), eq(guestInvitations.token, body.token),
  )).run();
  return json({ ok: true });
}
