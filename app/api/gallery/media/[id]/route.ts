import { NextResponse } from 'next/server';
import { storage } from '../../../../../lib/storage';
import { getDb } from '../../../../../db';
import { events, galleryMedia, settings } from '../../../../../db/schema';
import { eq } from 'drizzle-orm';
import { isEventAdmin } from '../../../../../lib/auth';

export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;const number=Number(id);if(!Number.isInteger(number)||number<1)return new Response('Não encontrado',{status:404});
  const db=getDb();const [media]=await db.select().from(galleryMedia).where(eq(galleryMedia.id,number));if(!media)return new Response('Não encontrado',{status:404});
  if (media.status !== 'aprovado') {
    const [event] = await db.select({ slug: events.slug }).from(events).where(eq(events.id, media.eventId));
    const moderator = event && await isEventAdmin(event.slug, 'gallery:moderate');
    if (!moderator && media.eventId !== 1) return new Response('Acesso negado', { status: 403 });
    const key = new URL(request.url).searchParams.get('key') || '';
    const [s] = await db.select().from(settings).where(eq(settings.key, 'gallery-token'));
    if (!moderator && (media.status === 'rejeitado' || !s?.value || key !== s.value)) return new Response('Acesso negado', { status: 403 });
  }
  const object=await storage.get(media.key);if(!object)return new Response('Não encontrado',{status:404});
  return new Response(object.body,{headers:{'Content-Type':media.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
