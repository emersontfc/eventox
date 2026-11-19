'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Sparkles, Heart, MessageSquare, Send, CheckCircle2,
  Calendar, MapPin, User, ArrowLeft, RefreshCw, AlertTriangle,
  Shield, Check, Trash2, Award
} from 'lucide-react';

interface GuestbookItem {
  id: number;
  senderName: string;
  relationship: string;
  message: string;
  photoUrl?: string | null;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  createdAt: string;
}

export default function GuestbookMuralPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string>('');
  const [messages, setMessages] = useState<GuestbookItem[]>([]);
  const [canModerate, setCanModerate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [senderName, setSenderName] = useState('');
  const [relationship, setRelationship] = useState('Amigo(a)');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Unwrap params
  useEffect(() => {
    params.then((p) => setSlug(p.slug.toLowerCase().trim()));
  }, [params]);

  const loadMessages = useCallback(async (currentSlug: string) => {
    try {
      const res = await fetch(`/api/events/${currentSlug}/guestbook`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar mural');
      const data: any = await res.json();
      setMessages(data.messages || []);
      setCanModerate(Boolean(data.canModerate));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!slug) return;
    loadMessages(slug);
    const interval = setInterval(() => loadMessages(slug), 5000);
    return () => clearInterval(interval);
  }, [slug, loadMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !senderName.trim() || !message.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${slug}/guestbook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: senderName.trim(),
          relationship,
          message: message.trim(),
        }),
      });

      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao enviar mensagem');

      setMessage('');
      setSuccessNotice('A sua mensagem foi registada e será exibida no mural!');
      setTimeout(() => setSuccessNotice(null), 5000);
      loadMessages(slug);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleModerate = async (id: number, status: 'aprovado' | 'rejeitado') => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/events/${slug}/guestbook`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error('Falha na moderação');
      loadMessages(slug);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d12] text-amber-50 font-sans selection:bg-amber-400 selection:text-black">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 right-1/4 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-10 left-10 h-80 w-80 rounded-full bg-rose-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 md:py-12 space-y-8">

        {/* Back and Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => window.location.href = `/${slug}`}
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-950/20 px-4 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-950/40 transition"
          >
            <ArrowLeft size={14} /> Voltar ao Portal do Evento
          </button>
        </div>

        {/* Header Title */}
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-semibold text-amber-300 uppercase tracking-widest">
            <Heart size={14} className="text-rose-400" /> Mural de Mensagens & Parabéns
          </div>
          <h1 className="font-serif text-3xl md:text-5xl font-extrabold text-white tracking-tight">
            Deixe as suas Felicitações
          </h1>
          <p className="max-w-xl mx-auto text-sm md:text-base text-amber-200/80 font-light">
            Partilhe as suas palavras de orgulho, carinho e comemoração. As mensagens serão projetadas nos ecrãs da gala!
          </p>
        </header>

        {/* Submission Form Card */}
        <div className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-950/30 via-black/60 to-black/80 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <MessageSquare size={18} className="text-amber-400" /> Escrever Mensagem no Mural
          </h2>

          {successNotice && (
            <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-4 text-emerald-200 text-sm flex items-center gap-3">
              <CheckCircle2 size={18} className="text-emerald-400" />
              <span>{successNotice}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-950/60 p-4 text-rose-200 text-sm flex items-center gap-3">
              <AlertTriangle size={18} className="text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-amber-300 mb-1.5">
                  O Seu Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Ex.: Dra. Teresa ou Família Silveira"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-amber-300 mb-1.5">
                  Relação / Conexão
                </label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#16161d] px-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="Família">Família</option>
                  <option value="Amigo(a)">Amigo(a)</option>
                  <option value="Colega de Medicina">Colega de Medicina</option>
                  <option value="Docente / Professor">Docente / Professor</option>
                  <option value="Padrinho / Madrinha">Padrinho / Madrinha</option>
                  <option value="Convidado(a) de Honra">Convidado(a) de Honra</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-amber-300 mb-1.5">
                A Sua Mensagem ou Votos
              </label>
              <textarea
                required
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={450}
                placeholder="Parabéns pelo grande marco académico, Dr. Emerson! Muito sucesso nesta nobre missão..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition resize-none"
              />
              <div className="flex justify-between items-center text-xs text-white/40 mt-1">
                <span>Será moderado antes de ser projetado</span>
                <span>{message.length}/450</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !senderName.trim() || !message.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-3 px-6 text-sm font-bold text-slate-950 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 transition shadow-lg"
            >
              <Send size={16} /> {submitting ? 'A Enviar...' : 'Publicar no Mural'}
            </button>
          </form>
        </div>

        {/* Live Mural Wall */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Award size={20} className="text-amber-400" /> Mensagens dos Convidados
            </h2>
            <span className="text-xs text-white/50">{messages.length} mensagens no mural</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-white/50 flex justify-center items-center gap-2">
              <RefreshCw className="animate-spin h-5 w-5 text-amber-400" /> A carregar o mural...
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-white/40">
              <Heart className="mx-auto h-10 w-10 text-white/20 mb-3" />
              <p className="text-base font-light">Seja o primeiro a deixar uma mensagem de carinho!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {messages.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md flex flex-col justify-between space-y-3 hover:border-amber-400/30 transition shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold text-xs">
                          {item.senderName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{item.senderName}</h4>
                          <span className="text-xs text-amber-400/80">{item.relationship}</span>
                        </div>
                      </div>

                      <span className="text-xs text-white/40">
                        {new Date(item.createdAt).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>

                    <p className="text-sm text-white/90 leading-relaxed font-light italic">
                      "{item.message}"
                    </p>
                  </div>

                  {canModerate && (
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                      <span className={`px-2 py-0.5 rounded font-semibold ${
                        item.status === 'aprovado'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : item.status === 'pendente'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {item.status}
                      </span>
                      <div className="flex gap-2">
                        {item.status !== 'aprovado' && (
                          <button
                            onClick={() => handleModerate(item.id, 'aprovado')}
                            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                          >
                            <Check size={14} /> Aprovar
                          </button>
                        )}
                        {item.status !== 'rejeitado' && (
                          <button
                            onClick={() => handleModerate(item.id, 'rejeitado')}
                            className="flex items-center gap-1 text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 size={14} /> Rejeitar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
