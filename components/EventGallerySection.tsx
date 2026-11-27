'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, Download, ExternalLink, Film, ImageOff, Plus } from 'lucide-react';
import { galleryMoments } from '../lib/gallery-uploads';
import EventGalleryDialog from './EventGalleryDialog';
import EventGalleryUpload from './EventGalleryUpload';
import './event-gallery.css';

export interface GalleryPhoto {
  id: number;
  url: string;
  uploader: string;
  album: string;
  status?: string;
  mime?: string;
  originalName?: string;
  createdAt: string;
}

type Album = { name: string; total: number };
type GalleryPage = { photos: GalleryPhoto[]; albums: Album[]; nextCursor: string | null; error?: string };

interface EventGallerySectionProps {
  slug: string;
  photoAlbumUrl?: string | null;
  onPhotoUploaded?: () => void;
}

const galleryDate = new Intl.DateTimeFormat('pt-PT', {
  dateStyle: 'medium', timeZone: 'Africa/Maputo',
});
const isVideo = (photo: GalleryPhoto) => photo.mime?.startsWith('video/');

async function getPage(endpoint: string, album: string, signal: AbortSignal, cursor?: string) {
  const query = new URLSearchParams({ visibilidade: 'publicada', limite: '16' });
  if (album) query.set('album', album);
  if (cursor) query.set('a_seguir', cursor);
  const response = await fetch(`${endpoint}?${query}`, { cache: 'no-store', signal });
  const data = await response.json() as GalleryPage;
  if (!response.ok) throw new Error(data.error || 'Não foi possível carregar a galeria.');
  return data;
}

function GalleryMediaTile({ photo, onClick }: { photo: GalleryPhoto; onClick: () => void }) {
  const [failed, setFailed] = useState(false);
  const video = isVideo(photo);
  return (
    <button type="button" className="event-media-tile" onClick={onClick}>
      <span className="event-media-preview">
        {video ? (
          <span className="event-media-placeholder"><Film size={28} aria-hidden="true" /> Vídeo</span>
        ) : failed ? (
          <span className="event-media-placeholder"><ImageOff size={26} aria-hidden="true" /> Abrir ficheiro</span>
        ) : <img src={photo.url} alt="" loading="lazy" onError={() => setFailed(true)} />}
      </span>
      <span className="event-media-tile-label">
        <strong>{photo.uploader}</strong>
        <small>{photo.album}</small>
      </span>
    </button>
  );
}

function GalleryPlayer({ photo }: { photo: GalleryPhoto }) {
  const [failed, setFailed] = useState(false);
  const label = `${isVideo(photo) ? 'Vídeo' : 'Foto'} de ${photo.uploader}`;
  return (
    <div className="event-media-viewer">
      {failed ? <p>O navegador não consegue abrir este formato. Descarrega o ficheiro para o veres no dispositivo.</p>
        : isVideo(photo)
          ? <video src={photo.url} controls playsInline preload="metadata" aria-label={label} onError={() => setFailed(true)} />
          : <img src={photo.url} alt={label} onError={() => setFailed(true)} />}
    </div>
  );
}

