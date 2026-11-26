import { menuCategoryId } from '../../../lib/menu-categories';
import { NextResponse } from 'next/server';
import { getEventMembershipContext } from '../../../lib/auth';
import { hasPermission } from '../../../lib/permissions';
import { getDb } from '../../../db';
import { menuItems, orders, playlist, guestTables } from '../../../db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const clean = (value: unknown, max = 120) => String(value ?? '').trim().slice(0, max);
const idOf = (value: unknown) => Number(value);
const validId = (id: number) => Number.isInteger(id) && id > 0;

function getSlug(request: Request) {
  const url = new URL(request.url);
  return (url.searchParams.get('slug') || request.headers.get('x-event-slug') || 'emerson').toLowerCase().trim();
}


export async function GET(req: Request) {
  const slug = getSlug(req);
  const access = await getEventMembershipContext(slug);
  if (!access) return fail('Acesso reservado à equipa', 403);
  const can = (permission: string) => hasPermission(access.role, access.permissions, permission);
  try {
    const db = getDb();
    const eventId = access.event.id;
    const hospitality = can('hospitality:view');
    const music = can('playlist:view');
    if (!hospitality && !music) return fail('Sem permissão para consultar o serviço.', 403);
    const [items, requests, songs] = await Promise.all([
      hospitality ? db.select().from(menuItems).where(eq(menuItems.eventId, eventId)) : [],
      hospitality ? db.select().from(orders).where(eq(orders.eventId, eventId)) : [],
      music ? db.select().from(playlist).where(eq(playlist.eventId, eventId)) : [],
    ]);
    return NextResponse.json({ items, orders: requests, songs });
  } catch {
    return fail('Não foi possível carregar o serviço.', 500);
  }
}

