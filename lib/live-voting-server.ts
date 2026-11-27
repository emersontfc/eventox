import 'server-only';
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { getDb } from '../db';
import { guestInvitations, guests, screenSettings } from '../db/schema';
import { isGuestInvitationToken } from './guest-invitation-server';
import type { GuestPoll, LivePoll, LivePollStatus, PollCommand } from './live-voting';

const polls = sqliteTable('live_polls', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull(),
  title: text('title').notNull(),
  status: text('status').$type<LivePollStatus>().notNull().default('draft'),
  active: integer('active', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

const pollOptions = sqliteTable('live_poll_options', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pollId: integer('poll_id').notNull(),
  label: text('label').notNull(),
  position: integer('position').notNull(),
});

const pollVotes = sqliteTable('live_poll_votes', {
  pollId: integer('poll_id').notNull(),
  optionId: integer('option_id').notNull(),
  guestId: integer('guest_id').notNull(),
  votedAt: text('voted_at').notNull(),
}, table => [
  primaryKey({ columns: [table.pollId, table.guestId] }),
]);

type PollRow = typeof polls.$inferSelect;
type OptionRow = typeof pollOptions.$inferSelect;
type EligibleVoter = { member: number; id: number; name: string };

export class PollError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function activePoll(db: ReturnType<typeof getDb>, eventId: number): PollRow | undefined {
  return db.select().from(polls)
    .where(and(eq(polls.eventId, eventId), eq(polls.active, true))).get();
}

function optionsFor(db: ReturnType<typeof getDb>, pollId: number): OptionRow[] {
  return db.select().from(pollOptions).where(eq(pollOptions.pollId, pollId))
    .orderBy(asc(pollOptions.position)).all();
}

function toView(db: ReturnType<typeof getDb>, poll: PollRow, includeVotes: boolean): LivePoll {
  const options = optionsFor(db, poll.id);
  const totals = new Map<number, number>();
  if (includeVotes) {
    const rows: { optionId: number; quantity: number }[] = db.select({
      optionId: pollVotes.optionId, quantity: count(),
    }).from(pollVotes).where(eq(pollVotes.pollId, poll.id)).groupBy(pollVotes.optionId).all();
    for (const row of rows) totals.set(row.optionId, row.quantity);
  }

  return {
    id: poll.id, title: poll.title, status: poll.status, active: poll.active,
    options: options.map(option => ({
      id: option.id, label: option.label, votes: includeVotes ? totals.get(option.id) ?? 0 : null,
    })),
    totalVotes: includeVotes ? [...totals.values()].reduce((sum, value) => sum + value, 0) : null,
  };
}

export function getPublicLivePoll(eventId: number): LivePoll | null {
  const db = getDb();
  const poll = activePoll(db, eventId);
  return poll ? toView(db, poll, poll.status === 'revealed') : null;
}

export function getManagedLivePolls(eventId: number): LivePoll[] {
  const db = getDb();
  const rows: PollRow[] = db.select().from(polls).where(eq(polls.eventId, eventId))
    .orderBy(desc(polls.active), desc(polls.id)).all();
  return rows.map(row => toView(db, row, true));
}

function invitationVoters(db: ReturnType<typeof getDb>, eventId: number, token: unknown): EligibleVoter[] {
  if (!isGuestInvitationToken(token)) return [];
  const invitation: typeof guestInvitations.$inferSelect | undefined = db.select().from(guestInvitations)
    .where(and(eq(guestInvitations.eventId, eventId), eq(guestInvitations.token, token))).get();
  if (!invitation) return [];
  const ids = invitation.companionId === null ? [invitation.guestId] : [invitation.guestId, invitation.companionId];
  const members: { id: number; name: string }[] = db.select({ id: guests.id, name: guests.name })
    .from(guests).where(and(eq(guests.eventId, eventId), inArray(guests.id, ids))).all();
  return ids.flatMap((id, member) => {
    const match = members.find(person => person.id === id);
    return match ? [{ ...match, member }] : [];
  });
}

export function getGuestPoll(eventId: number, token: unknown): GuestPoll {
  const db = getDb();
  const poll = activePoll(db, eventId);
  if (!poll) return { poll: null, voters: [] };

  const eligible = invitationVoters(db, eventId, token);
  const votesByGuest = new Map<number, number>();
  if (eligible.length) {
    const responses: { guestId: number; optionId: number }[] = db.select({
      guestId: pollVotes.guestId, optionId: pollVotes.optionId,
    }).from(pollVotes).where(and(eq(pollVotes.pollId, poll.id),
      inArray(pollVotes.guestId, eligible.map(voter => voter.id)),
    )).all();
    for (const response of responses) votesByGuest.set(response.guestId, response.optionId);
  }

  return {
    poll: toView(db, poll, poll.status === 'revealed'),
    voters: eligible.map(voter => ({ member: voter.member, name: voter.name, optionId: votesByGuest.get(voter.id) ?? null })),
  };
}

function bumpScreen(db: ReturnType<typeof getDb>, eventId: number, project = false) {
  const now = new Date().toISOString();
  db.insert(screenSettings).values({
    eventId, updatedAt: now, ...(project ? { activeSceneId: 'poll', sceneStartedAt: now } : {}),
  }).onConflictDoUpdate({
    target: screenSettings.eventId,
    set: {
      version: sql`${screenSettings.version} + 1`,
      updatedAt: now,
      ...(project ? { activeSceneId: 'poll', sceneStartedAt: now, isPaused: false, holdScene: false } : {}),
    },
  }).run();
}

export function createLivePoll(eventId: number, title: string, labels: string[]) {
  const db = getDb();
  db.transaction(() => {
    const row = db.insert(polls).values({ eventId, title, createdAt: new Date().toISOString() })
      .returning({ id: polls.id }).get();
    db.insert(pollOptions).values(labels.map((label, position) => ({ pollId: row.id, label, position }))).run();
  }, { behavior: 'immediate' });
}

export function manageLivePoll(eventId: number, id: number, command: PollCommand) {
  const db = getDb();
  db.transaction(() => {
    const row: PollRow | undefined = db.select().from(polls)
      .where(and(eq(polls.eventId, eventId), eq(polls.id, id))).get();
    if (!row) throw new PollError(404, 'Votação não encontrada.');
    const current = activePoll(db, eventId);

    switch (command) {
      case 'open':
        if (row.status !== 'draft') throw new PollError(409, 'Só podes abrir uma votação em rascunho.');
        if (current?.status === 'open') throw new PollError(409, 'Encerra a votação atual antes de abrir outra.');
        db.update(polls).set({ active: false }).where(and(eq(polls.eventId, eventId), eq(polls.active, true))).run();
        db.update(polls).set({ status: 'open', active: true }).where(eq(polls.id, id)).run();
        break;
      case 'close':
        if (!row.active || row.status !== 'open') throw new PollError(409, 'A votação já não está aberta.');
        db.update(polls).set({ status: 'closed' }).where(eq(polls.id, id)).run();
        break;
      case 'reveal':
        if (!row.active || row.status !== 'closed') throw new PollError(409, 'Encerra a votação ativa antes de publicar os resultados.');
        db.update(polls).set({ status: 'revealed' }).where(eq(polls.id, id)).run();
        break;
      case 'project':
        if (!row.active || row.status === 'draft') throw new PollError(409, 'Abre a votação antes de a colocar no ecrã.');
        bumpScreen(db, eventId, true);
        return;
      case 'delete':
        if (row.status !== 'draft') throw new PollError(409, 'Só podes eliminar rascunhos.');
        db.delete(polls).where(eq(polls.id, id)).run();
        return;
    }
    bumpScreen(db, eventId);
  }, { behavior: 'immediate' });
}

export function recordPollVote(eventId: number, token: unknown, pollId: number, optionId: number, member: number) {
  const db = getDb();
  db.transaction(() => {
    const voter = invitationVoters(db, eventId, token).find(candidate => candidate.member === member);
    if (!voter) throw new PollError(403, 'Abre o teu convite pessoal para votar.');
    const poll = activePoll(db, eventId);
    if (poll?.id !== pollId || poll.status !== 'open') throw new PollError(409, 'Esta votação já não está aberta.');

    const option = db.select({ id: pollOptions.id }).from(pollOptions)
      .where(and(eq(pollOptions.pollId, pollId), eq(pollOptions.id, optionId))).get();
    if (!option) throw new PollError(400, 'Opção inválida para esta votação.');

    const existing: { optionId: number } | undefined = db.select({ optionId: pollVotes.optionId }).from(pollVotes)
      .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.guestId, voter.id))).get();
    if (existing) {
      if (existing.optionId !== optionId) throw new PollError(409, 'O voto deste convidado já está registado.');
      return;
    }

    db.insert(pollVotes).values({ pollId, optionId, guestId: voter.id, votedAt: new Date().toISOString() }).run();
    bumpScreen(db, eventId);
  }, { behavior: 'immediate' });
}
