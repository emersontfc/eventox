import { NextResponse } from 'next/server';
import { isAdmin } from '../../admin-auth';
import { getDb } from '../../../db';
import { menuItems, orders, playlist, guestTables, events } from '../../../db/schema';
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

async function getEventId(db: ReturnType<typeof getDb>, slug: string) {
  const [event] = await db.select({ id: events.id }).from(events).where(eq(events.slug, slug)).limit(1);
  return event?.id || 1;
}

const VALID_CATEGORIES = ['entrada', 'prato_principal', 'sobremesa', 'lanche', 'bebida', 'comida', 'bar'];

export async function GET(req: Request) {
  const slug = getSlug(req);
  if (!await isAdmin(slug)) return fail('Acesso reservado ao administrador', 403);
  try {
    const db = getDb();
    const eventId = await getEventId(db, slug);
    const [items, requests, songs] = await Promise.all([
      db.select().from(menuItems).where(eq(menuItems.eventId, eventId)),
      db.select().from(orders).where(eq(orders.eventId, eventId)),
      db.select().from(playlist).where(eq(playlist.eventId, eventId)),
    ]);
    return NextResponse.json({ items, orders: requests, songs });
  } catch {
    return fail('Não foi possível carregar o serviço.', 500);
  }
}

export async function POST(req: Request) {
  const slug = getSlug(req);
  if (!await isAdmin(slug)) return fail('Acesso reservado ao administrador', 403);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail('Pedido inválido'); }

  try {
    const db = getDb();
    const eventId = await getEventId(db, slug);
    const action = clean(body.action, 40);

    if (action === 'item-save') {
      const id = idOf(body.id), name = clean(body.name, 140);
      let category = clean(body.category, 30).toLowerCase();
      if (category === 'comida') category = 'prato_principal';
      if (category === 'bar') category = 'bebida';

      const stock = idOf(body.stock);
      const unit = clean(body.unit, 30) || 'unidade';

      if (!name || !VALID_CATEGORIES.includes(category) || !Number.isSafeInteger(stock) || stock < 0 || stock > 1000000) {
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
    } else if (action === 'template-gala-menu') {
      // Import curated complete gourmet gala menu
      const defaultGalaMenu = [
        { name: 'Tártaro de Salmão com Abacate & Citrinos', category: 'entrada', description: 'Temperado com citrinos frescos, cebolinho e emulsão de ervas finas acompanhado de tostas artesanais.', stock: 150, unit: 'porção' },
        { name: 'Bruschettas Mediterrânicas de Tomate Cereja', category: 'entrada', description: 'Tomate cereja confitado, manjericão fresco, azeite virgem extra e redução balsâmica.', stock: 150, unit: 'porção' },
        { name: 'Tábua de Queijos Nobres & Charcutaria Fina', category: 'entrada', description: 'Seleção de queijos curados, presunto serrano, frutos secos e compotas artesanais.', stock: 150, unit: 'porção' },
        { name: 'Lombo de Novilho em Crosta de Ervas Finas', category: 'prato_principal', description: 'Carne tenra de novilho com molho rico de vinho do Porto e batata gratinada dauphinoise.', stock: 120, unit: 'prato' },
        { name: 'Robalo Selvagem Grelhado com Risotto de Limão', category: 'prato_principal', description: 'Filete de robalo na chapa acompanhado de risotto cremoso de limão e espargos verdes.', stock: 120, unit: 'prato' },
        { name: 'Ravioli de Cogumelos Selvagens com Creme de Trufa', category: 'prato_principal', description: 'Massa fresca recheada com cogumelos boletus em creme aveludado de trufa negra e parmesão.', stock: 80, unit: 'prato' },
        { name: 'Bolo de Gala Red Velvet & Frutos Silvestres', category: 'sobremesa', description: 'O bolo solene da comemoração com camadas aveludadas, frutos vermelhos frescos e corte de honra.', stock: 200, unit: 'fatia' },
        { name: 'Petit Gâteau de Chocolate Belga com Gelado', category: 'sobremesa', description: 'Bolo quente com coração derretido de chocolate belga e bola de gelado artesanal de baunilha.', stock: 150, unit: 'dose' },
        { name: 'Mousse Aveludada de Maracujá Fresco com Merengue', category: 'sobremesa', description: 'Creme leve e refrescante com polpa natural de maracujá e raspas de chocolate branco.', stock: 150, unit: 'taça' },
        { name: 'Espumante Brut de Honra & Champagne', category: 'bebida', description: 'Servido para o brinde solene oficial e recepção dos convidados de honra.', stock: 60, unit: 'garrafa' },
        { name: 'Cocktail de Assinatura "Eventox Gold"', category: 'bebida', description: 'Gin premium, xarope artesanal de flor de sabugueiro, citrinos e folha de ouro comestível.', stock: 150, unit: 'copo' },
        { name: 'Vinhos Tintos & Brancos Reserva Selecionada', category: 'bebida', description: 'Garrafeira selecionada da colheita especial para harmonização com o jantar.', stock: 80, unit: 'garrafa' },
        { name: 'Cervejas Especiais & Refrigerantes Variados', category: 'bebida', description: 'Cervejas artesanais, águas minerais com e sem gás, sumos naturais e refrigerantes.', stock: 250, unit: 'unidade' },
        { name: 'Caldo Verde Tradicional com Broa de Milho', category: 'lanche', description: 'Servido quente na ceia da madrugada com rodelas de chouriço e broa tostada.', stock: 120, unit: 'tigela' },
        { name: 'Mini Pregos em Bolo do Caco com Manteiga de Alho', category: 'lanche', description: 'Snack da madrugada com carne tenra e pão típico da Madeira na grelha.', stock: 150, unit: 'unidade' },
      ];

      for (const item of defaultGalaMenu) {
        await db.insert(menuItems).values({
          eventId,
          name: item.name,
          category: item.category,
          description: item.description,
          stock: item.stock,
          unit: item.unit,
          available: true,
        });
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
