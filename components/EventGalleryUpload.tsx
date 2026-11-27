'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { CheckCircle2, FileImage, FileVideo, Upload, X } from 'lucide-react';
import { galleryFileIssue, galleryFileMime, galleryMimeExtensions } from '../lib/gallery-uploads';
import EventGalleryDialog from './EventGalleryDialog';

const fileLimit = 12;
const accepted = [...Object.keys(galleryMimeExtensions), '.heic', '.heif'].join(',');

type Entry = {
  id: string;
  file: File;
  state: 'waiting' | 'uploading' | 'done' | 'failed';
  progress: number;
  error?: string;
};

export default function EventGalleryUpload({ endpoint, albums, activeAlbum, onClose, onUploaded }: {
  endpoint: string;
  albums: readonly string[];
  activeAlbum: string;
  onClose: () => void;
  onUploaded?: () => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [album, setAlbum] = useState(activeAlbum || albums[0]);
  const [uploader, setUploader] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const [started, setStarted] = useState(false);
  const request = useRef<XMLHttpRequest | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);

  const waiting = entries.filter(entry => entry.state === 'waiting');
  const failed = entries.filter(entry => entry.state === 'failed');
  const done = entries.filter(entry => entry.state === 'done');

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!files.length) return;
    const next = [...entries];
    const warnings = [];
    for (const file of files) {
      if (next.length >= fileLimit) {
        warnings.push(`Podes adicionar até ${fileLimit} ficheiros por envio.`);
        break;
      }
      const issue = galleryFileIssue(file);
      if (issue) {
        warnings.push(`${file.name}: ${issue}`);
        continue;
      }
      if (next.some(entry => entry.file.name === file.name && entry.file.size === file.size && entry.file.lastModified === file.lastModified)) continue;
      next.push({ id: crypto.randomUUID(), file, state: 'waiting', progress: 0 });
    }
    setEntries(next);
    setSelectionError(warnings.join(' '));
  }

  function changeEntry(id: string, patch: Partial<Entry>) {
    setEntries(previous => previous.map(entry => entry.id === id ? { ...entry, ...patch } : entry));
  }

  function upload(entry: Entry) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      request.current = xhr;
      xhr.open('POST', endpoint);
      xhr.responseType = 'json';
      xhr.timeout = 180_000;
      xhr.upload.onprogress = event => {
        if (event.lengthComputable) {
          changeEntry(entry.id, { progress: Math.min(99, Math.round(event.loaded / event.total * 100)) });
        }
      };
      xhr.onload = () => {
        const data = xhr.response as { ok?: boolean; error?: string } | null;
        if (xhr.status >= 200 && xhr.status < 300 && data?.ok) resolve();
        else reject(new Error(data?.error || (xhr.status === 413 ? 'O ficheiro é demasiado grande para enviar.' : 'Não foi possível enviar o ficheiro.')));
      };
      xhr.onerror = () => reject(new Error('A ligação falhou durante o envio.'));
      xhr.ontimeout = () => reject(new Error('O servidor demorou a responder.'));
      xhr.onabort = () => reject(new Error('Envio interrompido.'));
      const form = new FormData();
      form.append('file', entry.file);
      form.append('uploadId', entry.id);
      form.append('uploader', uploader.trim());
      form.append('album', album);
      xhr.send(form);
    });
  }

  async function send(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    const pending = waiting.length ? waiting : failed;
    if (busy || !pending.length || !uploader.trim()) return;
    setBusy(true);
    setStarted(true);
    let sent = 0;
    for (const entry of pending) {
      if (!mounted.current) break;
      changeEntry(entry.id, { state: 'uploading', progress: 0, error: undefined });
      try {
        await upload(entry);
        if (!mounted.current) break;
        changeEntry(entry.id, { state: 'done', progress: 100 });
        sent++;
      } catch (error) {
        if (!mounted.current) break;
        changeEntry(entry.id, { state: 'failed', error: error instanceof Error ? error.message : 'O envio falhou.' });
      }
    }
    request.current = null;
    if (mounted.current) {
      setBusy(false);
      if (sent) onUploaded?.();
    }
  }

  return (
    <EventGalleryDialog label="Enviar fotos e vídeos" onClose={onClose} busy={busy}>
      <form className="event-media-upload" onSubmit={send}>
        <p>Os ficheiros aparecem na galeria após aprovação da equipa.</p>
        <div className="event-media-upload-fields">
          <label>O teu nome <input value={uploader} onChange={event => setUploader(event.target.value)}
            required maxLength={80} disabled={busy || started} /></label>
          <label>Álbum <select value={album} onChange={event => setAlbum(event.target.value)} disabled={busy || started}>
            {albums.map(name => <option key={name}>{name}</option>)}
          </select></label>
        </div>
        <label className="event-media-picker">
          <Upload size={19} aria-hidden="true" />
          <span><strong>Escolher ficheiros</strong><small>Até 12 por envio · fotos até 15 MB · vídeos até 50 MB</small></span>
          <input type="file" accept={accepted} multiple onChange={choose} disabled={busy || entries.length >= fileLimit} />
        </label>
        {selectionError && <p className="event-media-error" role="alert">{selectionError}</p>}
        {entries.length > 0 && (
          <ul className="event-media-upload-list" aria-label="Ficheiros selecionados">
            {entries.map(entry => {
              const Icon = galleryFileMime(entry.file)?.startsWith('video/') ? FileVideo : FileImage;
              return (
                <li key={entry.id} className="event-media-upload-entry">
                  <Icon size={17} aria-hidden="true" />
                  <div className="event-media-upload-info">
                    <strong>{entry.file.name}</strong>
                    {entry.state === 'uploading' && (
                      <progress value={entry.progress} max={100} aria-label={`Envio de ${entry.file.name}`} />
                    )}
                    {entry.state === 'done' && <small><CheckCircle2 size={14} /> Enviado para aprovação</small>}
                    {entry.state === 'failed' && <small className="event-media-error">{entry.error}</small>}
                  </div>
                  {entry.state !== 'done' && (
                    <button type="button" aria-label={`Remover ${entry.file.name}`} className="event-media-icon"
                      disabled={busy} onClick={() => setEntries(previous => previous.filter(item => item.id !== entry.id))}><X size={16} /></button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {done.length > 0 && <p className="event-media-upload-success" role="status">
          {done.length === 1 ? '1 ficheiro enviado para aprovação.' : `${done.length} ficheiros enviados para aprovação.`}
        </p>}
        <div className="event-media-actions">
          {waiting.length === 0 && failed.length === 0 && done.length > 0
            ? <button type="button" className="event-media-primary" onClick={onClose}>Concluir</button>
            : <button type="submit" className="event-media-primary" disabled={busy || (!waiting.length && !failed.length) || !uploader.trim()}>
              {busy ? 'A enviar…' : waiting.length ? 'Enviar ficheiros' : 'Repetir os envios falhados'}
            </button>}
        </div>
      </form>
    </EventGalleryDialog>
  );
}
