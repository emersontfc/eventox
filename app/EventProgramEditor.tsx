'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import ProgramTimeline from '../components/ProgramTimeline';
import type { ProgramItem } from '../lib/event-program';

type EditorItem = ProgramItem & { key: number };
type Program = { draft: ProgramItem[]; published: ProgramItem[] };
type View = 'edit' | 'preview' | 'published';

const snapshot = (items: ProgramItem[]) => JSON.stringify(items.map(({ time, title, description }) => ({ time, title, description })));

export default function EventProgramEditor({ slug, onDirtyChange }: {
  slug: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const endpoint = `/api/events/${encodeURIComponent(slug)}/program`;
  const [items, setItems] = useState<EditorItem[] | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null);
  const [view, setView] = useState<View>('edit');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const nextKey = useRef(0);
  const focusKey = useRef<number | null>(null);
  const form = useRef<HTMLFormElement>(null);

  const dirty = Boolean(items && program && snapshot(items) !== snapshot(program.draft));
  const differsFromPublic = Boolean(items && program && snapshot(items) !== snapshot(program.published));
  const valid = items?.every(item => /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time) && item.title.trim());

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const data = await response.json() as Program & { error?: string };
        if (!response.ok) throw new Error(data.error);
        setProgram(data);
        setItems(data.draft.map(item => ({ ...item, key: nextKey.current++ })));
      })
      .catch(() => { if (!controller.signal.aborted) setError('Não foi possível carregar o programa.'); });
    return () => controller.abort();
  }, [endpoint, loadAttempt]);

  useEffect(() => {
    onDirtyChange(dirty);
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (focusKey.current === null) return;
    form.current?.querySelector<HTMLInputElement>(`[data-program-time="${focusKey.current}"]`)?.focus();
    focusKey.current = null;
  }, [items]);

  function update(next: EditorItem[]) {
    setItems(next);
    setNotice('');
  }

  async function save(publish: boolean) {
    if (!items || busy) return;
    if (!valid) {
      setView('edit');
      setError('Preenche a hora e o título de cada momento.');
      return;
    }

    setBusy(publish ? 'publish' : 'draft');
    setError('');
    setNotice('');
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: JSON.parse(snapshot(items)), publish }),
      });
      const data = await response.json() as Program & { error?: string };
      if (!response.ok) throw new Error(data.error);
      setProgram(data);
      setItems(data.draft.map((item, index) => ({ ...item, key: items[index].key })));
      setNotice(publish ? 'O convite já mostra a versão publicada.' : 'Rascunho guardado.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível guardar.');
    } finally {
      setBusy(null);
    }
  }

  function move(index: number, delta: number) {
    if (!items || !items[index + delta]) return;
    const next = [...items];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    update(next);
  }

  function add() {
    if (!items || items.length >= 60) return;
    const key = nextKey.current++;
    focusKey.current = key;
    setView('edit');
    update([...items, { time: '', title: '', description: '', key }]);
  }

  return (
    <section className="program-editor">
      <div className="desk-heading">
        <h1>Programa do evento</h1>
        <p>Organiza os momentos e escolhe quando aparecem no convite.</p>
      </div>
      {!items && !error && <p>A carregar programa…</p>}
      {!items && error && (
        <button className="outline" onClick={() => { setError(''); setLoadAttempt(value => value + 1); }}>Tentar novamente</button>
      )}
      {items && (
        <form ref={form} onSubmit={event => { event.preventDefault(); void save(false); }}>
          <div className="program-toolbar">
            <div className="desk-tabs" role="group" aria-label="Vista do programa">
              <button type="button" aria-pressed={view === 'edit'} onClick={() => setView('edit')}>Editar</button>
              <button type="button" aria-pressed={view === 'preview'} onClick={() => setView('preview')}>Pré-visualizar</button>
              <button type="button" aria-pressed={view === 'published'} onClick={() => setView('published')}>No convite</button>
            </div>
            <p className="program-state" role="status">
              {dirty ? 'Alterações por guardar' : differsFromPublic ? 'Rascunho guardado · aguarda publicação' :
                items.length ? 'Em dia com o convite' : 'Sem momentos publicados'}
            </p>
          </div>

          {view === 'edit' ? (
            <fieldset disabled={Boolean(busy)} className="program-fields">
              {items.length === 0 && <p className="desk-empty">Adiciona o primeiro momento do evento.</p>}
              <ol className="organizer-list program-moments">
                {items.map((item, index) => (
                  <li key={item.key}>
                    <div className="program-moment-head">
                      <strong>{item.title.trim() || 'Novo momento'}</strong>
                      <div className="program-moment-actions">
                        <button type="button" className="outline" title="Mover para cima" aria-label={`Subir momento ${index + 1}`}
                          disabled={index === 0} onClick={() => move(index, -1)}><ChevronUp size={18} /></button>
                        <button type="button" className="outline" title="Mover para baixo" aria-label={`Descer momento ${index + 1}`}
                          disabled={index === items.length - 1} onClick={() => move(index, 1)}><ChevronDown size={18} /></button>
                        <button type="button" className="outline" title="Remover momento" aria-label={`Remover momento ${index + 1}`}
                          onClick={() => update(items.filter(row => row.key !== item.key))}><Trash2 size={17} /></button>
                      </div>
                    </div>
                    <div className="program-item-fields">
                      <label className="field">Hora
                        <input data-program-time={item.key} type="time" required value={item.time}
                          onChange={event => update(items.map(row => row.key === item.key ? { ...row, time: event.target.value } : row))} />
                      </label>
                      <label className="field">Título
                        <input required maxLength={120} value={item.title} placeholder="Ex.: Boas-vindas"
                          onChange={event => update(items.map(row => row.key === item.key ? { ...row, title: event.target.value } : row))} />
                      </label>
                      <label className="field">Descrição
                        <textarea rows={2} maxLength={500} value={item.description} placeholder="Opcional"
                          onChange={event => update(items.map(row => row.key === item.key ? { ...row, description: event.target.value } : row))} />
                      </label>
                    </div>
                  </li>
                ))}
              </ol>
              <button type="button" className="outline program-add" disabled={items.length >= 60} onClick={add}><Plus size={17} /> Adicionar momento</button>
            </fieldset>
          ) : (
            <div className="program-preview">
              <h2>{view === 'published' ? 'Programa visível no convite' : 'Prévia das alterações'}</h2>
              <ProgramTimeline items={view === 'published' ? program?.published ?? [] : items} />
            </div>
          )}

          <div className="program-savebar">
            <p role="status">{notice}</p>
            <button type="submit" className="outline" disabled={Boolean(busy) || !dirty}>{busy === 'draft' ? 'A guardar…' : 'Guardar rascunho'}</button>
            <button type="button" className="primary" disabled={Boolean(busy) || !differsFromPublic}
              onClick={() => {
                if (items.length || window.confirm('Publicar um programa vazio no convite?')) void save(true);
              }}>{busy === 'publish' ? 'A publicar…' : 'Publicar no convite'}</button>
          </div>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
