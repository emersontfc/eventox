import {NextRequest,NextResponse} from 'next/server';
import {isAdmin} from '../../../admin-auth';
import {driveConfigured,exchangeCode} from '../../../drive-oauth';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){const url=new URL('/?drive=error',request.url);const state=request.nextUrl.searchParams.get('state');const cookie=request.cookies.get('drive-oauth-state')?.value;const code=request.nextUrl.searchParams.get('code');try{if(!await isAdmin()||!driveConfigured()||!state||!cookie||state!==cookie||!code)throw Error('Autorização inválida');await exchangeCode(code);url.searchParams.set('drive','connected');}catch{url.searchParams.set('drive','error');}const response=NextResponse.redirect(url);response.cookies.delete('drive-oauth-state');return response;}
