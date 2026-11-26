'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays, Camera, Check, Clock3, Download, Edit3, Eye, GlassWater, Heart,
  LayoutDashboard, MapPin, Menu, Music2, Plus, Search, Settings2, Sparkles,
  Trash2, Users, UtensilsCrossed, ClipboardList, X, LogOut, ExternalLink,
  Copy, CheckCheck, Link2, Share2, QrCode, Monitor, Shield, UserCheck, Radio,
  MonitorPlay, Palette, Crown,
  type LucideIcon
} from 'lucide-react';
import QRCode from 'qrcode';
import { hasPermission } from '../lib/permissions';
import Hospitality from './Hospitality';
import GuestImport from './GuestImport';
import Committee from './Committee';
import Gallery from './Gallery';
import SeatingPlanner from './SeatingPlanner';
import ReceptionDesk from './ReceptionDesk';
import EventProgramEditor from './EventProgramEditor';
import EventModeration from './EventModeration';
import TeamManagement from '../components/TeamManagement';
import ScreenLiveDashboard from '../components/ScreenLiveDashboard';
import LiveStudioDashboard from '../components/LiveStudioDashboard';
import EventThemeSelector from '../components/EventThemeSelector';

type Table = { id: number; name: string; capacity: number };
type Guest = { id: number; name: string; phone: string; tableId: number; seat: number; status: string; notes: string };
type Data = {
  tables: Table[];
  pendingOrders?: number;
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

const sectionPermissions: Record<string, string> = {
  guests: 'guests:view',
  reception: 'guests:checkin',
  program: 'event:manage',
  moderation: 'gallery:moderate',
  tables: 'tables:view',
  studio: 'screen:control',
  screen: 'screen:control',
  templates: 'event:manage',
  menu: 'hospitality:view',
  orders: 'hospitality:view',
  playlist: 'playlist:view',
  committee: 'committee:view',
  team: 'team:view',
  settings: 'event:manage',
};

const navigation = [
  { items: [{ id: 'overview', label: 'Visão geral', icon: LayoutDashboard }] },
  { label: 'Evento', items: [
    { id: 'guests', label: 'Convidados', icon: Users },
    { id: 'reception', label: 'Receção', icon: UserCheck },
    { id: 'tables', label: 'Mesas e lugares', icon: UtensilsCrossed },
    { id: 'program', label: 'Programa', icon: CalendarDays },
  ] },
  { label: 'Operação', items: [
    { id: 'menu', label: 'Cardápio e bar', icon: UtensilsCrossed },
    { id: 'orders', label: 'Pedidos', icon: ClipboardList },
    { id: 'playlist', label: 'Playlist', icon: Music2 },
    { id: 'studio', label: 'Estúdio Live', icon: MonitorPlay },
    { id: 'moderation', label: 'Galeria e mural', icon: Camera },
  ] },
  { label: 'Organização', items: [
    { id: 'committee', label: 'Comissão', icon: Users },
    { id: 'team', label: 'Equipa e acessos', icon: Shield },
    { id: 'templates', label: 'Aparência', icon: Palette },
    { id: 'settings', label: 'Configurações', icon: Settings2 },
  ] },
];

export default function AdminDashboard({
  slug,
  role = 'admin',
  permissions = ['*'],
  onExit,
}: {
  slug: string;
  role?: string;
  permissions?: string[];
  onExit?: () => void;
}) {
  const can = (permission: string) => hasPermission(role, permissions, permission);
  const [data, setData] = useState<Data>(initial);
  const [tab, setTab] = useState(() => can('event:manage')
    ? 'overview'
    : role === 'recepcao' ? 'reception' : Object.keys(sectionPermissions).find(section => can(sectionPermissions[section])) || 'overview');
  const [programDirty, setProgramDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState(false);
  const navigationDialog = useRef<HTMLDialogElement>(null);
  const panelContent = useRef<HTMLElement>(null);

  useEffect(() => {
    const dialog = navigationDialog.current;
    if (!dialog) return;
    if (menu && !dialog.open) dialog.showModal();
    if (!menu && dialog.open) dialog.close();
  }, [menu]);

  useEffect(() => {
    const compact = window.matchMedia('(max-width: 1100px)');
    const closeOnDesktop = () => { if (!compact.matches) setMenu(false); };
    compact.addEventListener('change', closeOnDesktop);
    return () => compact.removeEventListener('change', closeOnDesktop);
  }, []);
  const [edit, setEdit] = useState<Guest | null>(null);
  const [rename, setRename] = useState<Table | null>(null);
  const [tableModal, setTableModal] = useState<{ id: number; name: string; capacity: number } | null>(null);
  const [prefs, setPrefs] = useState(initial.settings);
  const [query, setQuery] = useState('');
  const [orderFilter, setOrderFilter] = useState('ativos');
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

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Não foi possível copiar o link público.');
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
      await load();
      setError(e instanceof Error ? e.message : 'Erro ao guardar');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleCheckIn = async (guest: Guest) => {
    const success = await save({ action: 'guest-status', id: guest.id, status: 'presente' });
    if (success) {
      try {
        await fetch(`/api/screen/${slug}/messages`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'trigger-welcome', guestId: guest.id }),
        });
      } catch {}
    }
    return success;
  };

  const handleLogout = async () => {
    if (programDirty && !window.confirm('Sair sem guardar as alterações do programa?')) return;
    try {
      await Promise.all([
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ slug }),
        }),
        fetch('/api/auth/user-logout', { method: 'POST' }),
      ]);
    } catch {}
    window.location.href = `/${slug}`;
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
  const go = (name: string) => {
    if (tab === 'program' && name !== tab && programDirty) {
      if (!window.confirm('Sair sem guardar as alterações do programa?')) return;
      setProgramDirty(false);
    }
    if (name !== 'orders') setOrderFilter('ativos');
    if (name === 'overview' || can(sectionPermissions[name])) {
      setTab(name);
      if (name !== tab) window.requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        panelContent.current?.focus({ preventScroll: true });
      });
    }
    setMenu(false);
  };

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

  const eventDisplay = data.settings.eventName || 'Evento';
  const sectionName = navigation.flatMap(group => group.items).find(item => item.id === tab)?.label || 'Estúdio Live';

  function renderNavigation(compact = false) {
    return (
      <>
        <div className="organizer-brand">
          <a href="/" aria-label="Eventox, página inicial"><Sparkles size={18} aria-hidden="true" /> Eventox</a>
          {compact && (
            <button type="button" className="organizer-icon-button" onClick={() => setMenu(false)} aria-label="Fechar menu">
              <X size={20} />
            </button>
          )}
          <p>{eventDisplay}</p>
        </div>
        <nav aria-label="Secções do painel">
          {navigation.map(group => {
            const items = group.items.filter(item => item.id === 'overview' || can(sectionPermissions[item.id]));
            if (!items.length) return null;
            return (
              <div className="organizer-nav-group" key={group.label ?? 'overview'}>
                {group.label && <p className="organizer-nav-label">{group.label}</p>}
                {items.map(({ id, label, icon: Icon }) => (
                  <button type="button" key={id} className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                    {id === 'guests' && <b>{data.guests.length}</b>}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
      </>
    );
  }

  return (
    <div className="app organizer-app">
      <aside className="sidebar organizer-sidebar">{renderNavigation()}</aside>
      <dialog id="organizer-menu" ref={navigationDialog} className="sidebar organizer-drawer" aria-label="Menu da organização"
        onClose={() => setMenu(false)} onClick={event => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
            setMenu(false);
          }
        }}>
        {renderNavigation(true)}
      </dialog>

      <main className="organizer-main" ref={panelContent} tabIndex={-1}>
        <header className="organizer-topbar">
          <div className="organizer-location">
            <button type="button" className="organizer-menu-trigger" aria-label="Abrir menu"
              aria-haspopup="dialog" aria-controls="organizer-menu" aria-expanded={menu} onClick={() => setMenu(true)}>
              <Menu size={21} aria-hidden="true" />
            </button>
            <div><small>{eventDisplay}</small><strong>{sectionName}</strong></div>
          </div>
          <div className="organizer-header-actions">
            {onExit ? (
              <button type="button" className="organizer-header-action" onClick={onExit} aria-label="Ver como convidado" title="Ver como convidado">
                <Eye size={18} aria-hidden="true" /><span>Ver convite</span>
              </button>
            ) : (
              <a className="organizer-header-action" href={`/${slug}`} aria-label="Ver como convidado" title="Ver como convidado">
                <Eye size={18} aria-hidden="true" /><span>Ver convite</span>
              </a>
            )}
            {can('screen:control') && (
              <a className="organizer-header-action" href={`/${slug}/screen`} target="_blank" rel="noopener noreferrer"
                aria-label="Abrir ecrã do evento" title="Abrir ecrã do evento">
                <MonitorPlay size={18} aria-hidden="true" /><span>Ecrã</span>
              </a>
            )}
            <button type="button" className="organizer-header-action" onClick={handleLogout} aria-label="Sair" title="Sair">
              <LogOut size={18} aria-hidden="true" /><span>Sair</span>
            </button>
          </div>
        </header>

        <div className="body">
          {error && <div className="error">{error}<button onClick={() => setError('')}><X size={17} /></button></div>}
          {loading && <div className="loading">A carregar os dados do evento…</div>}

          {(['menu', 'orders', 'playlist'].includes(tab)) && (
            <Hospitality key={`${tab}:${orderFilter}`} initialOrderFilter={orderFilter} mode={tab as 'menu' | 'orders' | 'playlist'} tables={data.tables} slug={slug} />
          )}

          {tab === 'committee' && <Committee slug={slug} />}

          {tab === 'team' && <TeamManagement slug={slug} />}

          {(tab === 'studio' || tab === 'screen') && <LiveStudioDashboard slug={slug} />}

          {tab === 'templates' && (
            <section className="appearance-panel">
              <header className="desk-heading">
                <h1>Aparência do convite</h1>
                <p>Experimenta um tema e aplica-o quando quiseres atualizar a página pública.</p>
              </header>
              <EventThemeSelector
                currentTheme={data.event?.coverTheme || 'gala-gold'}
                eventTitle={eventDisplay}
                slug={slug}
                onThemeChanged={(newTheme) => {
                  setData((prev) => ({
                    ...prev,
                    event: prev.event ? { ...prev.event, coverTheme: newTheme } : prev.event,
                  }));
                }}
              />
            </section>
          )}

          {tab === 'program' && <EventProgramEditor slug={slug} onDirtyChange={setProgramDirty} />}
          {tab === 'moderation' && <EventModeration slug={slug} />}
          {tab === 'reception' && (
            <ReceptionDesk guests={data.guests} tables={data.tables} loading={loading} onCheckIn={handleCheckIn} />
          )}

          {tab === 'overview' && (
            <>
              <div className="page-head organizer-overview-head">
                <div>
                  <h1>{data.settings.eventName}</h1>
                  <p>{data.settings.venue}</p>
                </div>
                <button type="button" className="outline" disabled={!publicUrl} onClick={copyLink}>
                  <Copy size={16} /> {copied ? 'Link copiado' : 'Copiar link público'}
                </button>
              </div>

              <div className="metrics organizer-metrics">
                {can('guests:view') && (<>
                  <button className="metric" onClick={() => { setQuery(''); setTableFilter(0); setStatusFilter('pendente'); go('guests'); }}>
                    <span>Presenças por confirmar</span><strong>{loading ? '…' : pending}</strong>
                  </button>
                  <button className="metric" onClick={() => { setQuery(''); setTableFilter(0); setStatusFilter('presente'); go('guests'); }}>
                    <span>Chegadas registadas</span><strong>{loading ? '…' : data.guests.filter(g => g.status === 'presente').length}</strong>
                  </button>
                </>)}
                {can('tables:view') && can('guests:view') && (
                  <button className="metric" onClick={() => go('tables')}>
                    <span>Lugares livres</span><strong>{loading ? '…' : data.tables.reduce((total, table) => total + free(table.id).length, 0)}</strong>
                  </button>
                )}
                {can('hospitality:view') && (
                  <button className="metric" onClick={() => { setOrderFilter('pendente'); go('orders'); }}>
                    <span>Pedidos pendentes</span><strong>{loading ? '…' : data.pendingOrders ?? 0}</strong>
                  </button>
                )}
              </div>

              {can('tables:view') && can('guests:view') && (<>
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
                    <button className={`table-summary ${isHonra ? 'table-summary-honra' : ''}`} key={t.id} onClick={() => { setQuery(''); setStatusFilter('todos'); setTableFilter(t.id); go('guests'); }}>
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
              </>)}
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
                  {can('guests:create') && <button className="outline" disabled={loading} onClick={() => setImportOpen(true)}><ClipboardList size={17} /> Importar lista</button>}
                  <button className="outline" onClick={csv}><Download size={17} /> Exportar CSV</button>
                  {can('guests:create') && <button className="primary" onClick={() => add()}><Plus size={18} /> Adicionar convidado</button>}
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
                              {can('guests:rsvp') && ['pendente', 'recusado'].includes(g.status) && (
                                <button className="outline" type="button" disabled={saving}
                                  onClick={() => save({ action: 'guest-status', id: g.id, status: 'confirmado' })}>
                                  Confirmar presença
                                </button>
                              )}
                              {g.status !== 'presente' && can('guests:checkin') && (
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
                              )}
                              {g.status === 'presente' && (
                                <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, padding: '2px 6px' }}>
                                  ✓ No Salão
                                </span>
                              )}
                              {can('guests:edit') && <button title="Editar" onClick={() => setEdit({ ...g })}><Edit3 size={17} /></button>}
                              {can('guests:delete') && <button title="Eliminar" onClick={async () => { if (confirm('Eliminar este convidado?')) await save({ action: 'guest-delete', id: g.id }); }}><Trash2 size={17} /></button>}
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
            <section>
              <div className="page-head menu-management-heading">
                <div>
                  <h1>Mesas e lugares</h1>
                  {can('guests:edit') && <p>Seleciona um convidado e depois o lugar de destino. No computador, também podes arrastar.</p>}
                </div>
                {can('tables:create') && (
                  <button type="button" className="primary" onClick={() => setTableModal({ id: 0, name: '', capacity: 10 })}>
                    <Plus size={16} /> Nova mesa
                  </button>
                )}
              </div>
              {!hasMesaHonra && can('tables:create') && (
                <div className="mesa-honra-banner">
                  <strong>Mesa de honra</strong>
                  <button type="button" className="btn-mesa-honra" disabled={saving}
                    onClick={() => save({ action: 'table-create', name: 'Mesa de Honra', capacity: 4 })}>
                    <Crown size={15} /> Adicionar mesa de honra
                  </button>
                </div>
              )}
              {data.tables.length > 0 ? (
                <SeatingPlanner tables={sortedTables} guests={data.guests} saving={saving} error={error}
                  canMove={can('guests:edit')} canCreate={can('guests:create')}
                  canEditTable={can('tables:edit')} canDeleteTable={can('tables:delete')} canViewGuests={can('guests:view')}
                  onMove={move => save({ action: 'guest-move', ...move })}
                  onCreateGuest={add} onEditGuest={guest => setEdit({ ...guest })}
                  onEditTable={table => setTableModal({ ...table })} onDeleteTable={handleDeleteTable}
                  onViewGuests={id => { setQuery(''); setStatusFilter('todos'); setTableFilter(id); go('guests'); }} />
              ) : !loading && <p className="desk-empty">Ainda não há mesas neste evento.</p>}
            </section>
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

              <div className="settings-card theme-settings-link">
                <div><h2>Aparência do convite</h2><p>Pré-visualiza e aplica os temas do evento.</p></div>
                <button type="button" className="outline" onClick={() => go('templates')}>Gerir aparência</button>
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
