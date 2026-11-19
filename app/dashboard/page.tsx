'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Plus, CalendarDays, MapPin, Shield, Users, Tv, Sliders,
  LogOut, User, CheckCircle2, ArrowRight, Settings, ExternalLink, Heart
} from 'lucide-react';
import AuthModal from '../../components/AuthModal';

interface DashboardEvent {
  id: number;
  slug: string;
  title: string;
  hostName: string;
  eventDate: string;
  venue: string;
  role: string;
  permissions: string[];
}

interface UserProfile {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  globalRole: string;
}

export default function UserDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Profile edit state
  const [editingProfile, setEditingProfile] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json() as { authenticated: boolean; user: UserProfile | null; events: DashboardEvent[] };

      if (!data.authenticated || !data.user) {
        setAuthModalOpen(true);
        setLoading(false);
        return;
      }

      setUser(data.user);
      setEvents(data.events || []);
      setName(data.user.name || '');
      setPhone(data.user.phone || '');
    } catch {
      setAuthModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/user-logout', { method: 'POST' });
      router.push('/');
    } catch {
      router.push('/');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; user?: UserProfile };

      if (!res.ok || !data.ok || !data.user) {
        throw new Error(data.error || 'Erro ao atualizar perfil.');
      }

      setUser(data.user);
      setProfileMsg({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setEditingProfile(false), 1500);
    } catch (err) {
      setProfileMsg({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao guardar.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const roleBadge = (role: string) => {
    const roles: Record<string, { label: string; bg: string; color: string }> = {
      proprietario: { label: 'Proprietário', bg: '#fbf0e2', color: '#9d6d2b' },
      coorganizador: { label: 'Coorganizador', bg: '#f7e7ec', color: '#7b2a47' },
      recepcao: { label: 'Recepção', bg: '#eaf7ed', color: '#2b7a48' },
      catering: { label: 'Catering & Bar', bg: '#fff2e6', color: '#9e5b24' },
      audiovisual: { label: 'Audiovisual (Live)', bg: '#eaf2fb', color: '#265b94' },
      fotografia: { label: 'Fotografia', bg: '#f2eafb', color: '#682cb0' },
      comissao: { label: 'Comissão', bg: '#f0ecee', color: '#594d52' },
    };
    const r = roles[role] || { label: role, bg: '#f0ecee', color: '#594d52' };
    return (
      <span
        style={{
          display: 'inline-block',
          background: r.bg,
          color: r.color,
          fontSize: '10.5px',
          fontWeight: 700,
          letterSpacing: '1px',
          padding: '4px 10px',
          borderRadius: '20px',
        }}
      >
        ✦ {r.label.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="home-portal-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header className="home-navbar">
        <div className="home-brand" onClick={() => router.push('/')}>
          <div className="home-brand-icon">
            <Sparkles size={22} />
          </div>
          <div>
            <strong>EVENTOX</strong>
            <small>PAINEL DO UTILIZADOR</small>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user && (
            <button
              onClick={() => setEditingProfile(!editingProfile)}
              className="outline-pill"
              style={{ fontSize: '12px' }}
            >
              <User size={15} /> {user.name}
            </button>
          )}

          <button onClick={() => setCreateModalOpen(true)} className="primary-pill">
            <Plus size={16} /> Novo Evento
          </button>

          <button
            onClick={handleLogout}
            title="Terminar Sessão"
            style={{ background: 'none', border: 'none', color: '#8d757e', cursor: 'pointer', padding: '6px' }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, maxWidth: '1100px', width: '100%', margin: '0 auto', padding: '35px 20px 60px' }}>
        {/* Profile edit card if toggled */}
        {editingProfile && user && (
          <div className="auth-modal-card" style={{ maxWidth: '600px', margin: '0 auto 35px', padding: '28px' }}>
            <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '22px', color: '#381f2a', margin: '0 0 16px' }}>
              Definições de Perfil
            </h3>

            {profileMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  marginBottom: '14px',
                  background: profileMsg.type === 'success' ? '#eaf7ed' : '#fff0f2',
                  color: profileMsg.type === 'success' ? '#2b7a48' : '#a82e44',
                }}
              >
                {profileMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="auth-field-row">
                <label className="auth-field">
                  <span>Nome Completo</span>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="auth-field">
                  <span>Contacto Telefónico</span>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+258 84 000 0000" />
                </label>
              </div>

              <div style={{ borderTop: '1px solid #f0e6e9', paddingTop: '14px', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#7a3148', display: 'block', marginBottom: '8px' }}>
                  ALTERAR PALAVRA-PASSE (OPCIONAL)
                </span>
                <div className="auth-field-row">
                  <label className="auth-field">
                    <span>Palavra-passe Atual</span>
                    <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                  </label>
                  <label className="auth-field">
                    <span>Nova Palavra-passe</span>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres..." />
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="auth-secondary-btn" onClick={() => setEditingProfile(false)}>
                  Cancelar
                </button>
                <button type="submit" className="auth-submit-btn" disabled={profileSaving} style={{ margin: 0 }}>
                  {profileSaving ? 'A guardar…' : 'Guardar Alterações'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '2px', color: '#ad8751' }}>
              ✦ GESTÃO DE EVENTOS COLABORATIVOS ✦
            </span>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '32px', color: '#381f2a', margin: '6px 0 0' }}>
              As Tuas Celebrações
            </h1>
            <p style={{ color: '#7b686f', fontSize: '13px', margin: '6px 0 0' }}>
              Acede aos painéis de controlo, operação em ecrã gigante (Eventox Live) e gestão de equipa.
            </p>
          </div>

          <button onClick={() => setCreateModalOpen(true)} className="primary-pill">
            <Plus size={16} /> Novo Evento
          </button>
        </div>

        {/* Events Grid */}
        {events.length === 0 ? (
          <div style={{ background: '#ffffff', border: '1px solid #ebd9dc', borderRadius: '18px', padding: '60px 20px', textAlign: 'center' }}>
            <Sparkles size={40} style={{ color: '#c59a58', margin: '0 auto 16px' }} />
            <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '24px', color: '#3b202c', margin: '0 0 8px' }}>
              Ainda não tens celebrações ativas
            </h3>
            <p style={{ color: '#816e75', fontSize: '13px', maxWidth: '420px', margin: '0 auto 24px' }}>
              Cria o teu primeiro evento ou pede ao proprietário de uma celebração para te enviar um convite de equipa.
            </p>
            <button onClick={() => setCreateModalOpen(true)} className="primary-pill">
              <Plus size={16} /> Criar a Minha Primeira Celebração
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {events.map((ev) => (
              <div
                key={ev.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #ebd8dc',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 4px 18px rgba(45, 18, 28, 0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  {roleBadge(ev.role)}
                  <span style={{ fontSize: '11px', color: '#978289', fontWeight: 600 }}>
                    /{ev.slug}
                  </span>
                </div>

                <div>
                  <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '21px', color: '#381e28', margin: '0 0 4px' }}>
                    {ev.title}
                  </h3>
                  <p style={{ fontSize: '12.5px', color: '#79666c', margin: 0 }}>
                    Anfitrião: <strong>{ev.hostName}</strong>
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', color: '#8a747b', borderTop: '1px solid #f2e9ec', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <CalendarDays size={14} style={{ color: '#b4833e' }} />
                    <span>{new Date((ev.eventDate || '2026-12-11T14:00') + ':00+02:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <MapPin size={14} style={{ color: '#b4833e' }} />
                    <span>{ev.venue || 'Local a definir'}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: 'auto', paddingTop: '6px' }}>
                  <button
                    onClick={() => router.push(`/${ev.slug}`)}
                    className="auth-submit-btn"
                    style={{ margin: 0, padding: '10px 12px', fontSize: '12px' }}
                  >
                    Painel Gestão →
                  </button>

                  <a
                    href={`/${ev.slug}/screen`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="auth-secondary-btn"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textDecoration: 'none', padding: '10px 12px', fontSize: '12px' }}
                  >
                    <Tv size={14} /> Modo Ecrã ↗
                  </a>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f6eff1', paddingTop: '10px', fontSize: '11px' }}>
                  <a
                    href={`/${ev.slug}/screen/control`}
                    style={{ color: '#265b94', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Sliders size={12} /> Controlo Live
                  </a>

                  <a
                    href={`/${ev.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#7a3148', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    Portal do Convidado <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Auth / Create Event Modal */}
      <AuthModal
        isOpen={authModalOpen || createModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setCreateModalOpen(false);
        }}
        defaultMode={createModalOpen ? 'register' : 'login'}
        onLoginSuccess={() => loadData()}
      />
    </div>
  );
}
