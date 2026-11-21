import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { settings } from '../db/schema';
import { defaultProgram, type ProgramItem } from './event-program';

export const programKey = (id: number) => `event-program:${id}`;

export async function readProgram(id: number, slug: string) {
  const [record] = await getDb().select().from(settings).where(eq(settings.key, programKey(id)));
  if (record) return JSON.parse(record.value) as { draft: ProgramItem[]; published: ProgramItem[] };
  const fallback = defaultProgram(slug);
  return { draft: fallback, published: fallback };
}
