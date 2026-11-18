import { storage } from '../../../../../../lib/storage';
import { getDb } from '../../../../../../db';
import { galleryMedia } from '../../../../../../db/schema';
import { eq } from 'drizzle-orm';
import { verifyDriveSync } from '../../route';

export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  if(!verifyDriveSync(request))return new Response('Não autorizado',{status:401});
  const id=Number((await params).id);if(!Number.isInteger(id)||id<1)return new Response('ID inválido',{status:400});
  const [item]=await getDb().select().from(galleryMedia).where(eq(galleryMedia.id,id));
  if(!item||item.status!=='aprovado'||item.driveStatus==='sincronizado')return new Response('Não disponível',{status:404});
  const file=await storage.get(item.key);if(!file)return new Response('Ficheiro não encontrado',{status:404});
  const filename=item.originalName.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,100)||'memoria';
  return new Response(file.body,{headers:{'Content-Type':item.mime,'Content-Length':String(item.size),'Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
