import 'server-only';
import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { screenSettings, settings } from '../db/schema';
import type { ProgramItem } from './event-program';
import { readProgram } from './event-program-server';
import type { OperatorLiveProgram, PublicLiveProgram } from './live-program';

type StoredProgram =
  | { status: 'ready' | 'complete'; version: number }
  | { status: 'live'; version: number; moment: ProgramItem; index: number; startedAt: string };

type Action =
  | { type: 'select'; index: number }
  | { type: 'advance' | 'complete' | 'reset' };

const liveProgramKey = (eventId: number) => `event-program:live:${eventId}`;

function readStoredProgram(db: ReturnType<typeof getDb>, eventId: number): StoredProgram {
  const row = db.select({ value: settings.value }).from(settings)
    .where(eq(settings.key, liveProgramKey(eventId))).get();
  return row ? JSON.parse(row.value) as StoredProgram : { status: 'ready', version: 0 };
}

function findCurrentIndex(state: Extract<StoredProgram, { status: 'live' }>, items: ProgramItem[]) {
  const matches = (item: ProgramItem | undefined) =>
    item?.time === state.moment.time && item?.title === state.moment.title;

  if (matches(items[state.index]) && items[state.index].description === state.moment.description) return state.index;
  const exact = items.findIndex(item => matches(item) && item.description === state.moment.description);
  if (exact !== -1) return exact;
  const candidates = items.flatMap((item, index) => matches(item) ? [index] : []);
  return candidates.length === 1 ? candidates[0] : null;
}

function publicState(state: StoredProgram, items: ProgramItem[], currentIndex: number | null): PublicLiveProgram {
  const nextIndex = currentIndex !== null ? currentIndex + 1 : state.status === 'ready' ? 0 : null;
  return {
    status: state.status,
    current: currentIndex === null ? null : items[currentIndex] ?? null,
    next: nextIndex === null ? null : items[nextIndex] ?? null,
    startedAt: state.status === 'live' && currentIndex !== null ? state.startedAt : null,
  };
}

function toOperatorState(state: StoredProgram, items: ProgramItem[]): OperatorLiveProgram {
  const currentIndex = state.status === 'live' ? findCurrentIndex(state, items) : null;
  const revision = createHash('sha256').update(JSON.stringify([state.version, items])).digest('hex');
  return {
    ...publicState(state, items, currentIndex),
    currentIndex,
    needsSelection: state.status === 'live' && currentIndex === null,
    revision,
    program: items,
  };
}

export function readLiveProgram(eventId: number, published: ProgramItem[]): PublicLiveProgram {
  const state = readStoredProgram(getDb(), eventId);
  const currentIndex = state.status === 'live' ? findCurrentIndex(state, published) : null;
  return publicState(state, published, currentIndex);
}

export function readOperatorLiveProgram(eventId: number, slug: string): OperatorLiveProgram {
  const db = getDb();
  return toOperatorState(readStoredProgram(db, eventId), readProgram(eventId, slug, db).published);
}

export function updateLiveProgram(eventId: number, slug: string, revision: string, action: Action) {
  return getDb().transaction((tx: ReturnType<typeof getDb>) => {
    const state = readStoredProgram(tx, eventId);
    const items = readProgram(eventId, slug, tx).published;
    const current = toOperatorState(state, items);
    if (current.revision !== revision) {
      return { state: current, error: 'O programa mudou. Confere os momentos e tenta novamente.' };
    }

    const now = new Date().toISOString();
    const version = state.version + 1;
    let updated: StoredProgram;

    if (action.type === 'reset') {
      updated = { status: 'ready', version };
    } else if (action.type === 'complete') {
      updated = { status: 'complete', version };
    } else {
      const index = action.type === 'select' ? action.index :
        current.status === 'ready' ? 0 : current.currentIndex === null ? -1 : current.currentIndex + 1;
      const moment = items[index];
      if (!moment) return { state: current, error: 'Seleciona um momento do programa publicado.' };
      if (current.currentIndex === index) return { state: current };
      updated = { status: 'live', version, index, moment, startedAt: now };
    }

    const key = liveProgramKey(eventId);
    const value = JSON.stringify(updated);
    tx.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
    tx.update(screenSettings)
      .set({ version: sql`coalesce(${screenSettings.version}, 0) + 1`, updatedAt: now })
      .where(eq(screenSettings.eventId, eventId)).run();
    return { state: toOperatorState(updated, items) };
  }, { behavior: 'immediate' }) as { state: OperatorLiveProgram; error?: string };
}
