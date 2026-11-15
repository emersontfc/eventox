import { NextResponse } from 'next/server';
import { isAdmin } from '../../admin-auth';
import { getDb } from '../../../db';
import { committeeMembers, committeeTasks } from '../../../db/schema';
import { eq } from 'drizzle-orm';

export const dynamic='force-dynamic';
const error=(message:string,status=400)=>NextResponse.json({error:message},{status});
const clean=(v:unknown,max=120)=>String(v??'').trim().slice(0,max);
const validId=(id:number)=>Number.isInteger(id)&&id>0;

export async function GET(){
  if(!await isAdmin())return error('Acesso reservado ao administrador',403);
  try{const db=getDb();const [members,tasks]=await Promise.all([db.select().from(committeeMembers),db.select().from(committeeTasks)]);return NextResponse.json({members,tasks})}
  catch{return error('Não foi possível carregar a comissão.',500)}
}

export async function POST(req:Request){
  if(!await isAdmin())return error('Acesso reservado ao administrador',403);
  let body:Record<string,unknown>;try{body=await req.json()}catch{return error('Pedido inválido')}
  try{
    const db=getDb();const action=clean(body.action,30),id=Number(body.id);
    if(action==='member-save'){
      const name=clean(body.name),role=clean(body.role),area=clean(body.area,90)||'Coordenação geral',status=clean(body.status,20);
      if(!name||!role||!['ativo','inativo'].includes(status))return error('Indica nome, função e estado válidos.');
      const values={name,role,area,status,responsibilities:clean(body.responsibilities,1000),phone:clean(body.phone,50),email:clean(body.email,150)};
      if(validId(id)){const [member]=await db.select({id:committeeMembers.id}).from(committeeMembers).where(eq(committeeMembers.id,id));if(!member)return error('Membro não encontrado');await db.update(committeeMembers).set(values).where(eq(committeeMembers.id,id))}
      else await db.insert(committeeMembers).values(values);
    }else if(action==='member-delete'){
      if(!validId(id))return error('Membro inválido');
      await db.update(committeeTasks).set({memberId:null}).where(eq(committeeTasks.memberId,id));
      await db.delete(committeeMembers).where(eq(committeeMembers.id,id));
    }else if(action==='task-save'){
      const title=clean(body.title,160),memberId=Number(body.memberId)||null,dueDate=clean(body.dueDate,10),status=clean(body.status,20);
      if(!title||!['pendente','em_curso','concluida'].includes(status)||dueDate&&!/^\d{4}-\d\d-\d\d$/.test(dueDate))return error('Verifica os dados da tarefa.');
      if(memberId){const [member]=await db.select({id:committeeMembers.id}).from(committeeMembers).where(eq(committeeMembers.id,memberId));if(!member)return error('Responsável não encontrado.')}
      const values={title,memberId,dueDate,status,notes:clean(body.notes,500)};
      if(validId(id)){await db.update(committeeTasks).set(values).where(eq(committeeTasks.id,id))}
      else await db.insert(committeeTasks).values(values);
    }else if(action==='task-delete'){
      if(!validId(id))return error('Tarefa inválida');await db.delete(committeeTasks).where(eq(committeeTasks.id,id));
    }else if(action==='task-status'){
      const status=clean(body.status,20);if(!validId(id)||!['pendente','em_curso','concluida'].includes(status))return error('Estado inválido');await db.update(committeeTasks).set({status}).where(eq(committeeTasks.id,id));
    }else return error('Ação desconhecida');
    return NextResponse.json({ok:true});
  }catch(e){return error(e instanceof Error?e.message:'Erro ao guardar.',500)}
}