export async function POST(req: Request) {
  const slug = getSlug(req);
  const access = await getEventMembershipContext(slug);
  if (!access) return fail('Acesso reservado à equipa', 403);
  const can = (permission: string) => hasPermission(access.role, access.permissions, permission);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail('Pedido inválido'); }

  try {
    const db = getDb();
    const eventId = access.event.id;
    const action = clean(body.action, 40);
    const permissions: Record<string, string> = {
      'item-save': 'hospitality:menu:manage',
      'item-delete': 'hospitality:menu:manage',
      'order-create': 'hospitality:order:create',
      'order-status': 'hospitality:order:update',
      'song-save': 'playlist:control',
      'song-status': 'playlist:control',
      'song-move': 'playlist:control',
      'song-delete': 'playlist:control',
    };
    if (!Object.hasOwn(permissions, action)) return fail('Ação desconhecida.');
    if (!can(permissions[action])) return fail('Sem permissão para esta ação.', 403);

    if (action === 'item-save') {
      const id = idOf(body.id), name = clean(body.name, 140);
      const category = menuCategoryId(clean(body.category, 30).toLowerCase());

      const stock = idOf(body.stock);
      const unit = clean(body.unit, 30) || 'unidade';

      if (!name || !category || !Number.isSafeInteger(stock) || stock < 0 || stock > 1000000) {
        return fail('Verifica o nome, categoria culinária e quantidade de stock/porções.');
      }

      const values = {
        eventId,
        name,
        category,
        stock,
        unit,
        description: clean(body.description, 400),
        available: body.available !== false,
      };

      if (validId(id)) {
        const existing = await db.select({ id: menuItems.id }).from(menuItems).where(and(eq(menuItems.id, id), eq(menuItems.eventId, eventId)));
        if (!existing.length) return fail('Produto não encontrado');
        await db.update(menuItems).set(values).where(eq(menuItems.id, id));
      } else {
        await db.insert(menuItems).values(values);
      }
    } else if (action === 'item-delete') {
      const id = idOf(body.id);
      if (!validId(id)) return fail('Produto inválido');
      const history = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.itemId, id), eq(orders.eventId, eventId))).limit(1);
      if (history.length) return fail('Este produto tem pedidos associados. Desativa-o para preservar o histórico.');
      await db.delete(menuItems).where(and(eq(menuItems.id, id), eq(menuItems.eventId, eventId)));
    } else if (action === 'order-create') {
      const tableId = idOf(body.tableId), itemId = idOf(body.itemId), quantity = idOf(body.quantity);
      if (!validId(tableId) || !validId(itemId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) return fail('Mesa, produto ou quantidade inválidos.');
      const [table] = await db.select({ id: guestTables.id }).from(guestTables).where(and(eq(guestTables.id, tableId), eq(guestTables.eventId, eventId)));
      if (!table) return fail('Mesa inexistente neste evento.');
      const update = await db.update(menuItems).set({ stock: sql`${menuItems.stock} - ${quantity}` }).where(and(eq(menuItems.id, itemId), eq(menuItems.eventId, eventId), eq(menuItems.available, true), gte(menuItems.stock, quantity))).returning({ id: menuItems.id });
      if (!update.length) return fail('Stock insuficiente ou produto indisponível.');
      await db.insert(orders).values({ eventId, tableId, itemId, quantity, status: 'pendente', note: clean(body.note, 300), createdAt: new Date().toISOString() });
    } else if (action === 'order-status') {
      const id = idOf(body.id), status = clean(body.status, 20);
      if (!validId(id) || !['pendente', 'preparacao', 'entregue', 'cancelado'].includes(status)) return fail('Estado inválido.');
      const [old] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.eventId, eventId)));
      if (!old) return fail('Pedido inexistente.');
      if (old.status === 'cancelado' && status !== 'cancelado') return fail('Pedido cancelado. Regista um novo pedido.');
      if (old.status === 'entregue' && status === 'cancelado') return fail('Pedido entregue. Não pode ser cancelado automaticamente.');
      if (status === 'cancelado' && old.status !== 'cancelado') await db.update(menuItems).set({ stock: sql`${menuItems.stock} + ${old.quantity}` }).where(eq(menuItems.id, old.itemId));
      await db.update(orders).set({ status }).where(eq(orders.id, id));
    } else if (action === 'song-save') {
      const id = idOf(body.id), title = clean(body.title, 150), artist = clean(body.artist, 120), url = clean(body.url, 500);
      if (!title) return fail('Indica o título da música.');
      if (url && !/^https:\/\//i.test(url)) return fail('Utiliza um link HTTPS válido.');
      if (validId(id)) {
        await db.update(playlist).set({ title, artist, url }).where(and(eq(playlist.id, id), eq(playlist.eventId, eventId)));
      } else {
        const [position] = await db.select({ max: sql<number>`coalesce(max(${playlist.position}),0)` }).from(playlist).where(eq(playlist.eventId, eventId));
        await db.insert(playlist).values({ eventId, title, artist, url, position: Number(position.max) + 1, status: 'fila' });
      }
    } else if (action === 'song-status') {
      const id = idOf(body.id), status = clean(body.status, 20);
      if (!validId(id) || !['fila', 'tocando', 'tocada'].includes(status)) return fail('Estado inválido');
      if (status === 'tocando') await db.update(playlist).set({ status: 'fila' }).where(and(eq(playlist.eventId, eventId), eq(playlist.status, 'tocando')));
      await db.update(playlist).set({ status }).where(and(eq(playlist.id, id), eq(playlist.eventId, eventId)));
    } else if (action === 'song-move') {
      const id = idOf(body.id), direction = idOf(body.direction);
      if (!validId(id) || ![1, -1].includes(direction)) return fail('Movimento inválido');
      const all = await db.select().from(playlist).where(eq(playlist.eventId, eventId)).orderBy(playlist.position, playlist.id);
      const index = all.findIndex((s: any) => s.id === id);
      if (index === -1) return fail('Música não encontrada');
      const swap = all[index + direction];
      if (!swap) return NextResponse.json({ ok: true });
      await db.update(playlist).set({ position: swap.position }).where(eq(playlist.id, id));
      await db.update(playlist).set({ position: all[index].position }).where(eq(playlist.id, swap.id));
    } else if (action === 'song-delete') {
      const id = idOf(body.id);
      if (!validId(id)) return fail('Música inválida');
      await db.delete(playlist).where(and(eq(playlist.id, id), eq(playlist.eventId, eventId)));
    } else {
      return fail('Ação desconhecida.');
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Erro no processamento.');
  }
}
