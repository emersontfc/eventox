'use client';

import { useEffect, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { EVENT_THEMES, resolveEventTheme } from '../lib/event-themes';

export default function EventThemeSelector({ currentTheme, slug, eventTitle = 'Nome do evento', onThemeChanged }: {
  currentTheme: string;
  slug: string;
  eventTitle?: string;
  onThemeChanged?: (newTheme: string) => void;
}) {
  const [appliedId, setAppliedId] = useState(resolveEventTheme(currentTheme).id);
  const [selectedId, setSelectedId] = useState(appliedId);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const selected = resolveEventTheme(selectedId);

  useEffect(() => {
    const id = resolveEventTheme(currentTheme).id;
    setAppliedId(id);
    setSelectedId(id);
  }, [currentTheme]);

  async function apply() {
    setSaving(true);
    setFeedback('');
    setError('');
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-theme', theme: selected.id }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Não foi possível aplicar o tema.');
      setAppliedId(selected.id);
      setFeedback('Tema aplicado ao convite público.');
      onThemeChanged?.(selected.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível aplicar o tema.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="theme-picker">
      <fieldset disabled={saving} className="theme-options">
        <legend>Temas disponíveis</legend>
        <div className="theme-options-grid">
          {Object.values(EVENT_THEMES).map(theme => (
            <label className="theme-option" key={theme.id}>
              <input name="event-theme" type="radio" checked={theme.id === selectedId} onChange={() => {
                setSelectedId(theme.id);
                setFeedback('');
                setError('');
              }} />
              <span className="theme-swatch" style={{ background: theme.previewBg, color: theme.previewAccent }}>
                <Palette size={18} aria-hidden="true" />
              </span>
              <span><strong>{theme.name}</strong><small>{theme.subtitle}</small></span>
              {theme.id === appliedId && <span className="theme-applied"><Check size={13} /> Em uso</span>}
            </label>
          ))}
        </div>
      </fieldset>
      <section className="theme-preview">
        <h2>Prévia do convite</h2>
        <div className="theme-preview-canvas" style={{ background: selected.heroGradient, color: selected.cardStyle.text }}>
          <small>EventoX</small>
          <strong>{eventTitle}</strong>
          <span style={{ background: selected.buttonPrimary.bg, color: selected.buttonPrimary.text }}>Confirmar presença</span>
        </div>
        {feedback && <p role="status">{feedback}</p>}
        {error && <p className="auth-alert-error" role="alert">{error}</p>}
        <button type="button" className="primary" disabled={saving || selectedId === appliedId} onClick={apply}>
          {saving ? 'A aplicar…' : selectedId === appliedId ? 'Tema em uso' : 'Aplicar ao convite'}
        </button>
      </section>
    </div>
  );
}
