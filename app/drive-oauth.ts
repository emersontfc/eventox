import {env} from 'cloudflare:workers';
import {eq} from 'drizzle-orm';
import {getDb} from '../db';
import {settings, galleryMedia} from '../db/schema';

const config=(name:string)=>String((env as unknown as Record<string,unknown>)[name]||'');
export const driveConfigured=()=>Boolean(config('GOOGLE_CLIENT_ID')&&config('GOOGLE_CLIENT_SECRET')&&config('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY'));
export const callbackUrl='https://emerson-graduacao-2026.onwardcello1.chatgpt.site/api/drive/callback';
export const driveScope='https://www.googleapis.com/auth/drive.file';
export const clientId=()=>config('GOOGLE_CLIENT_ID');
export const clientSecret=()=>config('GOOGLE_CLIENT_SECRET');

async function setting(key:string){const [r]=await getDb().select().from(settings).where(eq(settings.key,key));return r?.value||'';}
async function saveSetting(key:string,value:string){await getDb().insert(settings).values({key,value}).onConflictDoUpdate({target:settings.key,set:{value}});}
export async function clearDrive(){await getDb().delete(settings).where(eq(settings.key,'google-drive-refresh'));await getDb().delete(settings).where(eq(settings.key,'google-drive-folder'));}

async function aesKey(){const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(config('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY')));return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);}
function toB64(bytes:Uint8Array){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);}
function fromB64(s:string){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
async function encrypt(value:string){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},await aesKey(),new TextEncoder().encode(value));return toB64(iv)+'.'+toB64(new Uint8Array(data));}
async function decrypt(value:string){const [iv,data]=value.split('.');const decoded=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(iv)},await aesKey(),fromB64(data));return new TextDecoder().decode(decoded);}
export async function isDriveConnected(){return Boolean(driveConfigured()&&await setting('google-drive-refresh'));}
export async function storeRefreshToken(token:string){await saveSetting('google-drive-refresh',await encrypt(token));}
export async function exchangeCode(code:string){const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:clientId(),client_secret:clientSecret(),redirect_uri:callbackUrl,grant_type:'authorization_code'})});const result=await response.json() as {refresh_token?:string;error?:string};if(!response.ok||!result.refresh_token)throw Error(result.error||'O Google não devolveu autorização permanente. Tenta conectar novamente.');await storeRefreshToken(result.refresh_token);}
async function accessToken(){const token=await setting('google-drive-refresh');if(!token)throw Error('Google Drive não conectado');const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({refresh_token:await decrypt(token),client_id:clientId(),client_secret:clientSecret(),grant_type:'refresh_token'})});const value=await response.json() as {access_token?:string;error?:string};if(!response.ok||!value.access_token)throw Error(value.error||'Falha ao renovar acesso ao Google Drive');return value.access_token;}
async function driveJson(path:string,token:string,options:RequestInit={}){const response=await fetch('https://www.googleapis.com/drive/v3/'+path,{...options,headers:{Authorization:'Bearer '+token,...options.headers}});const result=await response.json() as {id?:string;error?:{message?:string}};if(!response.ok)throw Error(result.error?.message||'Erro na API Google Drive');return result;}
async function targetFolder(token:string){let id=await setting('google-drive-folder');if(id)return id;const folder=await driveJson('files?fields=id',token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Graduação Emerson Charles — 2026',mimeType:'application/vnd.google-apps.folder'})});if(!folder.id)throw Error('Não foi possível criar a pasta do Google Drive');id=folder.id;await saveSetting('google-drive-folder',id);return id;}
export async function currentDriveFolder(){return setting('google-drive-folder');}
export async function syncDriveItem(id:number){if(!await isDriveConnected())return false;const db=getDb();const [item]=await db.select().from(galleryMedia).where(eq(galleryMedia.id,id));if(!item||item.status!=='aprovado'||item.driveStatus==='sincronizado')return false;
  try{const token=await accessToken();const folder=await targetFolder(token);if(!env.BUCKET)throw Error('Armazenamento indisponível');const object=await env.BUCKET.get(item.key);if(!object)throw Error('Ficheiro não encontrado no armazenamento');const name=`Graduacao-${item.id}-${item.originalName.replace(/[\/\\]/g,'_')}`;
    const start=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':item.mime,'X-Upload-Content-Length':String(item.size)},body:JSON.stringify({name,parents:[folder],description:`Enviado por ${item.uploader} · ${item.album}`})});
    if(!start.ok)throw Error('O Google Drive não iniciou o envio ('+start.status+')');const location=start.headers.get('location');if(!location||!location.startsWith('https://www.googleapis.com/'))throw Error('Sessão de upload inválida');
    const upload=await fetch(location,{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':item.mime,'Content-Length':String(item.size)},body:object.body});const result=await upload.json() as {id?:string;error?:{message?:string}};
    if(!upload.ok||!result.id)throw Error(result.error?.message||'Erro na transferência para o Google Drive');await db.update(galleryMedia).set({driveStatus:'sincronizado',driveFileId:result.id,driveError:'',driveUpdatedAt:new Date().toISOString()}).where(eq(galleryMedia.id,id));return true;
  }catch(e){await db.update(galleryMedia).set({driveStatus:'erro',driveError:String(e instanceof Error?e.message:e).slice(0,300),driveUpdatedAt:new Date().toISOString()}).where(eq(galleryMedia.id,id));return false;}
}
