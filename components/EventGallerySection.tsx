'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, Upload, Image as ImageIcon, X, Download, Share2,
  Heart, Sparkles, CheckCircle2, AlertTriangle, ExternalLink, RefreshCw, ZoomIn
} from 'lucide-react';

export interface GalleryPhoto {
  id: number;
  url: string;
  uploader: string;
  album: string;
  mime?: string;
  originalName?: string;
  createdAt: string;
}

interface EventGallerySectionProps {
  slug: string;
  photoAlbumUrl?: string | null;
  onPhotoUploaded?: () => void;
}

export default function EventGallerySection({
  slug,
  photoAlbumUrl,
  onPhotoUploaded,
}: EventGallerySectionProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState<GalleryPhoto | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<string>('todos');

  // Upload modal / form state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploaderName, setUploaderName] = useState('');
  const [albumTag, setAlbumTag] = useState('Momentos especiais');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load photos
  const loadPhotos = async () => {
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(slug)}/gallery`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json() as { photos?: GalleryPhoto[] };
      if (data.photos) setPhotos(data.photos);
    } catch {
      // Non-blocking
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (slug) {
      loadPhotos();
    }
  }, [slug]);

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadError('');

    const reader = new FileReader();
    reader.onload = () => {
      setUploadPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle submit upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Por favor seleciona uma fotografia para carregar.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('uploader', uploaderName.trim() || 'Convidado de Honra');
      formData.append('album', albumTag);

      const res = await fetch(`/api/events/${encodeURIComponent(slug)}/gallery`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json() as { ok?: boolean; photo?: GalleryPhoto; error?: string };
      if (!res.ok || !data.ok || !data.photo) {
        throw new Error(data.error || 'Erro ao carregar fotografia.');
      }

      setPhotos((prev) => [data.photo!, ...prev]);
      setUploadSuccess('✦ Fotografia adicionada com sucesso ao mural oficial!');
      setUploadFile(null);
      setUploadPreview(null);
      onPhotoUploaded?.();
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadSuccess('');
      }, 2000);
    } catch (err: any) {
      setUploadError(err.message || 'Erro ao enviar fotografia.');
    } finally {
      setUploading(false);
    }
  };

  // Filter photos by album
  const albums = ['todos', 'Momentos especiais', 'Cerimónia', 'Família e amigos', 'Festa e dança'];
  const filteredPhotos = selectedAlbum === 'todos'
    ? photos
    : photos.filter((p) => p.album === selectedAlbum);

  return (
    <section className="portal-gallery-section" style={{ maxWidth: '1000px', margin: '0 auto 70px', padding: '0 16px' }}>
      <div className="portal-gallery-card">
        {/* Header */}
        <div className="gallery-header">
          <span className="overline">✦ MURAL FOTOGRÁFICO & MEMÓRIAS DA NOITE</span>
          <h2>Galeria de Fotografias da Celebração</h2>
          <p>
            Capta momentos inesquecíveis durante o evento e partilha-os diretamente connosco! As fotografias ficam guardadas na galeria oficial da festa em alta resolução.
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setShowUploadModal(true)}
            className="gallery-primary-button cursor-pointer"
            style={{ padding: '12px 24px' }}
          >
            <Camera size={20} />
            <span>Adicionar Foto da Festa 📸</span>
          </button>

          {photoAlbumUrl && (
            <a
              href={photoAlbumUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="gallery-secondary-button"
              style={{ padding: '12px 20px' }}
            >
              <ExternalLink size={16} />
              <span>Ver Álbum no Google Fotos ↗</span>
            </a>
          )}
        </div>

        {/* Album filters pills */}
        {photos.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            {albums.map((alb) => (
              <button
                key={alb}
                onClick={() => setSelectedAlbum(alb)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  selectedAlbum === alb
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {alb === 'todos' ? 'Todas as Fotos' : alb}
              </button>
            ))}
          </div>
        )}

        {/* Photo Grid Showcase */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-400">
            <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
            <p className="text-xs">A carregar fotos do evento...</p>
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="gallery-empty-state" style={{ padding: '40px 20px' }}>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
              <Camera size={28} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px', color: '#3d2531' }}>
              A galeria está à espera dos primeiros flashes!
            </h3>
            <p style={{ fontSize: '13px', color: '#7a6870', maxWidth: '420px', margin: '0 auto 16px' }}>
              Tira uma fotografia com o teu telemóvel e publica aqui para todos os convidados verem.
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="primary-button cursor-pointer"
              style={{ fontSize: '13px', padding: '10px 22px' }}
            >
              Publicar a Primeira Foto 📸
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {filteredPhotos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => setActivePhoto(photo)}
                className="group relative aspect-square overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-900 cursor-pointer shadow-sm hover:shadow-lg transition-all duration-300"
              >
                <img
                  src={photo.url}
                  alt={photo.originalName || 'Fotografia do evento'}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Hover Overlay with uploader and zoom icon */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-2.5 text-white">
                  <div className="flex justify-end">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                      <ZoomIn size={13} />
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-300 truncate">
                      {photo.album}
                    </span>
                    <strong className="block text-xs font-semibold truncate">
                      {photo.uploader}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LIGHTBOX / FULLSCREEN PHOTO PREVIEW MODAL */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-md"
          onClick={() => setActivePhoto(null)}
        >
          <div
            className="relative max-h-[92vh] max-w-4xl overflow-hidden rounded-2xl bg-neutral-950 border border-white/10 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-neutral-900/80">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400">
                  {activePhoto.album}
                </span>
                <h4 className="text-sm font-bold text-white">
                  Por {activePhoto.uploader}
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={activePhoto.url}
                  download={activePhoto.originalName || 'eventox-foto.jpg'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-300 bg-white/10 hover:bg-white/20 transition"
                  title="Descarregar foto em alta qualidade"
                >
                  <Download size={14} />
                  <span>Descarregar</span>
                </a>

                <button
                  onClick={() => setActivePhoto(null)}
                  className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Photo View */}
            <div className="flex flex-1 items-center justify-center bg-black p-2 overflow-hidden">
              <img
                src={activePhoto.url}
                alt={activePhoto.uploader}
                className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD PHOTO MODAL */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-neutral-950 border border-amber-500/40 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <Camera className="text-amber-400" size={20} />
                <h3 className="text-base font-bold text-white">Adicionar Fotografia</h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="rounded-lg p-1 text-neutral-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {uploadError && (
              <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs text-rose-300">
                {uploadError}
              </div>
            )}

            {uploadSuccess && (
              <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3 text-xs text-emerald-300">
                {uploadSuccess}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="flex flex-col gap-4">
              {/* Image Picker Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-500/40 bg-neutral-900/60 p-6 text-center cursor-pointer hover:border-amber-400 hover:bg-neutral-900 transition"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,video/mp4"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {uploadPreview ? (
                  <div className="relative max-h-48 w-full overflow-hidden rounded-lg">
                    <img
                      src={uploadPreview}
                      alt="Pré-visualização"
                      className="mx-auto max-h-48 w-auto rounded-lg object-contain"
                    />
                    <span className="mt-2 block text-xs text-amber-300">
                      Clica para escolher outra imagem
                    </span>
                  </div>
                ) : (
                  <>
                    <Upload size={32} className="text-amber-400 mb-2" />
                    <span className="text-sm font-semibold text-white">
                      Clica para escolher uma foto do telemóvel
                    </span>
                    <span className="text-xs text-neutral-400 mt-1">
                      Suporta JPG, PNG, WebP (até 15 MB)
                    </span>
                  </>
                )}
              </div>

              {/* Uploader Name */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  O Teu Nome *
                </label>
                <input
                  type="text"
                  required
                  value={uploaderName}
                  onChange={(e) => setUploaderName(e.target.value)}
                  placeholder="Ex.: Dra. Isabel"
                  className="w-full rounded-xl border border-white/15 bg-neutral-900 px-3.5 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* Album Category */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Categoria da Fotografia
                </label>
                <select
                  value={albumTag}
                  onChange={(e) => setAlbumTag(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-neutral-900 px-3.5 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="Momentos especiais">Momentos especiais</option>
                  <option value="Cerimónia">Cerimónia Solene</option>
                  <option value="Família e amigos">Família & Amigos</option>
                  <option value="Festa e dança">Festa & Pista de Dança</option>
                </select>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-neutral-400 hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="primary-button cursor-pointer"
                  style={{ padding: '10px 20px', fontSize: '13px' }}
                >
                  {uploading ? 'A enviar...' : '✦ Publicar Fotografia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
