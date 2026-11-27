import 'server-only';

import { and, asc, eq, inArray, isNull, lte, max } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { getDb } from '@/db';
import { events, galleryMedia, guestbookMessages } from '@/db/schema';
import { safeGuestbookPhoto } from '@/lib/guestbook';
import type { ActiveProjection, ProjectionItem, ProjectionKind, ProjectionQueueState } from '@/lib/projection';

const projectionQueue = sqliteTable('projection_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['photos', 'messages'] }).notNull(),
  sourceId: integer('source_id').notNull(),
  position: integer('position').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  projectedAt: integer('projected_at'),
});

const projectionState = sqliteTable('projection_state', {
  eventId: integer('event_id').primaryKey().references(() => events.id, { onDelete: 'cascade' }),
  preparedId: integer('prepared_id').references(() => projectionQueue.id, { onDelete: 'set null' }),
  activeId: integer('active_id').references(() => projectionQueue.id, { onDelete: 'set null' }),
  expiresAt: integer('expires_at'),
});

type Db = ReturnType<typeof getDb>;
type QueueRow = typeof projectionQueue.$inferSelect;
type StateRow = typeof projectionState.$inferSelect;
type Media = Pick<typeof galleryMedia.$inferSelect, 'id' | 'mime' | 'uploader' | 'originalName'>;
type Message = Pick<typeof guestbookMessages.$inferSelect, 'id' | 'senderName' | 'message' | 'photoUrl'>;
type Event = Pick<typeof events.$inferSelect, 'id' | 'slug'>;

type ProjectionCommand =
  | { action: 'enqueue'; kind: ProjectionKind; sourceId: number; durationSeconds?: number }
  | { action: 'prepare' | 'project' | 'remove'; id: number }
  | { action: 'move'; id: number; direction: 'up' | 'down' }
  | { action: 'duration'; id: number; durationSeconds: number }
  | { action: 'skip' | 'return' };

export class ProjectionError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

function sourceContent(db: Db, event: Event, rows: QueueRow[]): Map<number, ProjectionItem> {
  const mediaIds = rows.filter(row => row.kind === 'photos').map(row => row.sourceId);
  const messageIds = rows.filter(row => row.kind === 'messages').map(row => row.sourceId);

  const media: Media[] = mediaIds.length
    ? db.select({
      id: galleryMedia.id, mime: galleryMedia.mime,
      uploader: galleryMedia.uploader, originalName: galleryMedia.originalName,
    }).from(galleryMedia).where(and(
      eq(galleryMedia.eventId, event.id), eq(galleryMedia.status, 'aprovado'), inArray(galleryMedia.id, mediaIds),
    )).all() : [];

  const messages: Message[] = messageIds.length
    ? db.select({
      id: guestbookMessages.id, senderName: guestbookMessages.senderName,
      message: guestbookMessages.message, photoUrl: guestbookMessages.photoUrl,
    }).from(guestbookMessages).where(and(
      eq(guestbookMessages.eventId, event.id), eq(guestbookMessages.status, 'aprovado'), inArray(guestbookMessages.id, messageIds),
    )).all() : [];

  const mediaById = new Map(media.map(entry => [entry.id, entry]));
  const messagesById = new Map(messages.map(entry => [entry.id, entry]));
  const content = new Map<number, ProjectionItem>();
  for (const row of rows) {
    const common = { id: row.id, durationSeconds: row.durationSeconds };
    if (row.kind === 'photos') {
      const file = mediaById.get(row.sourceId);
      if (!file) continue;
      content.set(row.id, {
        ...common, kind: 'photos', title: file.uploader || file.originalName, text: '',
        mediaUrl: `/api/gallery/media/${file.id}`, mime: file.mime,
      });
    } else {
      const message = messagesById.get(row.sourceId);
      if (!message) continue;
      content.set(row.id, {
        ...common, kind: 'messages', title: message.senderName, text: message.message,
        mediaUrl: safeGuestbookPhoto(event.slug, message.photoUrl), mime: null,
      });
    }
  }
  return content;
}

function pendingRows(db: Db, eventId: number): QueueRow[] {
  return db.select().from(projectionQueue).where(and(
    eq(projectionQueue.eventId, eventId), isNull(projectionQueue.projectedAt),
  )).orderBy(asc(projectionQueue.position), asc(projectionQueue.id)).all();
}

function stateRow(db: Db, eventId: number): StateRow | undefined {
  return db.select().from(projectionState).where(eq(projectionState.eventId, eventId)).get();
}

export function readActiveProjection(event: Event, timestamp: number): ActiveProjection | null {
  const db = getDb();
  const state = stateRow(db, event.id);
  if (!state?.activeId || !state.expiresAt || state.expiresAt <= timestamp) return null;
  const row = db.select().from(projectionQueue).where(and(
    eq(projectionQueue.eventId, event.id), eq(projectionQueue.id, state.activeId),
  )).get();
  if (!row) return null;
  const item = sourceContent(db, event, [row]).get(row.id);
  return item ? { ...item, expiresAt: state.expiresAt } : null;
}

