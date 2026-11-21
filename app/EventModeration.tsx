'use client';

import { useEffect, useState } from 'react';

type Entry = { id: number; title: string; content: string; status: string; featured: boolean; mime?: string };
type Queue = { photos: Entry[]; messages: Entry[] };
type Action = 'approve' | 'hide' | 'feature' | 'unfeature';

export default function EventModeration({ slug }: { slug: string }) {
  const endpoint = `/api/events/${encodeURIComponent(slug)}/moderation`;
  const [queue, setQueue] = useState<Queue | null>(null);
  const [kind, setKind] = useState<keyof Queue>('photos');
  const [filter, setFilter] = useState('pendente');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setQueue(data);
      })
      .catch(() => { if (!controller.signal.aborted) setError('Não foi possível carregar a moderação.'); });
    return () => controller.abort();
  }, [endpoint]);

  async function moderate(id: number, action: Action) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, kind, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setQueue(previous => previous && ({
        ...previous,
        [kind]: previous[kind].map(item => item.id === id
          ? { ...item, status: data.status, featured: data.featured } : item),
      }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível atualizar o item.');
    } finally {
      setBusy(false);
    }
  }

  const entries = queue?.[kind].filter(item => filter === 'todos' || item.status === filter) ?? [];
  return (
    <section>
      <div className="page-head"><h1>Galeria e mural</h1></div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="organizer-actions">
        <button className="outline" aria-pressed={kind === 'photos'} onClick={() => setKind('photos')}>
          Fotos ({queue?.photos.filter(item => item.status === 'pendente').length ?? '…'} pendentes)
        </button>
        <button className="outline" aria-pressed={kind === 'messages'} onClick={() => setKind('messages')}>
          Mensagens ({queue?.messages.filter(item => item.status === 'pendente').length ?? '…'} pendentes)
        </button>
        <label className="field">Estado
          <select value={filter} onChange={event => setFilter(event.target.value)}>
            <option value="pendente">Pendentes</option><option value="aprovado">Publicados</option>
            <option value="rejeitado">Ocultos</option><option value="todos">Todos</option>
          </select>
        </label>
      </div>
      {!queue && !error && <p>A carregar…</p>}
      {queue && (entries.length === 0 ? <p>Sem itens neste estado.</p> : (
        <ul className="organizer-list moderation-list">
          {entries.map(item => (
            <li key={item.id}>
              {kind === 'photos' && (item.mime?.startsWith('video/')
                ? <video src={`/api/gallery/media/${item.id}`} controls preload="none" />
                : <img src={`/api/gallery/media/${item.id}`} alt={item.title} loading="lazy" />)}
              <strong>{item.title}</strong>
              <p>{item.content}</p>
              <p>{item.featured ? 'Em destaque' : item.status}</p>
              <div className="organizer-actions">
                {item.status !== 'aprovado' &&
                  <button className="primary" disabled={busy} onClick={() => moderate(item.id, 'approve')}>Aprovar</button>}
                {item.status !== 'rejeitado' &&
                  <button className="outline" disabled={busy} onClick={() => moderate(item.id, 'hide')}>Ocultar</button>}
                {item.status === 'aprovado' &&
                  <button className="outline" disabled={busy} onClick={() => moderate(item.id, item.featured ? 'unfeature' : 'feature')}>
                    {item.featured ? 'Retirar destaque' : 'Destacar'}
                  </button>}
              </div>
            </li>
          ))}
        </ul>
      ))}
    </section>
  );
}
