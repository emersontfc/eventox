'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Monitor, Play, Pause, AlertTriangle, ExternalLink, RefreshCw,
  CheckCircle2, Clock, Send, Palette, ListOrdered, Sparkles,
  Volume2, Shield, Eye, X, Check, Users, MessageSquare, Radio,
  Maximize2, ArrowRight
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
    eventDate: string;
    venue: string;
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
  recentArrivals?: Array<{ id: number; name: string }>;
}

export default function ScreenLiveDashboard({ slug }: { slug: string }) {
  const [screenState, setScreenState] = useState<ScreenState | null>(null);
  const [messages, setMessages] = useState<ScreenMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Broadcast announcement
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastCategory, setBroadcastCategory] = useState('honra');
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  // Emergency message
  const [emergencyText, setEmergencyText] = useState('Atenção a todos os presentes: por favor aguardem instruções da organização.');

  const loadData = useCallback(async () => {
    try {
      const [screenRes, msgRes] = await Promise.all([
        fetch(`/api/screen/${slug}`, { cache: 'no-store' }),
        fetch(`/api/screen/${slug}/messages`, { cache: 'no-store' }),
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
      setError(err.message || 'Erro ao sincronizar com o ecrã');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadData();

    // SSE Stream for instant screen state updates
    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    try {
      eventSource = new EventSource(`/api/screen/${slug}/stream`);
      eventSource.addEventListener('update', (event) => {
        try {
          const payload = JSON.parse(event.data);
          setScreenState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              settings: payload.settings ? { ...prev.settings, ...payload.settings } : prev.settings,
              activeMessage: payload.activeMessage !== undefined ? payload.activeMessage : prev.activeMessage,
            };
          });
        } catch {}
      });

      eventSource.onerror = () => {
        if (!pollInterval) {
          pollInterval = setInterval(loadData, 3500);
        }
      };
    } catch {
      pollInterval = setInterval(loadData, 3500);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [slug, loadData]);

  const showNotification = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // Switch scene immediately
  const setScene = async (sceneKey: string) => {
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
      showNotification(`Ecrã alterado para "${sceneKey.toUpperCase()}"!`);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Toggle Hold / Pause rotation
  const toggleHold = async () => {
    if (!screenState) return;
    const nextHold = !screenState.settings.holdScene;
    try {
      const res = await fetch(`/api/screen/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-hold', holdScene: nextHold }),
      });
      if (!res.ok) throw new Error('Falha ao alternar pausa');
      showNotification(nextHold ? 'Rotação pausada (Cena Fixada)' : 'Rotação automática retomada');
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Toggle Emergency Mode
  const toggleEmergency = async (active: boolean) => {
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
      showNotification(active ? 'MODO DE EMERGÊNCIA ATIVADO NO ECRÃ!' : 'Modo de emergência desativado');
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Change Theme
  const changeTheme = async (themeName: string) => {
    try {
      const res = await fetch(`/api/screen/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-theme', theme: themeName }),
      });
      if (!res.ok) throw new Error('Falha ao alterar tema');
      showNotification(`Tema alterado para "${themeName}"`);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Broadcast Message to Screen
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;

    setBroadcastLoading(true);
    try {
      const res = await fetch(`/api/screen/${slug}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          text: broadcastText.trim(),
          category: broadcastCategory,
          status: 'exibido',
          priority: 2,
        }),
      });
      if (!res.ok) {
        const j: any = await res.json();
        throw new Error(j.error || 'Erro ao emitir aviso');
      }
      setBroadcastText('');
      showNotification('Aviso projectado imediatamente no ecrã!');
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBroadcastLoading(false);
    }
  };

  // Moderate Message
  const moderateMessage = async (messageId: number, status: 'aprovado' | 'exibido' | 'cancelado') => {
    try {
      const res = await fetch(`/api/screen/${slug}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'moderate', messageId, status }),
      });
      if (!res.ok) throw new Error('Falha na moderação');
      showNotification(`Mensagem marcada como "${status}"`);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading && !screenState) {
    return (
      <div className="py-12 text-center text-slate-500">
        <RefreshCw className="mx-auto h-8 w-8 animate-spin text-amber-500 mb-2" />
        <p className="text-sm">A conectar com o ecrã em direto...</p>
      </div>
    );
  }

  const { settings, scenes = [], activeMessage } = screenState || { settings: {} as any, scenes: [] };

  return (
    <div className="space-y-6">

      {/* Top Banner & Quick Links */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-amber-600">
              Conexão em Direto com o Ecrã
            </span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">
            Controlo do Ecrã 16:9 & Audiovisual
          </h2>
          <p className="text-sm text-slate-500">
            Controle remotamente o projetor, TVs e painéis LED do evento em tempo real a partir deste painel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.open(`/${slug}/screen`, '_blank')}
            className="flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-sm font-bold text-white transition shadow-sm"
          >
            <Monitor size={17} /> Abrir Ecrã 16:9 no Projetor <ExternalLink size={14} />
          </button>
          <button
            onClick={() => window.open(`/${slug}/mural`, '_blank')}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            <MessageSquare size={16} /> Ver Mural <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* Action Alerts */}
      {actionSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 p-4 text-emerald-800 text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-50 p-4 text-rose-800 text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}><X size={16} /></button>
        </div>
      )}

      {/* Real-time State & Live Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 1. Interactive 16:9 Mini Screen Preview */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Eye size={16} className="text-amber-500" /> Mini-Preview em Direto da Projeção
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  settings?.holdScene
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {settings?.holdScene ? 'Cena Fixa (Pausado)' : 'Rotação Automática'}
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 uppercase">
                  Tema: {settings?.theme || 'midnight_gold'}
                </span>
              </div>
            </div>

            {/* 16:9 Screen Simulation Box */}
            <div className={`relative aspect-video w-full rounded-2xl border p-6 flex flex-col justify-between overflow-hidden shadow-inner ${
              settings?.theme === 'royal_wine'
                ? 'bg-gradient-to-br from-[#210912] to-[#12040c] text-rose-50 border-rose-900/40'
                : settings?.theme === 'cinematic_dark'
                ? 'bg-gradient-to-br from-[#030712] to-[#0a0f1d] text-slate-50 border-slate-800'
                : 'bg-gradient-to-br from-[#0b0b0e] via-[#16161b] to-[#08080a] text-amber-50 border-amber-900/40'
            }`}>
              {/* Emergency Banner inside simulation */}
              {settings?.emergencyMode && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-red-950/90 p-4 text-center">
                  <AlertTriangle className="h-10 w-10 text-red-400 mb-2 animate-bounce" />
                  <strong className="text-lg uppercase text-white font-black">AVISO DE EMERGÊNCIA</strong>
                  <p className="text-xs text-red-200 max-w-md mt-1">{settings?.emergencyMessage}</p>
                </div>
              )}

              {/* Active broadcast banner inside simulation */}
              {activeMessage && (
                <div className="mb-2 rounded-xl border border-amber-400/30 bg-black/70 p-2.5 text-center backdrop-blur-sm">
                  <span className="text-[10px] font-bold uppercase text-amber-400 block">
                    {activeMessage.category === 'honra' ? 'Recepção de Honra' : 'Boas-Vindas'}
                  </span>
                  <p className="text-xs font-semibold text-white truncate">{activeMessage.text}</p>
                </div>
              )}

              {/* Simulation Header */}
              <div className="flex items-center justify-between text-xs opacity-75 border-b border-white/10 pb-2">
                <span className="font-bold tracking-wider uppercase">{screenState?.event?.title}</span>
                <span>{screenState?.event?.hostName}</span>
              </div>

              {/* Simulation Central Content */}
              <div className="my-auto text-center py-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400 block mb-1">
                  Cena Ativa no Salão: {settings?.activeSceneId?.toUpperCase()}
                </span>
                <h3 className="text-xl md:text-2xl font-serif font-bold text-white tracking-wide">
                  {scenes.find((s) => s.sceneKey === settings?.activeSceneId)?.title || screenState?.event?.title}
                </h3>
                <p className="text-xs text-white/70 mt-1 max-w-sm mx-auto line-clamp-2">
                  {scenes.find((s) => s.sceneKey === settings?.activeSceneId)?.subtitle || 'Projeção ao vivo em alta definição 16:9.'}
                </p>
              </div>

              {/* Simulation Footer */}
              <div className="flex items-center justify-between text-[10px] text-white/40 pt-2 border-t border-white/10">
                <span>Eventox Live Cinema Engine</span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Sincronizado
                </span>
              </div>
            </div>
          </div>

          {/* Quick Play/Pause & Emergency bar below preview */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={toggleHold}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 font-bold text-sm transition ${
                settings?.holdScene
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              {settings?.holdScene ? <Play size={16} /> : <Pause size={16} />}
              {settings?.holdScene ? 'Retomar Rotação Automática' : 'Fixar Cena Atual (Pausar)'}
            </button>

            <button
              onClick={() => toggleEmergency(!settings?.emergencyMode)}
              className={`flex items-center gap-2 rounded-xl py-2.5 px-4 font-bold text-xs transition border ${
                settings?.emergencyMode
                  ? 'bg-rose-600 border-rose-600 text-white animate-pulse'
                  : 'bg-white border-rose-300 text-rose-700 hover:bg-rose-50'
              }`}
            >
              <AlertTriangle size={15} />
              {settings?.emergencyMode ? 'DESATIVAR EMERGÊNCIA' : 'Modo Emergência'}
            </button>
          </div>
        </div>

        {/* 2. Theme & Instant Broadcast Panel */}
        <div className="space-y-6">

          {/* Theme Selector */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-3">
              <Palette size={16} className="text-amber-500" /> Tema de Cores do Ecrã
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'midnight_gold', label: 'Midnight Gold', bg: 'bg-[#0b0b0e] text-amber-300 border-amber-500/40' },
                { id: 'royal_wine', label: 'Royal Wine', bg: 'bg-[#210912] text-rose-300 border-rose-500/40' },
                { id: 'cinematic_dark', label: 'Cinematic Dark', bg: 'bg-[#030712] text-sky-300 border-sky-500/40' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => changeTheme(t.id)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-[11px] font-bold text-center transition ${t.bg} ${
                    settings?.theme === t.id ? 'ring-2 ring-slate-900 scale-105 shadow-sm' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <span className="truncate w-full">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Instant Live Broadcast Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2">
              <Volume2 size={16} className="text-amber-500" /> Comunicado Imediato no Ecrã
            </span>
            <p className="text-xs text-slate-500 mb-3">
              Projeta uma faixa de aviso no topo da tela do projetor para todo o salão:
            </p>
            <form onSubmit={handleBroadcast} className="space-y-3">
              <textarea
                rows={2}
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Ex.: A sessão de fotos oficiais terá início no jardim em 5 minutos..."
                className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none resize-none"
              />
              <div className="flex gap-2">
                <select
                  value={broadcastCategory}
                  onChange={(e) => setBroadcastCategory(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none"
                >
                  <option value="honra">Honra / Solene</option>
                  <option value="individual">Boas-Vindas</option>
                  <option value="aviso">Aviso Geral</option>
                </select>
                <button
                  type="submit"
                  disabled={broadcastLoading || !broadcastText.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 py-2 px-3 text-xs font-bold text-white transition shadow-sm"
                >
                  <Send size={13} /> Projetar no Ecrã
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 3. Direct Scene Selector (Jump) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ListOrdered size={18} className="text-amber-500" />
              Seletor Directo de Cenas (Mudar no Ecrã Imediatamente)
            </h3>
            <p className="text-xs text-slate-500">
              Clique em qualquer cena para forçar a transição no projetor no mesmo segundo.
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
                className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition ${
                  isActive
                    ? 'border-amber-500 bg-amber-50/80 text-amber-950 shadow-sm ring-2 ring-amber-500'
                    : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                    {s.sceneKey}
                  </span>
                  <span className="text-[10px] text-slate-400">{s.duration}s</span>
                </div>
                <strong className="text-xs font-bold truncate w-full text-slate-900">{s.title}</strong>
                {s.subtitle && <span className="text-[11px] text-slate-500 truncate w-full mt-0.5">{s.subtitle}</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Reception Arrival Queue & Live Greetings */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users size={18} className="text-amber-500" />
              Fila de Boas-Vindas da Recepção & Chegadas
            </h3>
            <p className="text-xs text-slate-500">
              Geradas automaticamente no momento em que a recepção faz o check-in dos convidados.
            </p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>

        {messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-sm">
            Nenhuma mensagem pendente na fila no momento. As chegadas da recepção surgirão aqui para moderação.
          </div>
        ) : (
          <div className="space-y-2.5">
            {messages.slice(0, 8).map((msg) => (
              <div
                key={msg.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-amber-100 px-2 py-0.5 font-bold uppercase text-amber-800 text-[10px]">
                      {msg.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                      msg.status === 'exibido'
                        ? 'bg-emerald-100 text-emerald-800'
                        : msg.status === 'aprovado'
                        ? 'bg-sky-100 text-sky-800'
                        : msg.status === 'cancelado'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {msg.status}
                    </span>
                    <span className="text-slate-400">
                      {new Date(msg.createdAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-800 font-medium">{msg.text}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => moderateMessage(msg.id, 'exibido')}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-white font-bold transition shadow-sm"
                    title="Exibir imediatamente no ecrã"
                  >
                    <Eye size={12} /> Exibir Agora
                  </button>
                  {msg.status === 'pendente' && (
                    <button
                      onClick={() => moderateMessage(msg.id, 'aprovado')}
                      className="flex items-center gap-1 rounded-lg bg-sky-600 hover:bg-sky-700 px-2.5 py-1 text-white font-bold transition shadow-sm"
                      title="Aprovar para rotação"
                    >
                      <Check size={12} /> Aprovar
                    </button>
                  )}
                  {msg.status !== 'cancelado' && (
                    <button
                      onClick={() => moderateMessage(msg.id, 'cancelado')}
                      className="flex items-center gap-1 rounded-lg border border-slate-300 hover:bg-rose-50 hover:border-rose-300 px-2.5 py-1 text-slate-600 hover:text-rose-600 transition"
                      title="Descartar mensagem"
                    >
                      <X size={12} /> Descartar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
