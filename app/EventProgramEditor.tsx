'use client';

import { useEffect, useState } from 'react';
import type { ProgramItem } from '../lib/event-program';

export default function EventProgramEditor({ slug }: { slug: string }) {
  const endpoint = `/api/events/${encodeURIComponent(slug)}/program`;
  const [items, setItems] = useState<ProgramItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setItems(data.draft);
      })
      .catch(() => { if (!controller.signal.aborted) setError('Não foi possível carregar o programa.'); });
    return () => controller.abort();
  }, [endpoint]);

  async function save(publish: boolean) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, publish }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItems(data.draft);
      setNotice(publish ? 'Programa publicado no convite.' : 'Rascunho guardado.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível guardar.');
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, delta: number) {
    if (!items || !items[index + delta]) return;
    const next = [...items];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setItems(next);
  }

  return (
    <section>
      <div className="page-head"><h1>Programa do evento</h1></div>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!items && !error && <p>A carregar…</p>}
      {items && (
        <form onSubmit={event => { event.preventDefault(); void save(false); }}>
          <div className="organizer-actions">
            <button type="button" className="outline" disabled={busy} onClick={() => setPreview(!preview)}>{preview ? 'Voltar à edição' : 'Pré-visualizar'}</button>
            <button type="submit" className="outline" disabled={busy}>Guardar rascunho</button>
            <button type="button" className="primary" disabled={busy} onClick={event => {
              if (event.currentTarget.form?.reportValidity()) void save(true);
            }}>Publicar no convite</button>
          </div>
          {items.length === 0 && <p>O programa ainda não tem momentos.</p>}
          {preview ? (
            <ol className="organizer-list">
              {items.map((item, index) => <li key={index}><strong>{item.time} · {item.title}</strong><p>{item.description}</p></li>)}
            </ol>
          ) : (
            <fieldset disabled={busy} className="program-fields">
              <ol className="organizer-list">
                {items.map((item, index) => (
                  <li key={index}>
                    <div className="program-item-fields">
                      {(['time', 'title', 'description'] as const).map((field, position) => (
                        <label className="field" key={field}>
                          {['Hora', 'Título', 'Descrição'][position]}
                          <input type={field === 'time' ? 'time' : 'text'} required={field !== 'description'}
                            maxLength={field === 'description' ? 500 : 120} value={item[field]}
                            onChange={event => setItems(items.map((row, i) => i === index ? { ...row, [field]: event.target.value } : row))} />
                        </label>
                      ))}
                    </div>
                    <div className="organizer-actions">
                      <button type="button" className="outline" disabled={index === 0} onClick={() => move(index, -1)}>Subir</button>
                      <button type="button" className="outline" disabled={index === items.length - 1} onClick={() => move(index, 1)}>Descer</button>
                      <button type="button" className="outline" onClick={() => setItems(items.filter((_, i) => i !== index))}>Remover</button>
                    </div>
                  </li>
                ))}
              </ol>
              <button type="button" className="outline" disabled={items.length >= 60}
                onClick={() => setItems([...items, { time: '', title: '', description: '' }])}>Adicionar momento</button>
            </fieldset>
          )}
        </form>
      )}
    </section>
  );
}
