'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Camera, Check, Clock3, Download, Edit3, GlassWater, Heart,
  LayoutDashboard, MapPin, Menu, Music2, Plus, Search, Settings2, Sparkles,
  Trash2, Users, UtensilsCrossed, ClipboardList, X, LogOut, ExternalLink,
  Copy, CheckCheck, Link2, Share2, QrCode, Monitor, Shield, UserCheck, Radio,
  MonitorPlay, Palette, Crown,
  type LucideIcon
} from 'lucide-react';
import QRCode from 'qrcode';
import Hospitality from './Hospitality';
import GuestImport from './GuestImport';
import Committee from './Committee';
import Gallery from './Gallery';
import Countdown from '../components/Countdown';
import TeamManagement from '../components/TeamManagement';
import ScreenLiveDashboard from '../components/ScreenLiveDashboard';
import LiveStudioDashboard from '../components/LiveStudioDashboard';
import EventThemeSelector from '../components/EventThemeSelector';

type Table = { id: number; name: string; capacity: number };
type Guest = { id: number; name: string; phone: string; tableId: number; seat: number; status: string; notes: string };
type Data = {
  tables: Table[];
  guests: Guest[];
  settings: Record<string, string>;
  event?: {
    id: number;
    slug: string;
    title: string;
    hostName: string;
    eventDate: string;
    venue: string;
    description: string;
    coverTheme?: string;
  };
};

const initial: Data = {
  tables: [],
  guests: [],
  settings: {
    eventName: 'Celebração de Evento',
    eventDate: '2026-12-11T14:00',
    venue: 'Local a definir',
    hostName: 'Anfitrião',
    photoAlbumUrl: '',
  },
};

const statuses: Record<string, string> = {
  pendente: 'A aguardar',
  confirmado: 'Confirmado',
  recusado: 'Não comparece',
  presente: 'Presente',
};

const blank: Guest = { id: 0, name: '', phone: '', tableId: 1, seat: 1, status: 'pendente', notes: '' };

