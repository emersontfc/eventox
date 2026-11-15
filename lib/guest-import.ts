export type ImportTable = {id:number;name:string;capacity:number};
export type ImportGuest = {name:string;phone:string;tableId:number;seat:number;status:string;notes:string};
const norm=(s:string)=>s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function parseGuestList(text:string): string[][] {
  text=text.replace(/^\uFEFF/,'').trim();
  if(!text) return [];
  const first=text.split(/\r?\n/)[0];
  const delimiter=first.includes('\t')?'\t':first.includes(';')?';':',';
  const rows:string[][]=[]; let row:string[]=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) {const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===delimiter&&!quoted){row.push(cell.trim());cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw Error('Aspas não fechadas na lista. Verifica o ficheiro CSV.');
  row.push(cell.trim());if(row.some(Boolean))rows.push(row);
  return rows;
}
export function planGuestImport(text:string,tables:ImportTable[],existing:ImportGuest[],skipDuplicates=true){
  const rows=parseGuestList(text);
  if(rows.length>501)throw Error('Importa no máximo 500 linhas de cada vez.');
  let columns=['nome','telefone','mesa','lugar','estado','notas'];
  if(['nome','name','convidado'].includes(norm(rows[0]?.[0]||''))) columns=rows.shift()!.map(norm);
  const used=new Set(existing.map(g=>`${g.tableId}:${g.seat}`));
  const seen=new Set(existing.map(g=>norm(g.name)));
  const records:ImportGuest[]=[];const errors:string[]=[];let skipped=0;
  // Reserve explicitly requested seats before assigning automatic places.
  const prepared=rows.map((r,i)=>{const get=(key:string)=>r[columns.indexOf(key)]||'';return {line:i+1,name:get('nome')||get('name')||get('convidado'),phone:get('telefone'),table:get('mesa'),seat:get('lugar'),status:get('estado'),notes:get('notas')};});
  const reserved=new Set(prepared.filter(r=>r.table&&r.seat).map(r=>{const t=tables.find(t=>String(t.id)===r.table||norm(t.name)===norm(r.table));return `${t?.id}:${Number(r.seat)}`;}));
  for(const r of prepared){
    const fail=(m:string)=>errors.push(`Linha ${r.line}: ${m}`);
    if(!r.name||r.name.length>120){fail('nome obrigatório, até 120 caracteres.');continue;}
    if(skipDuplicates&&seen.has(norm(r.name))){skipped++;continue;}
    if(r.phone.length>50||r.notes.length>500){fail('telefone ou notas demasiado longos.');continue;}
    const status=({'a aguardar':'pendente','confirmado':'confirmado','nao comparece':'recusado','presente':'presente','pendente':'pendente','recusado':'recusado'} as Record<string,string>)[norm(r.status)||'pendente'];
    if(!status){fail('estado inválido.');continue;}
    const table=r.table?tables.find(t=>String(t.id)===r.table||norm(t.name)===norm(r.table)):undefined;
    if(r.table&&!table){fail('mesa não encontrada.');continue;}
    if(r.seat&&!table){fail('indica a mesa para escolher um lugar.');continue;}
    let selected:ImportTable|undefined, seat=0;
    for(const t of table?[table]:tables){for(let n=1;n<=t.capacity;n++){if(r.seat&&Number(r.seat)!==n)continue;const key=`${t.id}:${n}`;if(!used.has(key)&&(!!r.seat||!reserved.has(key))){selected=t;seat=n;break;}}if(selected)break;}
    if(!selected){fail(r.seat?'lugar inválido ou ocupado.':'não há lugares livres na mesa ou no evento.');continue;}
    used.add(`${selected.id}:${seat}`);seen.add(norm(r.name));records.push({name:r.name,phone:r.phone,tableId:selected.id,seat,status,notes:r.notes});
  }
  return {records,errors,skipped};
}
