'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BookOpen, Camera, Check, Download, Heart, Send, X } from 'lucide-react';
import { GUESTBOOK_PHOTO_MAX_BYTES, safeGuestbookPhoto } from '../lib/guestbook';
import './guestbook-mural.css';

type Dedication = {
  id: number;
  senderName: string;
  relationship: string | null;
  message: string;
  photoUrl: string | null;
  status: string;
  featured: boolean;
  createdAt: string;
};
const dates = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', timeZone: 'Africa/Maputo' });
const statusLabels: Record<string, string> = { aprovado: 'Publicada', pendente: 'Pendente', rejeitado: 'Oculta' };

export default function GuestbookMural({ slug, allowModeration = false, headingLevel = 2 }: {
  slug: string;
  allowModeration?: boolean;
  headingLevel?: 1 | 2;
}) {
  const base = `/api/events/${encodeURIComponent(slug)}/guestbook`;
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const [messages, setMessages] = useState<Dedication[]>([]);
  const [volumes, setVolumes] = useState(0);
  const [canModerate, setCanModerate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [sending, setSending] = useState(false);
  const [mutating, setMutating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    const controller = new AbortController();
    let next: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        if (document.hidden) return;
        const response = await fetch(allowModeration ? base : `${base}?visibilidade=publicada`, {
          cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) throw new Error('Não foi possível carregar o mural.');
        const data = await response.json() as { messages: Dedication[]; bookVolumes: number; canModerate: boolean };
        if (controller.signal.aborted) return;
        setMessages(data.messages);
        setVolumes(data.bookVolumes);
        setCanModerate(Boolean(data.canModerate));
        setLoadError('');
        setLoading(false);
      } catch {
        if (controller.signal.aborted) return;
        setLoadError('Não foi possível atualizar as dedicatórias.');
        setLoading(false);
      } finally {
        if (!controller.signal.aborted) next = setTimeout(poll, 5000);
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(next);
    };
  }, [allowModeration, base, refresh]);

  function removePhoto() {
    setPhoto(null);
    setPreview('');
    if (inputRef.current) inputRef.current.value = '';
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (photo) data.set('photo', photo);
    else data.delete('photo');
    setSending(true);
    setFeedback(null);
    try {
      const response = await fetch(base, { method: 'POST', body: data });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível enviar a dedicatória.');
      (form.elements.namedItem('message') as HTMLTextAreaElement).focus();
      setText('');
      removePhoto();
      setFeedback({ message: 'Dedicatória enviada. A organização vai revê-la antes de a publicar.' });
      setRefresh(value => value + 1);
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : 'Não foi possível enviar a dedicatória.', error: true });
    } finally {
      setSending(false);
    }
  }

  async function moderate(id: number, status: 'aprovado' | 'rejeitado') {
    setMutating(id);
    setFeedback(null);
    try {
      const response = await fetch(base, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: id, status }),
      });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error || 'Não foi possível moderar a dedicatória.');
      }
      setRefresh(value => value + 1);
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : 'Não foi possível moderar a dedicatória.', error: true });
    } finally {
      setMutating(null);
    }
  }

  return (
    <section className="guestbook-mural">
      <header className="guestbook-mural-head">
        <div>
          <Heading>Mural de dedicatórias</Heading>
          <p>Partilha uma memória, uma fotografia ou algumas palavras para o anfitrião.</p>
        </div>
        {volumes > 0 && (
          <div className="guestbook-book">
            <span><BookOpen size={18} aria-hidden="true" /> Livro de recordações</span>
            <div>
              {Array.from({ length: volumes }, (_, index) => (
                <a key={index} href={`${base}/book?volume=${index + 1}`} download>
                  <Download size={16} aria-hidden="true" /> {volumes === 1 ? 'Descarregar PDF' : `Volume ${index + 1}`}
                </a>
              ))}
            </div>
          </div>
        )}
      </header>

      <form className="guestbook-mural-form" onSubmit={submit}>
        <h3><Heart size={19} aria-hidden="true" /> Deixar uma dedicatória</h3>
        <div className="guestbook-mural-fields">
          <label>
            O teu nome
            <input name="senderName" autoComplete="name" minLength={2} maxLength={80} required />
          </label>
          <label>
            Ligação ao anfitrião
            <select name="relationship" defaultValue="Convidado(a)">
              {['Convidado(a)', 'Família', 'Amigo(a)', 'Colega', 'Professor(a)', 'Padrinho / Madrinha'].map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Mensagem
          <textarea name="message" rows={4} minLength={3} maxLength={500} value={text} required
            onChange={event => setText(event.target.value)} placeholder="Uma memória que guardas deste dia…" />
        </label>
        <span className="guestbook-mural-counter">{text.length}/500 caracteres</span>
        <div className="guestbook-mural-photo">
          <label>
            <span><Camera size={18} aria-hidden="true" /> Foto opcional</span>
            <input ref={inputRef} type="file" name="photo" accept="image/jpeg,image/png" onChange={event => {
              const file = event.target.files?.[0];
              setFeedback(null);
              if (!file) return removePhoto();
              if (file.size > GUESTBOOK_PHOTO_MAX_BYTES || (file.type && !['image/jpeg', 'image/png'].includes(file.type))) {
                removePhoto();
                setFeedback({ message: 'Escolhe uma foto JPG ou PNG de até 8 MB.', error: true });
                return;
              }
              setPhoto(file);
            }} />
          </label>
          {preview && photo && (
            <div className="guestbook-mural-preview">
              <img src={preview} alt="Prévia da foto escolhida" />
              <button type="button" aria-label="Remover foto" onClick={removePhoto}><X size={18} aria-hidden="true" /></button>
            </div>
          )}
        </div>
        <div className="guestbook-mural-send">
          <p>A dedicação e a foto passam pela mesma aprovação.</p>
          <button type="submit" disabled={sending}><Send size={16} aria-hidden="true" /> {sending ? 'A enviar…' : 'Enviar dedicatória'}</button>
        </div>
        {feedback && <p className={feedback.error ? 'guestbook-feedback-error' : 'guestbook-feedback'} role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
      </form>

      <section className="guestbook-dedications">
        <h3>Dedicatórias</h3>
        {loading && <p role="status">A carregar as dedicatórias…</p>}
        {loadError && (
          <p role="status">{loadError} <button type="button" onClick={() => setRefresh(value => value + 1)}>Tentar de novo</button></p>
        )}
        {!loading && !loadError && !messages.length && <p>Ainda não há dedicatórias publicadas.</p>}
        <div className="guestbook-dedications-grid">
          {messages.map(item => {
            const url = safeGuestbookPhoto(slug, item.photoUrl);
            const date = new Date(item.createdAt);
            return (
              <article key={item.id} className="guestbook-dedication" data-featured={item.featured || undefined}>
                {url && <img src={url} alt={`Fotografia enviada por ${item.senderName}`} loading="lazy" />}
                <div className="guestbook-dedication-copy">
                  <blockquote>{item.message}</blockquote>
                  <div className="guestbook-dedication-meta">
                    <div><strong>{item.senderName}</strong>{item.relationship && <span>{item.relationship}</span>}</div>
                    {Number.isFinite(date.getTime()) && <time dateTime={item.createdAt}>{dates.format(date)}</time>}
                  </div>
                  {canModerate && (
                    <div className="guestbook-dedication-actions">
                      <span>{statusLabels[item.status] || item.status}</span>
                      {item.status !== 'aprovado' && <button type="button" disabled={mutating !== null} onClick={() => moderate(item.id, 'aprovado')}><Check size={15} aria-hidden="true" /> Aprovar</button>}
                      {item.status !== 'rejeitado' && <button type="button" disabled={mutating !== null} onClick={() => moderate(item.id, 'rejeitado')}>Ocultar</button>}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
