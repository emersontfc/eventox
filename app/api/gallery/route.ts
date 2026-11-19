import { NextResponse } from 'next/server';
import { storage } from '../../../lib/storage';
import { getDb } from '../../../db';
import { galleryMedia, settings } from '../../../db/schema';
import { isAdmin } from '../../admin-auth';
import { eq, and, gte, count } from 'drizzle-orm';
import {isDriveConnected,syncDriveItem} from '../../drive-oauth';

export const dynamic='force-dynamic';
const failure=(error:string,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
async function token(){const [s]=await getDb().select().from(settings).where(eq(settings.key,'gallery-token'));return s?.value||''}
async function authorized(value:string){const saved=await token();return Boolean(saved&&value===saved)}
const keyOf=(url:string)=>new URL(url).searchParams.get('key')||'';

export async function GET(request:Request){
  try{const admin=await isAdmin();const valid=admin||await authorized(keyOf(request.url));if(!valid)return failure('Link inválido ou galeria ainda não ativada.',403);
    const db=getDb();const records=await db.select({id:galleryMedia.id,mime:galleryMedia.mime,originalName:galleryMedia.originalName,uploader:galleryMedia.uploader,album:galleryMedia.album,status:galleryMedia.status,createdAt:galleryMedia.createdAt,size:galleryMedia.size,driveStatus:galleryMedia.driveStatus,driveFileId:galleryMedia.driveFileId,driveError:galleryMedia.driveError}).from(galleryMedia);
    return NextResponse.json({media:admin?records:records.filter((x: any)=>x.status==='aprovado'),admin,inviteKey:admin?await token():null},{headers:{'Cache-Control':'no-store'}})
  }catch{return failure('Não foi possível carregar a galeria.',500)}
}

export async function POST(request:Request){
  const admin=await isAdmin();
  const contentType=request.headers.get('content-type')||'';
  try{
    const db=getDb();
    if(contentType.includes('application/json')){
      if(!admin)return failure('Acesso reservado ao administrador.',403);
      const body=await request.json() as {action?:string;id?:number;status?:string};
      if(body.action==='create-link'){
        let invite=await token();if(!invite){invite=Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,'0')).join('');await db.insert(settings).values({key:'gallery-token',value:invite}).onConflictDoNothing();}
        return NextResponse.json({ok:true,inviteKey:await token()});
      }
      const id=Number(body.id);if(!Number.isInteger(id)||id<1)return failure('Ficheiro inválido.');
      const [item]=await db.select().from(galleryMedia).where(eq(galleryMedia.id,id));if(!item)return failure('Ficheiro não encontrado.',404);
      if(body.action==='moderate'){
        if(!['aprovado','rejeitado','pendente'].includes(body.status||''))return failure('Estado inválido.');
        await db.update(galleryMedia).set({status:body.status, ...(body.status==='aprovado'&&item.driveStatus!=='sincronizado'?{driveStatus:'pendente',driveError:''}:{})}).where(eq(galleryMedia.id,id));
        if(body.status==='aprovado'&&item.driveStatus!=='sincronizado'&&await isDriveConnected())await syncDriveItem(id);
      }else if(body.action==='delete'){
        await storage.delete(item.key);await db.delete(galleryMedia).where(eq(galleryMedia.id,id));
      }else return failure('Ação desconhecida.');
      return NextResponse.json({ok:true});
    }
    if(!contentType.includes('multipart/form-data'))return failure('Formato de envio inválido.');
    const form=await request.formData(), invite=String(form.get('key')||'');
    if(!admin&&!await authorized(invite))return failure('Link de convite inválido.',403);
    if(form.get('consent')!=='yes')return failure('É necessário confirmar o consentimento para a partilha.');
    const file=form.get('file');if(!(file instanceof File))return failure('Seleciona uma fotografia ou vídeo.');
    const allowed=new Set(['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/webm','video/quicktime']);
    if(!allowed.has(file.type))return failure('Formato não suportado. Usa JPG, PNG, WebP, HEIC, MP4, WebM ou MOV.');
    if(file.size<1||file.size>(file.type.startsWith('video/')?50_000_000:12*1024*1024))return failure('Limite: 12 MB por fotografia ou 50 MB por vídeo.');
    const uploader=String(form.get('name')||'').trim().slice(0,100),album=String(form.get('album')||'Momentos especiais').slice(0,70);
    if(uploader.length<2)return failure('Indica o teu nome.');
    if(!['Cerimónia','Família e amigos','Festa e dança','Momentos especiais'].includes(album))return failure('Álbum inválido.');
    const ip=request.headers.get('cf-connecting-ip')||'unknown';const hashed=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip)))).map(x=>x.toString(16).padStart(2,'0')).join('');
    const cutoff=new Date(Date.now()-60*60*1000).toISOString();const [quota]=await db.select({n:count()}).from(galleryMedia).where(and(eq(galleryMedia.ipHash,hashed),gte(galleryMedia.createdAt,cutoff)));
    if(!admin&&Number(quota.n)>=20)return failure('Limite de 20 ficheiros por hora atingido. Tenta novamente mais tarde.',429);
    const data=await file.arrayBuffer();const bytes=new Uint8Array(data);
    const signatureOk=file.type==='image/jpeg'?(bytes[0]===255&&bytes[1]===216):file.type==='image/png'?(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71):file.type==='image/webp'?(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'):file.type==='video/webm'?(bytes[0]===26&&bytes[1]===69):['video/mp4','video/quicktime','image/heic'].includes(file.type)?String.fromCharCode(...bytes.slice(4,8))==='ftyp':false;
    if(!signatureOk)return failure('O ficheiro não corresponde ao formato declarado.');
    const suffix:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'};
    const path=`graduacao-memorias/${crypto.randomUUID()}.${suffix[file.type]}`;
    await storage.put(path,data,{httpMetadata:{contentType:file.type}});
    try{await db.insert(galleryMedia).values({key:path,mime:file.type,size:file.size,originalName:file.name.slice(0,160),uploader,album,status:'pendente',createdAt:new Date().toISOString(),ipHash:hashed})}
    catch(e){await storage.delete(path);throw e}
    return NextResponse.json({ok:true,message:'Recebido! A fotografia ou vídeo será analisado antes da publicação.'});
  }catch{return failure('Não foi possível concluir o envio.',500)}
}
