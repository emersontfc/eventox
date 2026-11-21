'use client';

import { useState } from 'react';
import { CheckCircle2, Search, UserCheck, X } from 'lucide-react';

type Guest = { id: number; name: string; tableId: number; seat: number; status: string };
type Filter = 'todos' | 'aguardam' | 'presente';

const statusLabels: Record<string, string> = {
  pendente: 'Presença por confirmar',
  confirmado: 'Presença confirmada',
  recusado: 'Não comparece',
  presente: 'Entrada registada',
};

const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt').trim();

export default function ReceptionDesk<T extends Guest>({ guests, tables, loading, onCheckIn }: {
  guests: T[];
  tables: { id: number; name: string }[];
  loading: boolean;
  onCheckIn: (guest: T) => Promise<boolean>;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [processing, setProcessing] = useState<number | null>(null);
  const [notice, setNotice] = useState('');

  const arrived = guests.filter(guest => guest.status === 'presente').length;
  const expected = guests.filter(guest => ['confirmado', 'pendente'].includes(guest.status)).length;
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  const results = guests.filter(guest =>
    tokens.every(token => normalize(guest.name).includes(token)) &&
    (filter === 'todos' || (filter === 'presente' ? guest.status === 'presente' : ['confirmado', 'pendente'].includes(guest.status)))
  ).sort((a, b) => a.name.localeCompare(b.name, 'pt'));

  async function checkIn(guest: T) {
    setProcessing(guest.id);
    setNotice('');
    try {
      if (await onCheckIn(guest)) setNotice(`Entrada registada para ${guest.name}.`);
    } finally {
      setProcessing(null);
    }
  }

  return (
    <section className="reception-desk">
      <div className="desk-heading"><h1>Receção</h1><p>Encontra o convidado e regista a entrada.</p></div>
      <div className="desk-tabs" aria-label="Filtrar por entrada" role="group">
        <button type="button" aria-pressed={filter === 'todos'} onClick={() => setFilter('todos')}>Todos <b>{guests.length}</b></button>
        <button type="button" aria-pressed={filter === 'aguardam'} onClick={() => setFilter('aguardam')}>Aguardam entrada <b>{expected}</b></button>
        <button type="button" aria-pressed={filter === 'presente'} onClick={() => setFilter('presente')}>Já chegaram <b>{arrived}</b></button>
      </div>

      <div className="desk-search">
        <Search size={20} aria-hidden="true" />
        <input aria-label="Nome do convidado" value={query} placeholder="Pesquisar nome do convidado"
          onChange={event => setQuery(event.target.value)} />
        {query && <button type="button" aria-label="Limpar pesquisa" onClick={event => {
          event.currentTarget.parentElement?.querySelector('input')?.focus();
          setQuery('');
        }}><X size={19} /></button>}
      </div>
      {notice && <p className="desk-feedback" role="status"><CheckCircle2 size={18} />{notice}</p>}

      {loading ? <p>A carregar convidados…</p> : (
        <>
          <p className="desk-result-count" aria-live="polite">{results.length} {results.length === 1 ? 'convidado' : 'convidados'}</p>
          {results.length === 0 ? (
            <div className="desk-empty">
              <strong>{query ? 'Nenhum convidado encontrado' : 'Sem convidados neste filtro'}</strong>
              <p>{query ? 'Experimenta escrever só um dos nomes.' : 'Escolhe outro estado para consultar a lista.'}</p>
              {filter !== 'todos' && <button type="button" className="outline" onClick={() => setFilter('todos')}>Ver todos</button>}
            </div>
          ) : (
            <ul className="desk-guests">
              {results.map(guest => (
                <li key={guest.id} className="desk-guest">
                  <div className="desk-guest-info">
                    <strong>{guest.name}</strong>
                    <span>{tables.find(table => table.id === guest.tableId)?.name ?? `Mesa ${guest.tableId}`} · Lugar {guest.seat}</span>
                  </div>
                  <span className={`status ${guest.status}`}>{statusLabels[guest.status] ?? guest.status}</span>
                  {guest.status !== 'presente' && (
                    <button type="button" className="primary" disabled={processing !== null} onClick={() => checkIn(guest)}>
                      <UserCheck size={17} />{processing === guest.id ? 'A registar…' : 'Registar entrada'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