export function readProjectionQueue(event: Event): ProjectionQueueState {
  const db = getDb();
  const timestamp = Date.now();
  const state = stateRow(db, event.id);
  const items = Array.from(sourceContent(db, event, pendingRows(db, event.id)).values());
  return {
    items,
    preparedId: items.some(item => item.id === state?.preparedId) ? state?.preparedId ?? null : null,
    active: readActiveProjection(event, timestamp),
    timestamp,
  };
}

export function runProjectionCommand(event: Event, command: ProjectionCommand) {
  const db = getDb();
  db.transaction((tx: Db) => {
    const timestamp = Date.now();
    const state = stateRow(tx, event.id);
    const scopedRow = (id: number) => and(eq(projectionQueue.eventId, event.id), eq(projectionQueue.id, id));
    const patchState = (values: Partial<Pick<StateRow, 'preparedId' | 'activeId' | 'expiresAt'>>) => {
      tx.insert(projectionState).values({ eventId: event.id, ...values })
        .onConflictDoUpdate({ target: projectionState.eventId, set: values }).run();
    };
    const rows = pendingRows(tx, event.id);
    const approved = sourceContent(tx, event, rows);

    // Removed or hidden content must not return to the queue without an explicit new request.
    const unavailable = rows.filter(row => !approved.has(row.id)).map(row => row.id);
    if (unavailable.length) {
      tx.delete(projectionQueue).where(and(eq(projectionQueue.eventId, event.id), inArray(projectionQueue.id, unavailable))).run();
    }
    // Keep completed entries only while referenced by the current projection.
    tx.delete(projectionQueue).where(and(eq(projectionQueue.eventId, event.id), lte(projectionQueue.projectedAt, timestamp - 120_000))).run();

    if (command.action === 'enqueue') {
      const { kind, sourceId } = command;
      const draft: QueueRow = {
        id: 0, kind, sourceId, eventId: event.id, position: 0,
        durationSeconds: command.durationSeconds ?? (kind === 'photos' ? 12 : 20), projectedAt: null,
      };
      if (!sourceContent(tx, event, [draft]).has(0)) throw new ProjectionError('Só podes enviar conteúdo aprovado para a fila.');
      if (rows.some(row => row.kind === kind && row.sourceId === sourceId && approved.has(row.id))) return;
      if (approved.size >= 100) throw new ProjectionError('A fila atingiu o limite de 100 itens. Remove um item da fila.');
      const current = tx.select({ position: max(projectionQueue.position) }).from(projectionQueue)
        .where(and(eq(projectionQueue.eventId, event.id), isNull(projectionQueue.projectedAt))).get();
      tx.insert(projectionQueue).values({
        eventId: event.id, kind, sourceId,
        position: (current?.position ?? 0) + 1, durationSeconds: draft.durationSeconds,
      }).run();
      return;
    }

    if (command.action === 'return' || command.action === 'skip') {
      const next = command.action === 'skip' ? (approved.keys().next().value ?? null) : state?.preparedId ?? null;
      patchState({ activeId: null, expiresAt: null, preparedId: next });
      return;
    }

    if (!('id' in command) || !approved.has(command.id)) {
      throw new ProjectionError('Este item deixou de estar disponível. Atualiza a fila.');
    }

    if (command.action === 'prepare') {
      patchState({ preparedId: command.id });
    } else if (command.action === 'project') {
      if (state?.preparedId !== command.id) throw new ProjectionError('Prepara este item antes de o projetar.');
      const item = approved.get(command.id)!;
      tx.update(projectionQueue).set({ projectedAt: timestamp }).where(scopedRow(command.id)).run();
      patchState({ preparedId: null, activeId: command.id, expiresAt: timestamp + item.durationSeconds * 1000 });
    } else if (command.action === 'remove') {
      tx.delete(projectionQueue).where(scopedRow(command.id)).run();
      if (state?.preparedId === command.id) patchState({ preparedId: null });
    } else if (command.action === 'duration') {
      tx.update(projectionQueue).set({ durationSeconds: command.durationSeconds }).where(scopedRow(command.id)).run();
    } else if (command.action === 'move') {
      const current = rows.filter(row => approved.has(row.id));
      const index = current.findIndex(row => row.id === command.id);
      const adjacent = current[index + (command.direction === 'up' ? -1 : 1)];
      if (!adjacent) return;
      tx.update(projectionQueue).set({ position: adjacent.position }).where(scopedRow(command.id)).run();
      tx.update(projectionQueue).set({ position: current[index].position }).where(scopedRow(adjacent.id)).run();
    }
  }, { behavior: 'immediate' });
  return readProjectionQueue(event);
}
