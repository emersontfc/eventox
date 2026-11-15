import {NextResponse} from 'next/server';
import {isAdmin} from '../../../admin-auth';
import {callbackUrl,clientId,driveConfigured,driveScope} from '../../../drive-oauth';
export const dynamic='force-dynamic';
export async function GET(){if(!await isAdmin())return NextResponse.json({error:'Acesso reservado'}, {status:403});if(!driveConfigured())return NextResponse.redirect(new URL('/?drive=configure','https://emerson-graduacao-2026.onwardcello1.chatgpt.site'));const nonce=crypto.randomUUID();const params=new URLSearchParams({client_id:clientId(),redirect_uri:callbackUrl,response_type:'code',scope:driveScope,access_type:'offline',prompt:'consent',state:nonce});const response=NextResponse.redirect('https://accounts.google.com/o/oauth2/v2/auth?'+params);response.cookies.set('drive-oauth-state',nonce,{httpOnly:true,secure:true,sameSite:'lax',path:'/api/drive',maxAge:600});return response;}
