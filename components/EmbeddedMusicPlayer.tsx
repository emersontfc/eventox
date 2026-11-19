'use client';

import React, { useState } from 'react';
import { Music2, X, ChevronUp, ChevronDown, Play, Sparkles, Volume2 } from 'lucide-react';
import { parseMusicEmbed, EmbedInfo } from '../lib/music-embed';

export interface PlayingSong {
  id?: number;
  title: string;
  artist?: string;
  url?: string;
}

interface EmbeddedMusicPlayerProps {
  song: PlayingSong | null;
  onClose: () => void;
  mode?: 'docked' | 'inline' | 'modal';
}

export default function EmbeddedMusicPlayer({
  song,
  onClose,
  mode = 'docked',
}: EmbeddedMusicPlayerProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!song) return null;

  const embedInfo: EmbedInfo | null = parseMusicEmbed(
    song.url,
    `${song.title} ${song.artist || ''}`
  );

  if (!embedInfo) return null;

  // INLINE MODE: Mounted directly into the container
  if (mode === 'inline') {
    return (
      <div className="w-full overflow-hidden rounded-2xl border border-amber-500/30 bg-neutral-950/90 shadow-2xl p-4 backdrop-blur-md">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <Music2 className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white tracking-wide">{song.title}</h4>
              <p className="text-xs text-amber-200/70">{song.artist || 'Música da Celebração'} · <span className="text-amber-400 font-medium">{embedInfo.sourceLabel}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white transition"
            title="Fechar leitor"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl bg-black">
          {embedInfo.type === 'audio' ? (
            <div className="p-4">
              <audio controls autoPlay src={embedInfo.embedUrl} className="w-full" />
            </div>
          ) : (
            <div className="relative aspect-video w-full">
              <iframe
                src={embedInfo.embedUrl}
                title={song.title}
                className="absolute inset-0 h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // DOCKED MODE: Bottom floating bar that lets guests/DJs navigate while listening
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl transition-all duration-300 ease-in-out">
      <div className="overflow-hidden rounded-2xl border border-amber-500/40 bg-neutral-950/95 shadow-2xl shadow-black/80 backdrop-blur-xl">
        {/* Top bar with track info and quick controls */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-700/20 border border-amber-500/40 text-amber-300">
              <Music2 className="h-5 w-5 animate-spin-slow" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                  {embedInfo.sourceLabel}
                </span>
                <h4 className="text-sm font-bold text-white truncate">{song.title}</h4>
              </div>
              <p className="text-xs text-neutral-400 truncate">{song.artist || 'Banda Sonora Oficial'}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {embedInfo.type !== 'audio' && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition"
                title={isExpanded ? 'Minimizar leitor' : 'Expandir vídeo'}
              >
                {isExpanded ? (
                  <>
                    <ChevronDown size={14} />
                    <span className="hidden sm:inline">Recolher</span>
                  </>
                ) : (
                  <>
                    <ChevronUp size={14} />
                    <span className="hidden sm:inline">Vídeo</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={onClose}
              className="rounded-lg p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition"
              title="Parar e fechar música"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Expandable Player Stage */}
        {isExpanded && (
          <div className="border-t border-white/10 bg-black">
            {embedInfo.type === 'audio' ? (
              <div className="p-3">
                <audio controls autoPlay src={embedInfo.embedUrl} className="w-full" />
              </div>
            ) : embedInfo.type === 'spotify' ? (
              <div className="p-2">
                <iframe
                  src={embedInfo.embedUrl}
                  title={song.title}
                  className="w-full rounded-xl border-0"
                  height="152"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="relative aspect-video w-full max-h-[320px]">
                <iframe
                  src={embedInfo.embedUrl}
                  title={song.title}
                  className="absolute inset-0 h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
