import {NextResponse} from 'next/server';
import {and,eq,ne} from 'drizzle-orm';
import {getDb} from '../../../db';
import {galleryMedia} from '../../../db/schema';
import {isAdmin} from '../../admin-auth';
import {clearDrive,currentDriveFolder,driveConfigured,isDriveConnected,syncDriveItem} from '../../drive-oauth';
export const dynamic='force-dynamic';
export async function GET(){if(!await isAdmin())return NextResponse.json({error:'Acesso reservado'},{status:403});return NextResponse.json({configured:driveConfigured(),connected:await isDriveConnected(),folderId:await currentDriveFolder()},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){if(!await isAdmin())return NextResponse.json({error:'Acesso reservado'},{status:403});const body=await request.json() as {action?:string};if(body.action==='disconnect'){await clearDrive();return NextResponse.json({ok:true});}if(body.action==='sync'){if(!await isDriveConnected())return NextResponse.json({error:'Conecta primeiro o Google Drive'},{status:400});const items=await getDb().select({id:galleryMedia.id}).from(galleryMedia).where(and(eq(galleryMedia.status,'aprovado'),ne(galleryMedia.driveStatus,'sincronizado'))).limit(3);let uploaded=0;for(const item of items)if(await syncDriveItem(item.id))uploaded++;return NextResponse.json({ok:true,uploaded,attempted:items.length});}return NextResponse.json({error:'Ação desconhecida'},{status:400});}
