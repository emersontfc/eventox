import { NextResponse } from 'next/server';
import { isAdmin } from '../../admin-auth';
import { getDb } from '../../../db';
import { committeeMembers, committeeTasks, events } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
const error = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const clean = (v: unknown, max = 120) => String(v ?? '').trim().slice(0, max);
const validId = (id: number) => Number.isInteger(id) && id > 0;

function getSlug(request: Request) {
  const url = new URL(request.url);
  return (url.searchParams.get('slug') || request.headers.get('x-event-slug') || 'emerson').toLowerCase().trim();
}

async function getEventId(db: ReturnType<typeof getDb>, slug: string) {
  const [event] = await db.select({ id: events.id }).from(events).where(eq(events.slug, slug)).limit(1);
  return event?.id || 1;
}

export async function GET(req: Request) {
  const slug = getSlug(req);
  if (!await isAdmin(slug, 'committee:view')) return error('Acesso reservado ao administrador', 403);
  try {
    const db = getDb();
    const eventId = await getEventId(db, slug);
    const [members, tasks] = await Promise.all([
      db.select().from(committeeMembers).where(eq(committeeMembers.eventId, eventId)),
      db.select().from(committeeTasks).where(eq(committeeTasks.eventId, eventId)),
    ]);
    return NextResponse.json({ members, tasks });
  } catch {
    return error('Não foi possível carregar a comissão.', 500);
  }
}

export async function POST(req: Request) {
  const slug = getSlug(req);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return error('Pedido inválido'); }

  try {
    const db = getDb();
    const eventId = await getEventId(db, slug);
    const action = clean(body.action, 30), id = Number(body.id);
    const permission = action === 'task-status' ? 'committee:tasks:update' : 'committee:edit';
    if (!await isAdmin(slug, permission)) return error('Sem permissão para esta ação.', 403);

    if (action === 'member-save') {
      const name = clean(body.name), role = clean(body.role), area = clean(body.area, 90) || 'Coordenação geral', status = clean(body.status, 20);
      if (!name || !role || !['ativo', 'inativo'].includes(status)) return error('Indica nome, função e estado válidos.');
      const values = { eventId, name, role, area, status, responsibilities: clean(body.responsibilities, 1000), phone: clean(body.phone, 50), email: clean(body.email, 150) };
      if (validId(id)) {
        const [member] = await db.select({ id: committeeMembers.id }).from(committeeMembers).where(and(eq(committeeMembers.id, id), eq(committeeMembers.eventId, eventId)));
        if (!member) return error('Membro não encontrado');
        await db.update(committeeMembers).set(values).where(eq(committeeMembers.id, id));
      } else {
        await db.insert(committeeMembers).values(values);
      }
    } else if (action === 'member-delete') {
      if (!validId(id)) return error('Membro inválido');
      await db.update(committeeTasks).set({ memberId: null }).where(and(eq(committeeTasks.memberId, id), eq(committeeTasks.eventId, eventId)));
      await db.delete(committeeMembers).where(and(eq(committeeMembers.id, id), eq(committeeMembers.eventId, eventId)));
    } else if (action === 'task-save') {
      const title = clean(body.title), dueDate = clean(body.dueDate, 30), status = clean(body.status, 20), memberId = Number(body.memberId) || null;
      if (!title || !['pendente', 'em_curso', 'concluida'].includes(status)) return error('Indica título e estado da tarefa.');
      const values = { eventId, title, dueDate, status, memberId, notes: clean(body.notes, 500) };
      if (validId(id)) {
        const [task] = await db.select({ id: committeeTasks.id }).from(committeeTasks).where(and(eq(committeeTasks.id, id), eq(committeeTasks.eventId, eventId)));
        if (!task) return error('Tarefa não encontrada');
        await db.update(committeeTasks).set(values).where(eq(committeeTasks.id, id));
      } else {
        await db.insert(committeeTasks).values(values);
      }
    } else if (action === 'task-status') {
      const status = clean(body.status, 20);
      if (!validId(id) || !['pendente', 'em_curso', 'concluida'].includes(status)) return error('Estado inválido');
      await db.update(committeeTasks).set({ status }).where(and(eq(committeeTasks.id, id), eq(committeeTasks.eventId, eventId)));
    } else if (action === 'task-delete') {
      if (!validId(id)) return error('Tarefa inválida');
      await db.delete(committeeTasks).where(and(eq(committeeTasks.id, id), eq(committeeTasks.eventId, eventId)));
    } else {
      return error('Ação não suportada');
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : 'Erro ao processar');
  }
}