export default function EventGallerySection({ slug, photoAlbumUrl, onPhotoUploaded }: EventGallerySectionProps) {
  const endpoint = `/api/events/${encodeURIComponent(slug)}/gallery`;
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [activePhoto, setActivePhoto] = useState<GalleryPhoto | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const moreRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    moreRequest.current?.abort();
    moreRequest.current = null;
    const controller = new AbortController();
    setLoading(true);
    setLoadingMore(false);
    setError('');
    setCursor(null);
    getPage(endpoint, selectedAlbum, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return;
        setPhotos(data.photos);
        setAlbums(data.albums);
        setCursor(data.nextCursor);
      })
      .catch(failure => {
        if (controller.signal.aborted) return;
        setError(failure.message || 'Não foi possível carregar a galeria.');
        setPhotos([]);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => {
      controller.abort();
      moreRequest.current?.abort();
    };
  }, [endpoint, selectedAlbum, reload]);

  async function loadMore() {
    if (!cursor || loadingMore || moreRequest.current) return;
    const controller = new AbortController();
    moreRequest.current = controller;
    setLoadingMore(true);
    setError('');
    try {
      const data = await getPage(endpoint, selectedAlbum, controller.signal, cursor);
      if (controller.signal.aborted) return;
      setPhotos(previous => previous.concat(data.photos.filter(item => !previous.some(visible => visible.id === item.id))));
      setAlbums(data.albums);
      setCursor(data.nextCursor);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Não foi possível carregar mais ficheiros.');
    } finally {
      if (moreRequest.current === controller) {
        moreRequest.current = null;
        setLoadingMore(false);
      }
    }
  }

  const uploadAlbums = Array.from(new Set([...galleryMoments, ...albums.map(album => album.name), ...(selectedAlbum ? [selectedAlbum] : [])]));
  const activeIndex = activePhoto ? photos.findIndex(photo => photo.id === activePhoto.id) : -1;
  const total = albums.reduce((sum, album) => sum + album.total, 0);
  const createdAt = activePhoto ? new Date(activePhoto.createdAt) : null;

  return (
    <section className="event-media-gallery" aria-label="Galeria do evento">
      <header className="event-media-header">
        <div>
          <h2>Galeria do evento</h2>
          <p>Fotos e vídeos partilhados pelos convidados.</p>
        </div>
        <div className="event-media-actions">
          {photoAlbumUrl && <a href={photoAlbumUrl} target="_blank" rel="noopener noreferrer" className="event-media-secondary">
            <ExternalLink size={16} aria-hidden="true" /> Álbum externo
          </a>}
          <button type="button" className="event-media-primary" onClick={() => setShowUpload(true)}>
            <Camera size={18} aria-hidden="true" /> Enviar fotos e vídeos
          </button>
        </div>
      </header>

      {(albums.length > 0 || selectedAlbum) && (
        <nav className="event-media-albums" aria-label="Álbuns de momentos">
          <button type="button" aria-pressed={!selectedAlbum} onClick={() => setSelectedAlbum('')}>Tudo <span>{total}</span></button>
          {uploadAlbums.filter(name => name === selectedAlbum || albums.some(album => album.name === name)).map(name => (
            <button type="button" key={name} aria-pressed={selectedAlbum === name} onClick={() => setSelectedAlbum(name)}>
              {name} <span>{albums.find(album => album.name === name)?.total ?? 0}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="event-media-body" aria-busy={loading || loadingMore}>
        {error && <p className="event-media-error" role="alert">{error}</p>}
        {loading ? <p role="status">A carregar a galeria…</p>
          : error && !photos.length ? (
            <button type="button" className="event-media-secondary" onClick={() => setReload(value => value + 1)}>Tentar novamente</button>
          ) : !photos.length ? (
            <div className="event-media-empty">
              <h3>Ainda não há ficheiros publicados{selectedAlbum ? ' neste álbum' : ''}.</h3>
              <button type="button" className="event-media-secondary" onClick={() => setShowUpload(true)}>
                <Plus size={18} aria-hidden="true" /> Partilhar um momento
              </button>
            </div>
          ) : (
            <div className="event-media-grid">
              {photos.map(photo => <GalleryMediaTile key={photo.id} photo={photo} onClick={() => setActivePhoto(photo)} />)}
            </div>
          )}
        {!loading && cursor && (
          <div className="event-media-load">
            <button type="button" className="event-media-secondary" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? 'A carregar…' : error ? 'Tentar carregar mais' : 'Carregar mais'}
            </button>
          </div>
        )}
      </div>

      {activePhoto && (
        <EventGalleryDialog label={`${isVideo(activePhoto) ? 'Vídeo' : 'Foto'} de ${activePhoto.uploader}`}
          onClose={() => setActivePhoto(null)}>
          <GalleryPlayer key={activePhoto.id} photo={activePhoto} />
          <div className="event-media-viewer-footer">
            <div>
              <strong>{activePhoto.album}</strong>
              {createdAt && !Number.isNaN(createdAt.getTime()) && <small>{galleryDate.format(createdAt)}</small>}
            </div>
            <div className="event-media-actions">
              <button type="button" className="event-media-icon" aria-label="Ficheiro anterior"
                disabled={activeIndex < 1} onClick={() => setActivePhoto(photos[activeIndex - 1])}><ChevronLeft size={20} /></button>
              <button type="button" className="event-media-icon" aria-label="Ficheiro seguinte"
                disabled={activeIndex < 0 || activeIndex >= photos.length - 1}
                onClick={() => setActivePhoto(photos[activeIndex + 1])}><ChevronRight size={20} /></button>
              <a href={activePhoto.url} download={activePhoto.originalName || `eventox-${activePhoto.id}`}
                className="event-media-secondary"><Download size={16} aria-hidden="true" /> Descarregar</a>
            </div>
          </div>
        </EventGalleryDialog>
      )}

      {showUpload && <EventGalleryUpload endpoint={endpoint} albums={uploadAlbums} activeAlbum={selectedAlbum}
        onClose={() => setShowUpload(false)} onUploaded={onPhotoUploaded} />}
    </section>
  );
}
