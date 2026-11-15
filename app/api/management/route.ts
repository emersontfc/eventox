import { NextResponse } from 'next/server';
import { isAdmin } from '../../admin-auth';
import { getDb } from '../../../db';
import { guestTables, guests, settings } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';
import {planGuestImport} from '../../../lib/guest-import';

export const dynamic = 'force-dynamic';
const defaults = ['Cirurgia Geral','Medicina Interna','Pediatria','Ginecologia e Obstetrícia','Cuidados Intensivos','Medicina de Emergência','Cardiologia','Neurologia','Saúde Coletiva','Anestesiologia'];
const fallbackDate = '2026-12-11T14:00';

async function init() {
  const db = getDb();
  await db.insert(guestTables).values(defaults.map((name, i) => ({ id: i + 1, name, capacity: 10 }))).onConflictDoNothing();
  await db.insert(settings).values([{key:'eventDate',value:fallbackDate},{key:'eventName',value:'Gala de Graduação'},{key:'venue',value:'Salão de Eventos Cajada II'}]).onConflictDoNothing();
  return db;
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({error:'Acesso reservado ao administrador'}, {status:403});
  try {
    const db = await init();
    const [tables, people, prefs] = await Promise.all([db.select().from(guestTables),db.select().from(guests),db.select().from(settings)]);
    return NextResponse.json({tables, guests:people, settings:Object.fromEntries(prefs.map(x=>[x.key,x.value]))});
  } catch { return NextResponse.json({error:'Não foi possível carregar os dados.'},{status:500}); }
}

export async function POST(request: Request) {
  if (!await isAdmin()) return NextResponse.json({error:'Acesso reservado ao administrador'}, {status:403});
  let body: Record<string, unknown>;
  try {body = await request.json();} catch {return NextResponse.json({error:'Pedido inválido'}, {status:400});}
  try {
    const db = await init();
    const action = String(body.action || '');
    if (action === 'guest-import') {
      if(typeof body.text !== 'string' || body.text.length > 1000000) throw new Error('Lista inválida ou demasiado grande.');
      const [tables,existing] = await Promise.all([db.select().from(guestTables),db.select().from(guests)]);
      const plan=planGuestImport(body.text,tables,existing,body.skipDuplicates !== false);
      if(plan.errors.length) throw new Error(plan.errors.slice(0,5).join(' '));
      if(!plan.records.length) throw new Error('Não há novos convidados para adicionar.');
      const timestamp=new Date().toISOString();
      const inserts=[];
      for(let i=0;i<plan.records.length;i+=10) inserts.push(db.insert(guests).values(plan.records.slice(i,i+10).map(g=>({...g,createdAt:timestamp}))));
      // D1 batch is atomic; each statement stays below its parameter limit.
      await db.batch(inserts as [typeof inserts[number], ...typeof inserts]);
      return NextResponse.json({ok:true,imported:plan.records.length,skipped:plan.skipped});
    } else if (action === 'guest-save') {
      const id = Number(body.id || 0), tableId = Number(body.tableId), seat = Number(body.seat);
      const name = String(body.name || '').trim().slice(0,120);
      const status = String(body.status || 'pendente');
      if (!name || !Number.isInteger(tableId) || tableId < 1 || tableId > 10 || !Number.isInteger(seat) || seat < 1 || seat > 10 || !['pendente','confirmado','recusado','presente'].includes(status)) throw new Error('Verifica nome, mesa, lugar e estado.');
      const record = {name,tableId,seat,status,phone:String(body.phone || '').slice(0,50),notes:String(body.notes || '').slice(0,500)};
      const occupied = await db.select().from(guests).where(and(eq(guests.tableId,tableId),eq(guests.seat,seat))).limit(1);
      if (occupied.length && occupied[0].id !== id) throw new Error('Este lugar já está ocupado.');
      if (id) {
        const existing = await db.select().from(guests).where(eq(guests.id,id)).limit(1);
        if (!existing.length) throw new Error('Convidado não encontrado.');
        await db.update(guests).set(record).where(eq(guests.id,id));
      } else await db.insert(guests).values({...record,createdAt:new Date().toISOString()});
    } else if (action === 'guest-delete') {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id < 1) throw new Error('Convidado inválido.');
      await db.delete(guests).where(eq(guests.id,id));
    } else if (action === 'table-rename') {
      const id = Number(body.id), name = String(body.name || '').trim().slice(0,90);
      if (!Number.isInteger(id) || id < 1 || id > 10 || !name) throw new Error('Nome da mesa inválido.');
      await db.update(guestTables).set({name}).where(eq(guestTables.id,id));
    } else if (action === 'settings') {
      const eventDate = String(body.eventDate || '');
      const eventName = String(body.eventName || '').trim().slice(0,100);
      const venue = String(body.venue || '').trim().slice(0,150);
      if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(eventDate) || !eventName) throw new Error('Data ou nome do evento inválido.');
      for (const [key,value] of Object.entries({eventDate,eventName,venue})) await db.insert(settings).values({key,value}).onConflictDoUpdate({target:settings.key,set:{value}});
    } else throw new Error('Ação desconhecida.');
    return NextResponse.json({ok:true});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível guardar.';
    return NextResponse.json({error:message.includes('UNIQUE')?'Este lugar já está ocupado.':message},{status:400});
  }
}
