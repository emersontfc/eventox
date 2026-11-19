'use client';

import React, { useState } from 'react';
import { Palette, Check, Sparkles, RefreshCw } from 'lucide-react';
import { EVENT_THEMES, EventTheme } from '../lib/event-themes';

interface EventThemeSelectorProps {
  currentTheme: string;
  slug: string;
  onThemeChanged?: (newTheme: string) => void;
}

export default function EventThemeSelector({
  currentTheme,
  slug,
  onThemeChanged,
}: EventThemeSelectorProps) {
  const [selectedTheme, setSelectedTheme] = useState(currentTheme || 'gala-gold');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSelect = async (themeId: string) => {
    setSelectedTheme(themeId);
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/events/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-theme', theme: themeId }),
      });
      const data = await res.json() as { ok?: boolean; theme?: string; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Erro ao atualizar tema.');
      }
      setFeedback('✦ Tema de luxo aplicado com sucesso ao evento!');
      onThemeChanged?.(themeId);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao guardar template.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-amber-500/30 bg-neutral-950/80 p-5 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-amber-400" />
            <h3 className="text-base font-bold text-white tracking-wide">
              Templates Visuais & Identidade de Gala
            </h3>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Escolhe o template estético do teu evento. A paleta, tipografia, bilhetes VIP e atmosfera serão atualizados instantaneamente.
          </p>
        </div>
        {saving && (
          <div className="flex items-center gap-2 text-xs text-amber-300">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span>A aplicar...</span>
          </div>
        )}
      </div>

      {feedback && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/15 p-3 text-center text-xs font-semibold text-amber-200">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {Object.values(EVENT_THEMES).map((theme: EventTheme) => {
          const isSelected = selectedTheme === theme.id;
          return (
            <div
              key={theme.id}
              onClick={() => handleSelect(theme.id)}
              className={`relative cursor-pointer overflow-hidden rounded-xl p-4 border transition-all duration-200 ${
                isSelected
                  ? 'border-amber-400 bg-neutral-900 shadow-lg shadow-amber-500/20 scale-[1.02]'
                  : 'border-white/10 bg-neutral-900/60 hover:border-white/30 hover:bg-neutral-900'
              }`}
            >
              {/* Color Bar Preview */}
              <div
                className="h-10 w-full rounded-lg mb-3 flex items-center justify-between px-3 shadow-inner"
                style={{ background: theme.previewBg, border: `1px solid ${theme.previewBorder}40` }}
              >
                <span
                  className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${theme.previewBorder}25`,
                    color: theme.previewAccent,
                    border: `1px solid ${theme.previewBorder}60`,
                  }}
                >
                  {theme.previewBadge}
                </span>

                {isSelected && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-black shadow">
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}
              </div>

              <h4 className="text-sm font-bold text-white mb-1">{theme.name}</h4>
              <p className="text-[11.5px] text-neutral-400 leading-relaxed">{theme.subtitle}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
