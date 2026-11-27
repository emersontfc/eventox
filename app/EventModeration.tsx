'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Images, MessageSquareText, MonitorUp, RefreshCw } from 'lucide-react';
import { safeGuestbookPhoto } from '../lib/guestbook';
import './EventModeration.css';

type Entry = {
  id: number; title: string; content: string; status: string;
  featured: boolean; mime?: string; photoUrl?: string | null;
};
type Queue = { photos: Entry[]; messages: Entry[] };
type Action = 'approve' | 'hide' | 'feature' | 'unfeature';
const labels: Record<string, string> = { pendente: 'Pendente', aprovado: 'Publicado', rejeitado: 'Oculto' };
const pageSize = 24;

export default function EventModeration({ slug }: { slug: string }) {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [kind, setKind] = useState<keyof Queue>('photos');
  const [filter, setFilter] = useState('pendente');
  const [selection, setSelection] = useState<number[]>([]);
  const [limit, setLimit] = useState(pageSize);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef<AbortController | null>(null);
  const base = `/api/events/${encodeURIComponent(slug)}`;

  const refresh = useCallback(async (manual = false) => {
    if (pending.current) return;
    const request = new AbortController();
    pending.current = request;
    if (manual) { setRefreshing(true); setError(''); }
    try {
      const response = await fetch(`${base}/moderation`, { signal: request.signal, cache: 'no-store' });
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(failure?.error || 'Não foi possível carregar a moderação.');
      }
      const data = await response.json() as Queue;
      if (!request.signal.aborted) setQueue(data);
    } catch (failure) {
      if (manual && !request.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'Não foi possível carregar a moderação.');
      }
    } finally {
      if (pending.current === request) {
        pending.current = null;
        setRefreshing(false);
      }
    }
  }, [base]);

  useEffect(() => {
    void refresh(true);
    return () => { pending.current?.abort(); pending.current = null; };
  }, [refresh]);

  useEffect(() => {
    if (busy) return;
    const check = () => { if (document.visibilityState === 'visible') void refresh(); };
    const interval = window.setInterval(check, 4500);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
  }, [busy, refresh]);

  async function act(path: 'moderation' | 'projection', method: string, body: object, success: string) {
    pending.current?.abort();
    pending.current = null;
    setRefreshing(false);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${base}/${path}`, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(failure?.error || 'Não foi possível concluir a ação.');
      }
      setNotice(success);
      setSelection([]);
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível concluir a ação.');
    } finally {
      setBusy(false);
    }
  }

  function moderate(ids: number[], action: Action) {
    const feedback = {
      approve: 'Publicado no convite.', hide: 'Conteúdo ocultado.',
      feature: 'Destaque atualizado.', unfeature: 'Destaque removido.',
    };
    return act('moderation', 'PATCH', { ids, kind, action }, feedback[action]);
  }

  const entries = queue?.[kind].filter(item => filter === 'todos' || item.status === filter) ?? [];
  const visible = entries.slice(0, limit);
  const selected = selection.filter(id => visible.some(item => item.id === id));
  const selectAll = visible.slice(0, 50).map(item => item.id);

  return (
    <section className="event-moderation">
      <header className="desk-heading">
        <h1>Galeria e mural</h1>
        <p>Revê os envios antes de os publicar ou colocar na fila do ecrã.</p>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="desk-feedback" role="status"><Check size={17} aria-hidden="true" />{notice}</p>}
      <div className="moderation-tools">
        <div className="desk-tabs" role="group" aria-label="Tipo de conteúdo">
          {(['photos', 'messages'] as const).map(type => {
            const Icon = type === 'photos' ? Images : MessageSquareText;
            return (
              <button type="button" key={type} disabled={busy} aria-pressed={kind === type} onClick={() => {
                setKind(type); setSelection([]); setLimit(pageSize);
              }}>
                <Icon size={17} aria-hidden="true" />{type === 'photos' ? 'Fotos e vídeos' : 'Dedicatórias'}
                {queue && <b>{queue[type].filter(item => item.status === 'pendente').length} pendentes</b>}
              </button>
            );
          })}
        </div>
        <label className="field">Estado
          <select aria-label="Estado" value={filter} disabled={busy} onChange={event => {
            setFilter(event.target.value); setSelection([]); setLimit(pageSize);
          }}>
            <option value="pendente">Pendentes</option><option value="aprovado">Publicados</option>
            <option value="rejeitado">Ocultos</option><option value="todos">Todos</option>
          </select>
        </label>
        <button type="button" className="outline" disabled={busy || refreshing} onClick={() => void refresh(true)}>
          <RefreshCw size={16} aria-hidden="true" /> {refreshing ? 'A atualizar…' : 'Atualizar'}
        </button>
      </div>

      {visible.length > 0 && (
        <div className="moderation-batch">
          <button type="button" className="outline" disabled={busy} onClick={() => setSelection(selected.length ? [] : selectAll)}>
            {selected.length ? 'Limpar seleção' : 'Selecionar itens visíveis'}
          </button>
          {selected.length > 0 && (
            <>
              <span aria-live="polite">{selected.length} selecionados</span>
              <button type="button" className="primary" disabled={busy} onClick={() => void moderate(selected, 'approve')}>Publicar seleção</button>
              <button type="button" className="outline" disabled={busy} onClick={() => void moderate(selected, 'hide')}>Ocultar seleção</button>
            </>
          )}
        </div>
      )}

      {!queue && !error && <p>A carregar…</p>}
      {queue && !entries.length && <p className="desk-empty">Sem itens neste estado.</p>}
      <ul className="organizer-list moderation-list">
        {visible.map(item => {
          const photo = kind === 'messages' ? safeGuestbookPhoto(slug, item.photoUrl) : null;
          return (
          <li key={item.id}>
            <label className="moderation-select">
              <input type="checkbox" disabled={busy || (!selected.includes(item.id) && selected.length >= 50)} checked={selected.includes(item.id)}
                aria-label={`Selecionar ${item.title}`}
                onChange={event => setSelection(event.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))} />
              <span>{item.featured ? 'Em destaque' : labels[item.status]}</span>
            </label>
            {kind === 'photos' && (item.mime?.startsWith('video/')
              ? <video src={`/api/gallery/media/${item.id}`} controls preload="none" playsInline />
              : <img src={`/api/gallery/media/${item.id}`} alt={item.title} loading="lazy" />)}
            {photo && <img src={photo} alt={`Fotografia da dedicatória de ${item.title}`} loading="lazy" />}
            <strong>{item.title}</strong>
            <p>{item.content}</p>
            <div className="organizer-actions">
              {item.status !== 'aprovado' &&
                <button type="button" className="primary" disabled={busy} onClick={() => void moderate([item.id], 'approve')}>Publicar no convite</button>}
              {item.status !== 'rejeitado' &&
                <button type="button" className="outline" disabled={busy} onClick={() => void moderate([item.id], 'hide')}>Ocultar</button>}
              {item.status === 'aprovado' && (
                <>
                  <button type="button" className="outline" disabled={busy} onClick={() => void moderate([item.id], item.featured ? 'unfeature' : 'feature')}>
                    {item.featured ? 'Retirar destaque' : 'Destacar'}
                  </button>
                  <button type="button" className="outline" disabled={busy} onClick={() => void act('projection', 'POST',
                    { action: 'enqueue', kind, sourceId: item.id }, 'Conteúdo enviado à fila do ecrã.')}>
                    <MonitorUp size={16} aria-hidden="true" /> Enviar à fila do ecrã
                  </button>
                </>
              )}
            </div>
          </li>
          );
        })}
      </ul>
      {entries.length > limit &&
        <button type="button" className="outline" onClick={() => setLimit(value => value + pageSize)}>Ver mais conteúdos</button>}
    </section>
  );
}
