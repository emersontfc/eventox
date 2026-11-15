import { NextResponse } from 'next/server';
import { isAdmin } from '../../admin-auth';
import { getDb } from '../../../db';
import { menuItems, orders, playlist, guestTables } from '../../../db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
const fail = (message:string,status=400)=>NextResponse.json({error:message},{status});
const clean = (value:unknown, max=120)=>String(value??'').trim().slice(0,max);
const idOf = (value:unknown)=>Number(value);
const validId=(id:number)=>Number.isInteger(id)&&id>0;

export async function GET(){
  if(!await isAdmin())return fail('Acesso reservado ao administrador',403);
  try {const db=getDb();const [items,requests,songs]=await Promise.all([db.select().from(menuItems),db.select().from(orders),db.select().from(playlist)]);return NextResponse.json({items,orders:requests,songs});}
  catch{return fail('Não foi possível carregar o serviço.',500)}
}

export async function POST(req:Request){
  if(!await isAdmin())return fail('Acesso reservado ao administrador',403);
  let body:Record<string,unknown>;try{body=await req.json()}catch{return fail('Pedido inválido')}
  try{
    const db=getDb();const action=clean(body.action,40);
    if(action==='item-save'){
      const id=idOf(body.id),name=clean(body.name),category=clean(body.category,20),stock=idOf(body.stock),unit=clean(body.unit,25)||'unidade';
      if(!name||!['comida','bebida'].includes(category)||!Number.isSafeInteger(stock)||stock<0||stock>1000000)return fail('Verifica nome, categoria e quantidade de stock.');
      const values={name,category,stock,unit,description:clean(body.description,300),available:body.available!==false};
      if(validId(id)){const existing=await db.select({id:menuItems.id}).from(menuItems).where(eq(menuItems.id,id));if(!existing.length)return fail('Produto não encontrado');await db.update(menuItems).set(values).where(eq(menuItems.id,id))}
      else await db.insert(menuItems).values(values);
    }else if(action==='item-delete'){
      const id=idOf(body.id);if(!validId(id))return fail('Produto inválido');
      const history=await db.select({id:orders.id}).from(orders).where(eq(orders.itemId,id)).limit(1);
      if(history.length)return fail('Este produto tem pedidos associados. Desativa-o para preservar o histórico.');
      await db.delete(menuItems).where(eq(menuItems.id,id));
    }else if(action==='order-create'){
      const tableId=idOf(body.tableId),itemId=idOf(body.itemId),quantity=idOf(body.quantity);
      if(!validId(tableId)||!validId(itemId)||!Number.isInteger(quantity)||quantity<1||quantity>100)return fail('Mesa, produto ou quantidade inválidos.');
      const [table]=await db.select({id:guestTables.id}).from(guestTables).where(eq(guestTables.id,tableId));if(!table)return fail('Mesa inexistente.');
      const update=await db.update(menuItems).set({stock:sql`${menuItems.stock} - ${quantity}`}).where(and(eq(menuItems.id,itemId),eq(menuItems.available,true),gte(menuItems.stock,quantity))).returning({id:menuItems.id});
      if(!update.length)return fail('Stock insuficiente ou produto indisponível.');
      await db.insert(orders).values({tableId,itemId,quantity,status:'pendente',note:clean(body.note,300),createdAt:new Date().toISOString()});
    }else if(action==='order-status'){
      const id=idOf(body.id),status=clean(body.status,20);if(!validId(id)||!['pendente','preparacao','entregue','cancelado'].includes(status))return fail('Estado inválido.');
      const [old]=await db.select().from(orders).where(eq(orders.id,id));if(!old)return fail('Pedido inexistente.');
      if(old.status==='cancelado'&&status!=='cancelado')return fail('Pedido cancelado. Regista um novo pedido.');
      if(old.status==='entregue'&&status==='cancelado')return fail('Pedido entregue. Não pode ser cancelado automaticamente.');
      if(status==='cancelado'&&old.status!=='cancelado')await db.update(menuItems).set({stock:sql`${menuItems.stock} + ${old.quantity}`}).where(eq(menuItems.id,old.itemId));
      await db.update(orders).set({status}).where(eq(orders.id,id));
    }else if(action==='song-save'){
      const id=idOf(body.id),title=clean(body.title,150),artist=clean(body.artist,120),url=clean(body.url,500);
      if(!title)return fail('Indica o título da música.');
      if(url&&!/^https:\/\//i.test(url))return fail('Utiliza um link HTTPS válido.');
      if(validId(id)){await db.update(playlist).set({title,artist,url}).where(eq(playlist.id,id))}
      else{const [position]=await db.select({max:sql<number>`coalesce(max(${playlist.position}),0)`}).from(playlist);await db.insert(playlist).values({title,artist,url,position:Number(position.max)+1,status:'fila'})}
    }else if(action==='song-status'){
      const id=idOf(body.id),status=clean(body.status,20);if(!validId(id)||!['fila','tocando','tocada'].includes(status))return fail('Estado inválido');
      if(status==='tocando')await db.update(playlist).set({status:'fila'}).where(eq(playlist.status,'tocando'));
      await db.update(playlist).set({status}).where(eq(playlist.id,id));
    }else if(action==='song-move'){
      const id=idOf(body.id),direction=idOf(body.direction);if(!validId(id)||![1,-1].includes(direction))return fail('Movimento inválido');
      const list=await db.select().from(playlist).orderBy(playlist.position,playlist.id);const i=list.findIndex(s=>s.id===id),other=list[i+direction];if(i>=0&&other){await db.update(playlist).set({position:other.position}).where(eq(playlist.id,id));await db.update(playlist).set({position:list[i].position}).where(eq(playlist.id,other.id))}
    }else if(action==='song-delete'){
      const id=idOf(body.id);if(!validId(id))return fail('Música inválida');await db.delete(playlist).where(eq(playlist.id,id));
    }else return fail('Ação desconhecida.');
    return NextResponse.json({ok:true});
  }catch(error){return fail(error instanceof Error?error.message:'Não foi possível guardar.',500)}
}