export default function AdminDashboard({ slug = 'emerson', onExit }: { slug?: string; onExit?: () => void }) {
  const [data, setData] = useState<Data>(initial);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState<Guest | null>(null);
  const [rename, setRename] = useState<Table | null>(null);
  const [tableModal, setTableModal] = useState<{ id: number; name: string; capacity: number } | null>(null);
  const [prefs, setPrefs] = useState(initial.settings);
  const [query, setQuery] = useState('');
  const [tableFilter, setTableFilter] = useState(0);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [importOpen, setImportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [publicUrl, setPublicUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/${slug}`;
      setPublicUrl(url);
      QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: { dark: '#502232', light: '#ffffff' }
      }).then(setQrCode).catch(() => setQrCode(''));
    }
  }, [slug]);

  const copyLink = () => {
    if (publicUrl && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const load = async () => {
    try {
      const r = await fetch(`/api/management?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
      const j = await r.json() as Data & { error?: string };
      if (!r.ok) throw new Error(j.error || 'Erro ao carregar dados');
      setData(j);
      setPrefs(j.settings || initial.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [slug]);

  const save = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError('');
    try {
      const r = await fetch(`/api/management?slug=${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json() as { error?: string };
      if (!r.ok) throw new Error(j.error || 'Erro ao guardar');
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleCheckIn = async (guest: Guest) => {
    const success = await save({ action: 'guest-save', ...guest, status: 'presente' });
    if (success) {
      try {
        await fetch(`/api/screen/${slug}/messages`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'trigger-welcome', guestId: guest.id }),
        });
      } catch {}
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
    } catch {}
    if (onExit) onExit();
    else window.location.href = `/${slug}`;
  };

  const occupied = (id: number, exclude = 0) => data.guests.filter(g => g.tableId === id && g.id !== exclude).map(g => g.seat);
  const free = (id: number, exclude = 0) => {
    const cap = data.tables.find(t => t.id === id)?.capacity || 10;
    return Array.from({ length: cap }, (_, i) => i + 1).filter(n => !occupied(id, exclude).includes(n));
  };
  const add = (id = data.tables[0]?.id || 1, seat?: number) => setEdit({ ...blank, tableId: id, seat: seat || free(id)[0] || 1 });

  const sortedTables = useMemo(() => {
    return [...data.tables].sort((a, b) => {
      const aHonra = a.name.toLowerCase().includes('honra');
      const bHonra = b.name.toLowerCase().includes('honra');
      if (aHonra && !bHonra) return -1;
      if (!aHonra && bHonra) return 1;
      return a.id - b.id;
    });
  }, [data.tables]);

  const hasMesaHonra = useMemo(() => {
    return data.tables.some(t => t.name.toLowerCase().includes('honra'));
  }, [data.tables]);

  const getSeatStyle = (seatNum: number, capacity: number): React.CSSProperties | undefined => {
    if (capacity === 10) return undefined;
    const angle = ((seatNum - 1) / capacity) * 2 * Math.PI - Math.PI / 2;
    const left = Math.round(92 + 88 * Math.cos(angle));
    const top = Math.round(88 + 88 * Math.sin(angle));
    return { left: `${left}px`, top: `${top}px` };
  };

  const handleDeleteTable = async (tableId: number) => {
    const target = data.tables.find(t => t.id === tableId);
    if (!target) return;
    const people = data.guests.filter(g => g.tableId === tableId);
    if (people.length > 0) {
      alert(`Não é possível eliminar a mesa "${target.name}" porque possui ${people.length} convidado(s) atribuído(s).`);
      return;
    }
    if (!confirm(`Tens a certeza que desejas eliminar a mesa "${target.name}"?`)) return;
    await save({ action: 'table-delete', id: tableId });
    setTableModal(null);
  };

  const filtered = useMemo(() => data.guests.filter(g =>
    g.name.toLowerCase().includes(query.toLowerCase()) &&
    (!tableFilter || g.tableId === tableFilter) &&
    (statusFilter === 'todos' || g.status === statusFilter)
  ).sort((a, b) => a.tableId - b.tableId || a.seat - b.seat), [data.guests, query, tableFilter, statusFilter]);

  const yes = data.guests.filter(g => ['confirmado', 'presente'].includes(g.status)).length;
  const pending = data.guests.filter(g => g.status === 'pendente').length;
  const go = (name: string) => { setTab(name); setMenu(false); };

  const csv = () => {
    const rows = [
      ['Nome', 'Telefone', 'Mesa', 'Lugar', 'Estado', 'Notas'],
      ...data.guests.map(g => [
        g.name,
        g.phone,
        data.tables.find(t => t.id === g.tableId)?.name || '',
        String(g.seat),
        statuses[g.status] || g.status,
        g.notes
      ])
    ];
    const str = '\uFEFF' + rows.map(row => row.map(v => '"' + v.replaceAll('"', '""') + '"').join(';')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([str], { type: 'text/csv;charset=utf-8' }));
    link.download = `convidados-${slug}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const hostDisplay = data.settings.hostName || (slug === 'emerson' ? 'EMERSON CHARLES' : 'ANFITRIÃO');
  const eventDisplay = data.settings.eventName || 'EVENTO 2026';

  return (
    <div className="app">
      <aside className={'sidebar ' + (menu ? 'show' : '')}>
        <div className="brand">
          <div className="brand-icon"><Sparkles /></div>
          <div>
            <small>{hostDisplay.toUpperCase()}</small>
            <strong>{eventDisplay.toUpperCase()}</strong>
          </div>
          <button className="close-mobile" onClick={() => setMenu(false)}><X /></button>
        </div>
        <p className="sidebar-label">ORGANIZAÇÃO DO EVENTO</p>
        <nav>
          {[
            ['overview', LayoutDashboard, 'Visão geral'],
            ['guests', Users, 'Convidados'],
            ['tables', UtensilsCrossed, 'Mesas & lugares'],
            ['studio', MonitorPlay, 'Estúdio Live'],
            ['templates', Palette, 'Templates & Estilo'],
            ['menu', UtensilsCrossed, 'Cardápio & Bar'],
            ['orders', ClipboardList, 'Pedidos'],
            ['playlist', Music2, 'Playlist'],
            ['committee', Users, 'Comissão'],
            ['team', Shield, 'Equipa & Acessos'],
            ['settings', Settings2, 'Configurações'],
          ].map(([id, Icon, label]) => (
            <button key={id as string} className={tab === id ? 'on' : ''} onClick={() => go(id as string)}>
              <Icon size={19} />
              {label as string}
              {id === 'guests' && <b>{data.guests.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot" style={{ cursor: 'pointer' }} onClick={() => window.open(`/${slug}`, '_blank')}>
          <ExternalLink size={18} />
          <div>
            <strong>Ver Portal Público ↗</strong>
            <span>/{slug}</span>
          </div>
        </div>
      </aside>

      {menu && <div className="shade" onClick={() => setMenu(false)} />}

      <main>
        <header className="topbar">
          <div>
            <button className="hamburger" onClick={() => setMenu(true)}><Menu /></button>
            <span style={{ cursor: 'pointer' }} onClick={() => window.location.href = '/'}>Eventox</span>
            <i>/</i>
            <strong>{slug}</strong>
            <i>/</i>
            <span>{{
              overview: 'Visão geral',
              guests: 'Convidados',
              tables: 'Mesas & lugares',
              menu: 'Cardápio & Bar',
              orders: 'Pedidos',
              playlist: 'Playlist',
              studio: 'Estúdio Live 16:9',
              screen: 'Estúdio Live 16:9',
              templates: 'Templates & Identidade Visual',
              committee: 'Comissão Organizadora',
              team: 'Equipa & Acessos',
              settings: 'Configurações',
            }[tab] || tab}</span>
          </div>
          <div className="topright">
            <button
              type="button"
              onClick={() => go('studio')}
              className="outline"
              style={{
                padding: '5px 11px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: (tab === 'studio' || tab === 'screen') ? '#d97706' : '#e2e8f0',
                background: (tab === 'studio' || tab === 'screen') ? '#fef3c7' : '#ffffff',
                color: (tab === 'studio' || tab === 'screen') ? '#92400e' : '#1e293b',
                fontWeight: 600,
                cursor: 'pointer',
                borderRadius: '8px',
              }}
              title="Abrir Controlo em Direto do Ecrã 16:9"
            >
              <MonitorPlay size={15} color="#d97706" />
              <span>Estúdio Live</span>
              <span className="green-dot" style={{ width: '7px', height: '7px' }} />
            </button>
            <button
              type="button"
              onClick={() => window.open(`/${slug}/screen`, '_blank')}
              className="outline"
              style={{ padding: '5px 9px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '8px' }}
              title="Abrir Ecrã 16:9 no Projector em nova janela"
            >
              <ExternalLink size={14} />
            </button>
            <button className="outline" style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }} onClick={handleLogout} title="Sair do modo administrador">
              <LogOut size={15} /> Sair
            </button>
          </div>
        </header>

        <div className="body">
          {error && <div className="error">{error}<button onClick={() => setError('')}><X size={17} /></button></div>}
          {loading && <div className="loading">A carregar os dados do evento…</div>}

          {(['menu', 'orders', 'playlist'].includes(tab)) && (
            <Hospitality key={tab} mode={tab as 'menu' | 'orders' | 'playlist'} tables={data.tables} slug={slug} />
          )}

          {tab === 'committee' && <Committee slug={slug} />}

          {tab === 'team' && <TeamManagement slug={slug} />}

          {(tab === 'studio' || tab === 'screen') && <LiveStudioDashboard slug={slug} />}

          {tab === 'templates' && (
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
              <div style={{
                padding: '24px 28px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(217,119,6,0.15) 0%, rgba(15,23,42,0.95) 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#ffffff',
                marginBottom: '24px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
              }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', color: '#f59e0b', textTransform: 'uppercase' }}>
                  ✦ IDENTIDADE VISUAL & GALA ✦
                </span>
                <h1 style={{ fontSize: '1.75rem', fontFamily: 'serif', fontWeight: 700, color: '#ffffff', margin: '6px 0 8px 0' }}>
                  Templates & Design de Gala
                </h1>
                <p style={{ fontSize: '0.875rem', color: '#cbd5e1', maxWidth: '640px', lineHeight: 1.6 }}>
                  Escolhe o tema ideal para a tua celebração. O design selecionado aplica-se instantaneamente ao portal público dos convidados e aos ecrãs 16:9 com tipografia nobre e paletas cinematográficas.
                </p>
              </div>

              <EventThemeSelector
                currentTheme={data.event?.coverTheme || 'gala-gold'}
                slug={slug}
                onThemeChanged={(newTheme) => {
                  setData((prev) => ({
                    ...prev,
                    event: prev.event ? { ...prev.event, coverTheme: newTheme } : prev.event,
                  }));
                }}
              />
            </div>
          )}

          {tab === 'overview' && (
            <>
              <div className="hero">
                <div className="hero-copy">
                  <span className="eyebrow">✦ GESTÃO & CELEBRAÇÃO</span>
                  <p>Organização completa e controlo do evento em tempo real.</p>
                  <h1>{data.settings.eventName}<span>.</span></h1>
                  <p className="hero-description">
                    {data.event?.description || 'Celebração com as pessoas que fazem parte desta grande história.'}
                  </p>
                  <div className="hero-meta">
                    <span>
                      <CalendarDays size={17} />
                      {new Date((data.settings.eventDate || '2026-12-11T14:00') + ':00+02:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Maputo' })}
                    </span>
                    <span>
                      <MapPin size={17} />
                      {data.settings.venue || 'Local a definir'}
                    </span>
                  </div>
                </div>
                <div className="hero-ornament">✺</div>
              </div>

              <section className="count-card">
                <span className="overline"><Clock3 size={16} /> CONTAGEM REGRESSIVA PARA O GRANDE DIA</span>
                <Countdown date={data.settings.eventDate} />
                <p>Cada segundo aproxima-nos de um momento inesquecível ✦</p>
              </section>

              <div className="section-head">
                <div>
                  <span className="overline">O EVENTO EM NÚMEROS</span>
                  <h2>Panorama da celebração</h2>
                </div>
                <button onClick={() => go('guests')}>Ver convidados →</button>
              </div>

              <div className="metrics">
                {([
                  ['Convidados registados', data.guests.length, 'lugares distribuídos', Users],
                  ['Presenças confirmadas', yes, 'inclui chegadas registadas', Check],
                  ['Aguardam resposta', pending, 'convites por confirmar', Clock3],
                  ['Mesas configuradas', data.tables.length, 'distribuição espacial', UtensilsCrossed],
                ] as [string, number, string, LucideIcon][]).map(([label, value, desc, Icon], i) => (
                  <div className="metric" key={i}>
                    <div className={'metric-icon color-' + i}><Icon size={22} /></div>
                    <span>{label as string}</span>
                    <strong>{String(value).padStart(2, '0')}</strong>
                    <small>{desc as string}</small>
                  </div>
                ))}
              </div>

              <div className="section-head">
                <div>
                  <span className="overline">DISTRIBUIÇÃO DOS CONVIDADOS</span>
                  <h2>Mesas do evento</h2>
                </div>
                <button onClick={() => go('tables')}>Gerir mesas →</button>
              </div>

              <div className="overview-grid">
                {sortedTables.map(t => {
                  const count = occupied(t.id).length;
                  const isHonra = t.name.toLowerCase().includes('honra');
                  return (
                    <button className={`table-summary ${isHonra ? 'table-summary-honra' : ''}`} key={t.id} onClick={() => { setTableFilter(t.id); go('guests'); }}>
                      <span className="table-number">{isHonra ? '👑' : String(t.id).padStart(2, '0')}</span>
                      <div>
                        <strong style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {t.name}
                          {isHonra && <span style={{ fontSize: '10px', background: '#d4af3725', color: '#b8860b', padding: '1px 6px', borderRadius: '10px' }}>VIP</span>}
                        </strong>
                        <small>{count} de {t.capacity} lugares ocupados</small>
                        <div className="bar"><i style={{ width: Math.min(100, (count / t.capacity) * 100) + '%' }} /></div>
                      </div>
                      <b>↗</b>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'guests' && (
            <>
              <div className="page-head">
                <div>
                  <span className="overline">LISTA DE PARTICIPANTES</span>
                  <h1>Gestão de convidados</h1>
                  <p>Organiza nomes, lugares e confirmações num só lugar.</p>
                </div>
                <div className="actions">
                  <button className="outline" disabled={loading} onClick={() => setImportOpen(true)}><ClipboardList size={17} /> Adicionar lista</button>
                  <button className="outline" onClick={csv}><Download size={17} /> Exportar CSV</button>
                  <button className="primary" onClick={() => add()}><Plus size={18} /> Adicionar convidado</button>
                </div>
              </div>
              <div className="quick-stats">
                <span><b>{data.guests.length}</b> registados</span>
                <span>🟢 <b>{yes}</b> confirmados</span>
                <span>🟠 <b>{pending}</b> pendentes</span>
                <span>🔴 <b>{data.guests.filter(g => g.status === 'recusado').length}</b> recusados</span>
              </div>
              <div className="list-panel">
                <div className="filters">
                  <label className="search"><Search size={19} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar pelo nome…" /></label>
                  <select value={tableFilter} onChange={e => setTableFilter(+e.target.value)}>
                    <option value={0}>Todas as mesas</option>
                    {data.tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="todos">Todos os estados</option>
                    {Object.entries(statuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>CONVIDADO</th>
                        <th>MESA</th>
                        <th>LUGAR</th>
                        <th>CONFIRMAÇÃO</th>
                        <th>AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(g => (
                        <tr key={g.id}>
                          <td><b>{g.name}</b><small>{g.phone || 'Sem telefone'}</small></td>
                          <td>{data.tables.find(t => t.id === g.tableId)?.name || `Mesa ${g.tableId}`}</td>
                          <td><span className="seat-label">{String(g.seat).padStart(2, '0')}</span></td>
                          <td><span className={'status ' + g.status}>{statuses[g.status]}</span></td>
                          <td>
                            <div className="row-buttons">
                              {g.status !== 'presente' ? (
                                <button
                                  type="button"
                                  title="Fazer Check-in (Entrada) e Enviar Boas-Vindas ao Ecrã"
                                  onClick={() => handleCheckIn(g)}
                                  style={{
                                    background: '#059669',
                                    color: '#ffffff',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <UserCheck size={14} /> Entrada
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, padding: '2px 6px' }}>
                                  ✓ No Salão
                                </span>
                              )}
                              <button title="Editar" onClick={() => setEdit({ ...g })}><Edit3 size={17} /></button>
                              <button title="Eliminar" onClick={async () => { if (confirm('Eliminar este convidado?')) await save({ action: 'guest-delete', id: g.id }); }}><Trash2 size={17} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!filtered.length && (
                  <div className="empty">
                    <Users size={34} />
                    <h3>Nenhum convidado encontrado</h3>
                    <p>Adiciona o primeiro convidado ou altera os filtros.</p>
                    <button className="primary" onClick={() => add()}><Plus size={17} /> Adicionar convidado</button>
                  </div>
                )}
                <div className="list-foot">A mostrar {filtered.length} de {data.guests.length} convidados</div>
              </div>
            </>
          )}

          {tab === 'tables' && (
            <>
              <div className="page-head">
                <div>
                  <span className="overline">PLANTA DE LUGARES</span>
                  <h1>Mesas & lugares</h1>
                  <p>Lugares por mesa. Toca num lugar para atribuir um convidado.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    className="primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => setTableModal({ id: 0, name: '', capacity: 10 })}
                  >
                    <Plus size={16} /> Nova Mesa
                  </button>
                  <span className="capacity">{data.guests.length} ocupados</span>
                </div>
              </div>

              {!hasMesaHonra && (
                <div className="mesa-honra-banner">
                  <div className="banner-copy">
                    <strong>👑 Falta adicionar a Mesa de Honra?</strong>
                    <p>Cria a mesa VIP de honra com 4 lugares para o anfitrião, pais ou convidados solenes com um clique.</p>
                  </div>
                  <button
                    type="button"
                    className="btn-mesa-honra"
                    onClick={async () => {
                      await save({ action: 'table-create', name: 'Mesa de Honra', capacity: 4 });
                    }}
                  >
                    <Crown size={15} /> Adicionar Mesa de Honra (4 lugares)
                  </button>
                </div>
              )}

              <div className="seats-grid">
                {sortedTables.map(t => {
                  const people = data.guests.filter(g => g.tableId === t.id);
                  const isHonra = t.name.toLowerCase().includes('honra');
                  return (
                    <div className={`seat-card ${isHonra ? 'seat-card-honra' : ''}`} key={t.id}>
                      <div className="seat-top">
                        <span>{isHonra ? '👑 MESA DE HONRA' : `MESA ${String(t.id).padStart(2, '0')}`}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button title="Editar mesa e capacidade" onClick={() => setTableModal({ ...t })}><Edit3 size={17} /></button>
                          {people.length === 0 && (
                            <button title="Eliminar mesa vazia" style={{ color: '#b33' }} onClick={() => handleDeleteTable(t.id)}><Trash2 size={17} /></button>
                          )}
                        </div>
                      </div>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {t.name}
                        {isHonra && <span style={{ fontSize: '11px', background: '#d4af3725', color: '#b8860b', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>VIP · 4 LUGARES</span>}
                      </h3>
                      <div className="diagram">
                        <div className={`round ${isHonra ? 'round-honra' : ''}`}>
                          {isHonra ? <Crown size={24} /> : <UtensilsCrossed size={24} />}
                          <small>{people.length}/{t.capacity}</small>
                        </div>
                        {Array.from({ length: t.capacity }, (_, i) => {
                          const s = i + 1, g = people.find(g => g.seat === s);
                          const seatStyle = getSeatStyle(s, t.capacity);
                          return (
                            <button
                              key={s}
                              className={'seat' + (t.capacity === 10 ? ` pos-${s}` : '') + (g ? ' taken' : '') + (isHonra ? ' seat-honra' : '')}
                              style={seatStyle}
                              title={g ? `${g.name} (${t.name} · Lugar ${s})` : `Lugar livre ${s}`}
                              onClick={() => g ? setEdit({ ...g }) : add(t.id, s)}
                            >
                              {g ? <Check size={13} /> : s}
                            </button>
                          );
                        })}
                      </div>
                      <div className="legend">
                        <span><i className={`taken ${isHonra ? 'taken-honra' : ''}`} /> Ocupado</span>
                        <span><i /> Disponível</span>
                      </div>
                      <div className="bar"><i style={{ width: Math.min(100, (people.length / t.capacity) * 100) + '%' }} /></div>
                      <button className="text-link" onClick={() => { setTableFilter(t.id); go('guests'); }}>Ver lista da mesa →</button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'settings' && (
            <>
              <div className="page-head">
                <div>
                  <span className="overline">DETALHES DO EVENTO</span>
                  <h1>Configurações do evento</h1>
                  <p>Personaliza as informações do evento, obtém o link de visualização e gere o acesso.</p>
                </div>
              </div>

              {/* Link de Visualização do Evento */}
              <div className="settings-link-card">
                <div className="link-card-copy">
                  <span className="overline"><Link2 size={15} /> LINK DE VISUALIZAÇÃO DO CONVIDADO</span>
                  <h2>Partilha o teu evento</h2>
                  <p>
                    Os teus convidados usam este link para aceder ao portal público, consultar o countdown oficial,
                    verificar o lugar/mesa atribuído e confirmar presença (RSVP).
                  </p>

                  <div className="link-display-row">
                    <div className="link-code-box">
                      <code>{publicUrl}</code>
                    </div>
                    <button type="button" className={`copy-btn ${copied ? 'copied' : ''}`} onClick={copyLink}>
                      {copied ? <><CheckCheck size={16} /> Copiado!</> : <><Copy size={16} /> Copiar Link</>}
                    </button>
                    <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" className="preview-btn">
                      <ExternalLink size={16} /> Abrir Página ↗
                    </a>
                  </div>
                  <small className="link-hint">✦ Partilha este link por WhatsApp, redes sociais ou imprima o QR Code nos convites.</small>
                </div>

                {qrCode && (
                  <div className="link-qr-box">
                    <img src={qrCode} alt={`QR Code para ${publicUrl}`} />
                    <span>QR Code de Convite</span>
                    <a href={qrCode} download={`qrcode-${slug}.png`} className="download-qr-btn">
                      Descarregar Imagem ⬇
                    </a>
                  </div>
                )}
              </div>

              {/* Seletor Visual de Templates & Identidade do Evento */}
              <div style={{ marginTop: '24px' }}>
                <EventThemeSelector
                  currentTheme={data.event?.coverTheme || 'gala-gold'}
                  slug={slug}
                  onThemeChanged={(newTheme) => {
                    setData((prev) => ({
                      ...prev,
                      event: prev.event ? { ...prev.event, coverTheme: newTheme } : prev.event,
                    }));
                  }}
                />
              </div>

              <div className="settings-card" style={{ marginTop: '24px' }}>
                <div className="setting-icon"><CalendarDays /></div>
                <h2>Informações da celebração</h2>
                <p>Altera os detalhes do evento. As alterações refletem-se instantaneamente na página de visualização dos convidados.</p>
                <form onSubmit={async e => { e.preventDefault(); await save({ action: 'settings', ...prefs }); }} className="form-grid">
                  <label className="field">Nome do evento
                    <input required value={prefs.eventName || ''} onChange={e => setPrefs({ ...prefs, eventName: e.target.value })} placeholder="Ex.: Gala de Graduação" />
                  </label>
                  <label className="field">Nome do anfitrião
                    <input value={prefs.hostName || ''} onChange={e => setPrefs({ ...prefs, hostName: e.target.value })} placeholder="Ex.: Emerson Charles" />
                  </label>
                  <label className="field">Data e hora do evento
                    <input required type="datetime-local" value={prefs.eventDate || ''} onChange={e => setPrefs({ ...prefs, eventDate: e.target.value })} />
                  </label>
                  <label className="field">Local do evento
                    <input value={prefs.venue || ''} onChange={e => setPrefs({ ...prefs, venue: e.target.value })} placeholder="Ex.: Salão Nobre Cajada II" />
                  </label>
                  <label className="field full">Álbum Partilhado de Fotos (Google Fotos, Drive, etc.)
                    <input
                      type="url"
                      value={prefs.photoAlbumUrl || ''}
                      onChange={e => setPrefs({ ...prefs, photoAlbumUrl: e.target.value })}
                      placeholder="Ex.: https://photos.app.goo.gl/..."
                    />
                    <small style={{ color: '#888', marginTop: '4px' }}>
                      Os convidados verão o botão &quot;Adicionar Fotos ao Álbum&quot; no portal do evento para carregar fotos do telemóvel diretamente para o teu álbum.
                    </small>
                  </label>
                  <label className="field full">Descrição / Mensagem para os Convidados
                    <textarea rows={3} value={prefs.description || ''} onChange={e => setPrefs({ ...prefs, description: e.target.value })} placeholder="Uma mensagem que aparecerá no topo da página dos convidados..." />
                  </label>
                  <label className="field full">Código de Acesso de Administração (PIN)
                    <input type="text" value={prefs.passcode || ''} onChange={e => setPrefs({ ...prefs, passcode: e.target.value })} placeholder="Ex.: 2026" />
                    <small style={{ color: '#888', marginTop: '4px' }}>Este código é necessário para entrar neste painel de administração.</small>
                  </label>
                  <button className="primary" disabled={saving}>Guardar alterações</button>
                </form>
              </div>
            </>
          )}

          <footer>© 2026 Eventox <span>✦</span> Plataforma de Gestão de Eventos.</footer>
        </div>
      </main>

      {importOpen && (
        <GuestImport
          slug={slug}
          tables={data.tables}
          guests={data.guests}
          onClose={() => setImportOpen(false)}
          onImported={load}
        />
      )}

      {edit && (
        <div className="modal-cover" onMouseDown={e => { if (e.target === e.currentTarget) setEdit(null); }}>
          <div className="modal">
            <div className="modal-title">
              <div>
                <span className="overline">LISTA DE CONVIDADOS</span>
                <h2>{edit.id ? 'Editar convidado' : 'Novo convidado'}</h2>
              </div>
              <button onClick={() => setEdit(null)}><X /></button>
            </div>
            <form onSubmit={async e => { e.preventDefault(); if (await save({ action: 'guest-save', ...edit })) setEdit(null); }}>
              <div className="form-grid">
                <label className="field full">Nome completo
                  <input autoFocus required value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="Nome do convidado" />
                </label>
                <label className="field full">Telefone / WhatsApp (opcional)
                  <input value={edit.phone} onChange={e => setEdit({ ...edit, phone: e.target.value })} placeholder="+258 84 000 0000" />
                </label>
                <label className="field">Mesa
                  <select value={edit.tableId} onChange={e => { const id = +e.target.value; setEdit({ ...edit, tableId: id, seat: free(id, edit.id)[0] || 1 }); }}>
                    {sortedTables.map(t => <option key={t.id} value={t.id} disabled={!free(t.id, edit.id).length}>{t.name} ({t.capacity} lugares)</option>)}
                  </select>
                </label>
                <label className="field">Lugar
                  <select value={edit.seat} onChange={e => setEdit({ ...edit, seat: +e.target.value })}>
                    {Array.from(new Set([...free(edit.tableId, edit.id), edit.seat])).sort((a, b) => a - b).map(n => (
                      <option key={n} value={n}>Lugar #{String(n).padStart(2, '0')}</option>
                    ))}
                  </select>
                </label>
                <label className="field full">Confirmação
                  <select value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })}>
                    {Object.entries(statuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="field full">Notas
                  <textarea rows={3} value={edit.notes} onChange={e => setEdit({ ...edit, notes: e.target.value })} placeholder="Observações…" />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="outline" onClick={() => setEdit(null)}>Cancelar</button>
                <button className="primary" disabled={saving}>{saving ? 'A guardar…' : 'Guardar convidado'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tableModal && (
        <div className="modal-cover" onMouseDown={e => { if (e.target === e.currentTarget) setTableModal(null); }}>
          <div className="modal compact">
            <div className="modal-title">
              <div>
                <span className="overline">{tableModal.id === 0 ? 'NOVA MESA' : 'CONFIGURAÇÃO DA MESA'}</span>
                <h2>{tableModal.id === 0 ? 'Adicionar Nova Mesa' : 'Editar Mesa'}</h2>
              </div>
              <button onClick={() => setTableModal(null)}><X /></button>
            </div>
            <form onSubmit={async e => {
              e.preventDefault();
              const act = tableModal.id === 0 ? 'table-create' : 'table-rename';
              if (await save({ action: act, id: tableModal.id, name: tableModal.name, capacity: tableModal.capacity })) {
                setTableModal(null);
              }
            }}>
              <label className="field">Nome da mesa
                <input
                  autoFocus
                  required
                  value={tableModal.name}
                  onChange={e => setTableModal({ ...tableModal, name: e.target.value })}
                  placeholder="Ex.: Mesa de Honra, Mesa 11..."
                />
              </label>

              <label className="field" style={{ marginTop: '12px' }}>
                Capacidade (Lugares: {tableModal.capacity})
                <input
                  type="number"
                  min={2}
                  max={30}
                  required
                  value={tableModal.capacity}
                  onChange={e => setTableModal({ ...tableModal, capacity: Math.max(2, Math.min(30, +e.target.value || 2)) })}
                />
                <div className="capacity-presets">
                  <button
                    type="button"
                    className={`capacity-pill honra-preset ${tableModal.capacity === 4 && tableModal.name.toLowerCase().includes('honra') ? 'active' : ''}`}
                    onClick={() => setTableModal({ ...tableModal, name: tableModal.name || 'Mesa de Honra', capacity: 4 })}
                  >
                    👑 Honra (4 lugares)
                  </button>
                  <button
                    type="button"
                    className={`capacity-pill ${tableModal.capacity === 6 ? 'active' : ''}`}
                    onClick={() => setTableModal({ ...tableModal, capacity: 6 })}
                  >
                    Pequena (6)
                  </button>
                  <button
                    type="button"
                    className={`capacity-pill ${tableModal.capacity === 10 ? 'active' : ''}`}
                    onClick={() => setTableModal({ ...tableModal, capacity: 10 })}
                  >
                    Padrão (10)
                  </button>
                  <button
                    type="button"
                    className={`capacity-pill ${tableModal.capacity === 12 ? 'active' : ''}`}
                    onClick={() => setTableModal({ ...tableModal, capacity: 12 })}
                  >
                    Grande (12)
                  </button>
                </div>
              </label>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {tableModal.id > 0 && data.guests.filter(g => g.tableId === tableModal.id).length === 0 ? (
                  <button
                    type="button"
                    style={{ color: '#b33', background: 'transparent', border: 'none', padding: '8px 0', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => handleDeleteTable(tableModal.id)}
                  >
                    <Trash2 size={15} /> Eliminar mesa
                  </button>
                ) : <div />}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="outline" onClick={() => setTableModal(null)}>Cancelar</button>
                  <button className="primary" disabled={saving}>
                    {saving ? 'A guardar…' : (tableModal.id === 0 ? 'Criar mesa' : 'Guardar alterações')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {rename && (
        <div className="modal-cover" onMouseDown={e => { if (e.target === e.currentTarget) setRename(null); }}>
          <div className="modal compact">
            <div className="modal-title">
              <div>
                <span className="overline">PERSONALIZAÇÃO</span>
                <h2>Nome da mesa</h2>
              </div>
              <button onClick={() => setRename(null)}><X /></button>
            </div>
            <form onSubmit={async e => { e.preventDefault(); if (await save({ action: 'table-rename', id: rename.id, name: rename.name })) setRename(null); }}>
              <label className="field">Nome da mesa
                <input autoFocus required value={rename.name} onChange={e => setRename({ ...rename, name: e.target.value })} />
              </label>
              <div className="modal-actions">
                <button type="button" className="outline" onClick={() => setRename(null)}>Cancelar</button>
                <button className="primary" disabled={saving}>Guardar nome</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
