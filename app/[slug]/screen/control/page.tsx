'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Sparkles, Play, Pause, AlertTriangle, Monitor, ExternalLink,
  RefreshCw, CheckCircle2, Clock, Send, Palette, ListOrdered,
  Volume2, Shield, Eye, X, Check, Users, MessageSquare, ArrowRight
} from 'lucide-react';

interface Scene {
  id: number;
  sceneKey: string;
  title: string;
  subtitle?: string | null;
  duration: number;
  position: number;
  isActive: boolean;
}

interface ScreenMessage {
  id: number;
  category: string;
  text: string;
  status: 'pendente' | 'aprovado' | 'exibido' | 'cancelado';
  priority: number;
  scheduledFor?: string | null;
  displayedAt?: string | null;
  createdAt: string;
  guestId?: number | null;
}

interface ScreenState {
  event: {
    id: number;
    slug: string;
    title: string;
    hostName: string;
  };
  settings: {
    activeSceneId: string;
    autoRotate: boolean;
    rotateInterval: number;
    theme: string;
    backgroundStyle: string;
    holdScene: boolean;
    emergencyMode: boolean;
    emergencyMessage?: string | null;
  };
  scenes: Scene[];
  activeMessage?: ScreenMessage | null;
}

export default function ScreenControlPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string>('');
  const [screenState, setScreenState] = useState<ScreenState | null>(null);
  const [messages, setMessages] = useState<ScreenMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Operator broadcast input
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastCategory, setBroadcastCategory] = useState('honra');
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  // Emergency dialog / state
  const [emergencyText, setEmergencyText] = useState('Atenção: Por favor aguardem instruções no salão principal.');

  // Unwrap params
  useEffect(() => {
    params.then((p) => setSlug(p.slug.toLowerCase().trim()));
  }, [params]);

  // Load screen state and messages queue
  const loadData = useCallback(async (currentSlug: string) => {
    try {
      const [screenRes, msgRes] = await Promise.all([
        fetch(`/api/screen/${currentSlug}`, { cache: 'no-store' }),
        fetch(`/api/screen/${currentSlug}/messages`, { cache: 'no-store' }),
      ]);

      if (screenRes.ok) {
        const sData: any = await screenRes.json();
        setScreenState(sData);
      }

      if (msgRes.ok) {
        const mData: any = await msgRes.json();
        setMessages(mData.messages || []);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao comunicar com o servidor');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!slug) return;
    loadData(slug);
    const interval = setInterval(() => loadData(slug), 3000);
    return () => clearInterval(interval);
  }, [slug, loadData]);

  const showNotification = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // Switch scene
  const setScene = async (sceneKey: string) => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/screen/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-active-scene', sceneId: sceneKey }),
      });
      if (!res.ok) {
        const j: any = await res.json();
        throw new Error(j.error || 'Falha ao mudar de cena');
      }
      showNotification(`Cena alterada para "${sceneKey}"`);
      loadData(slug);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Toggle Hold / Pause rotation
  const toggleHold = async () => {
    if (!slug || !screenState) return;
    const nextHold = !screenState.settings.holdScene;
    try {
      const res = await fetch(`/api/screen/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-hold', holdScene: nextHold }),
      });
      if (!res.ok) throw new Error('Falha ao alternar pausa');
      showNotification(nextHold ? 'Rotação pausada (Cena Fixa)' : 'Rotação automática retomada');
      loadData(slug);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Toggle Emergency Mode
  const toggleEmergency = async (active: boolean) => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/screen/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle-emergency',
          emergencyMode: active,
          emergencyMessage: emergencyText,
        }),
      });
      if (!res.ok) throw new Error('Falha ao alterar modo de emergência');
      showNotification(active ? 'MODO DE EMERGÊNCIA ATIVADO NO ECRÃ' : 'Modo de emergência desativado');
      loadData(slug);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Change Theme
  const changeTheme = async (themeName: string) => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/screen/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-theme', theme: themeName }),
      });
      if (!res.ok) throw new Error('Falha ao alterar tema');
      showNotification(`Tema alterado para ${themeName}`);
      loadData(slug);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Broadcast Message to Screen
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !broadcastText.trim()) return;

    setBroadcastLoading(true);
    try {
      const res = await fetch(`/api/screen/${slug}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          text: broadcastText.trim(),
          category: broadcastCategory,
          status: 'exibido', // Display immediately!
          priority: 2,
        }),
      });
      if (!res.ok) {
        const j: any = await res.json();
        throw new Error(j.error || 'Erro ao emitir aviso');
      }
      setBroadcastText('');
      showNotification('Aviso projectado imediatamente no ecrã!');
      loadData(slug);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBroadcastLoading(false);
    }
  };

  // Moderate Message (Display, Approve, Cancel)
  const moderateMessage = async (messageId: number, status: 'aprovado' | 'exibido' | 'cancelado') => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/screen/${slug}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'moderate', messageId, status }),
      });
      if (!res.ok) throw new Error('Falha na moderação');
      showNotification(`Mensagem marcada como ${status}`);
      loadData(slug);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading && !screenState) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <RefreshCw className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  const { settings, scenes = [] } = screenState || { settings: {} as any, scenes: [] };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Top Control Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Mesa de Operação Audiovisual (AV Control)
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mt-1">
              Eventox Live — {screenState?.event?.title || 'Controlo de Ecrã'}
            </h1>
            <p className="text-sm text-slate-400">
              Controlo em tempo real de projecção 16:9, rotação de cenas e fila de boas-vindas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => window.open(`/${slug}/screen`, '_blank')}
              className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 transition shadow-lg"
            >
              <Monitor size={18} /> Abrir Ecrã 16:9 Projector <ExternalLink size={14} />
            </button>
            <button
              onClick={() => window.open(`/${slug}/mural`, '_blank')}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition"
            >
              <MessageSquare size={16} /> Ver Mural Público <ExternalLink size={14} />
            </button>
          </div>
        </header>

        {/* Action / Error Banner */}
        {actionSuccess && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-4 text-emerald-200 text-sm flex items-center gap-3 animate-in fade-in duration-300">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 p-4 text-rose-200 text-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-rose-400" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)}><X size={16} /></button>
          </div>
        )}

        {/* Global Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Card 1: Master Controls */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Controlo de Transmissão</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${settings?.holdScene ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                  {settings?.holdScene ? 'Pausado (Cena Fixa)' : 'Rotação Automática'}
                </span>
              </div>
              <p className="text-sm text-slate-300 mb-6">
                Cena em exibição: <strong className="text-amber-400 uppercase">{settings?.activeSceneId || 'welcome'}</strong>
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={toggleHold}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 font-semibold text-sm transition ${
                  settings?.holdScene
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
              >
                {settings?.holdScene ? <Play size={18} /> : <Pause size={18} />}
                {settings?.holdScene ? 'Retomar Rotação Automática' : 'Pausar Rotação (Fixar Cena)'}
              </button>

              <button
                onClick={() => toggleEmergency(!settings?.emergencyMode)}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 font-semibold text-sm transition border ${
                  settings?.emergencyMode
                    ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                    : 'bg-rose-950/40 border-rose-800 text-rose-300 hover:bg-rose-900/50'
                }`}
              >
                <AlertTriangle size={18} />
                {settings?.emergencyMode ? 'DESATIVAR MODO DE EMERGÊNCIA' : 'Ativar Modo de Emergência'}
              </button>
            </div>
          </div>

          {/* Card 2: Theme Selector */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                <Palette size={16} className="text-amber-400" />
                Estilo Visual do Ecrã
              </div>
              <p className="text-sm text-slate-300 mb-4">
                Tema activo: <strong className="text-white uppercase">{settings?.theme || 'midnight_gold'}</strong>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'midnight_gold', label: 'Midnight Gold', bg: 'bg-[#0b0b0e] border-amber-500/50 text-amber-300' },
                { id: 'royal_wine', label: 'Royal Wine', bg: 'bg-[#210912] border-rose-500/50 text-rose-300' },
                { id: 'cinematic_dark', label: 'Cinematic Dark', bg: 'bg-[#030712] border-sky-500/50 text-sky-300' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => changeTheme(t.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold text-center transition ${t.bg} ${settings?.theme === t.id ? 'ring-2 ring-white scale-105' : 'opacity-70 hover:opacity-100'}`}
                >
                  <span className="truncate w-full">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Card 3: Instant Screen Broadcast Bar */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                <Volume2 size={16} className="text-amber-400" />
                Emissão Instantânea no Ecrã
              </div>
              <p className="text-xs text-slate-400 mb-2">
                Projetar um anúncio em destaque ou mensagem especial imediatamente:
              </p>
            </div>

            <form onSubmit={handleBroadcast} className="space-y-3">
              <input
                type="text"
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Ex.: O brinde oficial terá início em 5 minutos..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
              />
              <div className="flex gap-2">
                <select
                  value={broadcastCategory}
                  onChange={(e) => setBroadcastCategory(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="honra">Honra / Solene</option>
                  <option value="individual">Boas-Vindas</option>
                  <option value="aviso">Aviso Geral</option>
                </select>
                <button
                  type="submit"
                  disabled={broadcastLoading || !broadcastText.trim()}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 py-2 px-3 text-xs font-bold text-slate-950 transition"
                >
                  <Send size={14} /> Projectar no Ecrã
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Scene Selection Grid */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ListOrdered size={20} className="text-amber-400" /> Seletor Directo de Cenas
              </h2>
              <p className="text-xs text-slate-400">
                Clique numa cena para forçar a transição imediata no projector ou TV.
              </p>
            </div>
            <span className="text-xs text-slate-400">Total: {scenes.length} cenas</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {scenes.map((s) => {
              const isActive = settings?.activeSceneId === s.sceneKey;
              return (
                <button
                  key={s.id}
                  onClick={() => setScene(s.sceneKey)}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition ${
                    isActive
                      ? 'border-amber-400 bg-amber-500/20 text-white shadow-lg ring-1 ring-amber-400'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      {s.sceneKey}
                    </span>
                    <span className="text-xs text-slate-500">{s.duration}s</span>
                  </div>
                  <strong className="text-sm font-semibold truncate w-full">{s.title}</strong>
                  {s.subtitle && <span className="text-xs text-slate-400 truncate w-full mt-1">{s.subtitle}</span>}
                </button>
              );
            })}
          </div>
        </section>

        {/* AV Reception Queue & Check-In Greetings */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users size={20} className="text-amber-400" /> Fila de Boas-Vindas & Chegadas
              </h2>
              <p className="text-xs text-slate-400">
                Mensagens geradas pela recepção no check-in para exibição no ecrã.
              </p>
            </div>
            <button
              onClick={() => loadData(slug)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white"
            >
              <RefreshCw size={14} /> Atualizar Fila
            </button>
          </div>

          {messages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-500">
              <MessageSquare className="mx-auto h-8 w-8 text-slate-600 mb-2" />
              <p className="text-sm">Nenhuma mensagem ou chegada na fila no momento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.slice(0, 10).map((msg) => (
                <div
                  key={msg.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/80 p-4 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-bold uppercase text-amber-300">
                        {msg.category}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        msg.status === 'exibido'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : msg.status === 'aprovado'
                          ? 'bg-sky-500/20 text-sky-300'
                          : msg.status === 'cancelado'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {msg.status}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(msg.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-200">{msg.text}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => moderateMessage(msg.id, 'exibido')}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition"
                      title="Projetar agora no ecrã"
                    >
                      <Eye size={14} /> Exibir Agora
                    </button>
                    {msg.status === 'pendente' && (
                      <button
                        onClick={() => moderateMessage(msg.id, 'aprovado')}
                        className="flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-xs font-bold text-white transition"
                        title="Aprovar para rotação"
                      >
                        <Check size={14} /> Aprovar
                      </button>
                    )}
                    {msg.status !== 'cancelado' && (
                      <button
                        onClick={() => moderateMessage(msg.id, 'cancelado')}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-700 hover:bg-rose-950/40 hover:border-rose-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-300 transition"
                        title="Cancelar mensagem"
                      >
                        <X size={14} /> Descartar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
