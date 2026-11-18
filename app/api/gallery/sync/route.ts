import { NextResponse } from 'next/server';
import { getDb } from '../../../../db';
import { galleryMedia } from '../../../../db/schema';
import { and, eq, asc } from 'drizzle-orm';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
function permitted(request:Request){
  const configured = process.env.GOOGLE_DRIVE_SYNC_SECRET;
  const provided=request.headers.get('Authorization')||'';
  if(!configured||configured.length<32||!provided.startsWith('Bearer '))return false;
  const value=provided.slice(7);if(value.length!==configured.length)return false;
  let difference=0;for(let i=0;i<value.length;i++)difference|=value.charCodeAt(i)^configured.charCodeAt(i);
  return difference===0;
}
export { permitted as verifyDriveSync };

export async function GET(request:Request){
  if(!permitted(request))return response({error:'Não autorizado'},401);
  try{
    const list=await getDb().select({id:galleryMedia.id,name:galleryMedia.originalName,album:galleryMedia.album,mime:galleryMedia.mime,size:galleryMedia.size}).from(galleryMedia).where(and(eq(galleryMedia.status,'aprovado'),eq(galleryMedia.driveStatus,'pendente'))).orderBy(asc(galleryMedia.id)).limit(10);
    return response({items:list});
  }catch{return response({error:'Não foi possível obter a fila'},500)}
}

export async function POST(request:Request){
  if(!permitted(request))return response({error:'Não autorizado'},401);
  try{
    const data=await request.json() as {id?:number;success?:boolean;fileId?:string;error?:string};
    const id=Number(data.id);if(!Number.isInteger(id)||id<1)return response({error:'ID inválido'},400);
    const db=getDb();const [item]=await db.select().from(galleryMedia).where(eq(galleryMedia.id,id));
    if(!item||item.status!=='aprovado')return response({error:'Ficheiro não encontrado ou não aprovado'},404);
    if(item.driveStatus==='sincronizado')return response({ok:true,alreadySynced:true});
    if(data.success){
      const fileId=String(data.fileId||'').trim();if(!/^[A-Za-z0-9_-]{10,200}$/.test(fileId))return response({error:'Identificador Drive inválido'},400);
      await db.update(galleryMedia).set({driveStatus:'sincronizado',driveFileId:fileId,driveError:'',driveUpdatedAt:new Date().toISOString()}).where(eq(galleryMedia.id,id));
    }else{
      await db.update(galleryMedia).set({driveStatus:'erro',driveError:String(data.error||'Falha na sincronização').slice(0,240),driveUpdatedAt:new Date().toISOString()}).where(eq(galleryMedia.id,id));
    }
    return response({ok:true});
  }catch{return response({error:'Não foi possível atualizar a sincronização'},500)}
}
