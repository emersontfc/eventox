import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '../../../../../db';
import { settings } from '../../../../../db/schema';
import { getEventMembershipContext } from '../../../../../lib/auth';
import { hasPermission } from '../../../../../lib/permissions';
import { programKey, readProgram } from '../../../../../lib/event-program-server';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ slug: string }> };

async function editableEvent(context: Context) {
  const { slug } = await context.params;
  const access = await getEventMembershipContext(slug);
  return access && hasPermission(access.role, access.permissions, 'event:manage') ? access.event : null;
}

export async function GET(_request: Request, context: Context) {
  const event = await editableEvent(context);
  if (!event) return NextResponse.json({ error: 'Acesso reservado à organização.' }, { status: 403 });
  return NextResponse.json(await readProgram(event.id, event.slug));
}

export async function PUT(request: Request, context: Context) {
  const event = await editableEvent(context);
  if (!event) return NextResponse.json({ error: 'Acesso reservado à organização.' }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.items) || body.items.length > 60 ||
      !body.items.every((item: any) => item && typeof item.time === 'string' &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time) &&
        typeof item.title === 'string' && item.title.trim() && item.title.length <= 120 &&
        typeof item.description === 'string' && item.description.length <= 500)) {
    return NextResponse.json({ error: 'Confere a hora, o título e a descrição de cada momento.' }, { status: 400 });
  }

  const draft = body.items.map(({ time, title, description }: { time: string; title: string; description: string }) =>
    ({ time, title: title.trim(), description: description.trim() }));
  const publish = body.publish === true;
  const fallback = await readProgram(event.id, event.slug);
  const value = JSON.stringify({ draft, published: publish ? draft : fallback.published });
  const [saved] = await getDb().insert(settings).values({ key: programKey(event.id), value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: publish ? value : sql`json_set(${settings.value}, '$.draft', json(${JSON.stringify(draft)}))` },
    }).returning({ value: settings.value });
  return NextResponse.json(JSON.parse(saved.value));
}
