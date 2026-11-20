'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, Check, ClipboardList, ExternalLink, GlassWater,
  Minus, Music2, Package, Play, Plus, Search, Trash2, UtensilsCrossed,
  X, Sparkles, ChefHat, Salad, Beef, Cake, Moon, Wine, Info
} from 'lucide-react';
import EmbeddedMusicPlayer from '../components/EmbeddedMusicPlayer';

type Table = { id: number; name: string };
type Item = {
  id: number;
  name: string;
  category: string;
  description: string;
  stock: number;
  unit: string;
  available: boolean;
};
type Order = {
  id: number;
  tableId: number;
  itemId: number;
  quantity: number;
  status: string;
  note: string;
  createdAt: string;
};
type Song = {
  id: number;
  title: string;
  artist: string;
  url: string;
  position: number;
  status: string;
};
type Payload = { items: Item[]; orders: Order[]; songs: Song[] };

export const CATEGORY_META: Record<
  string,
  { label: string; group: 'food' | 'drink'; icon: string; badgeColor: string; placeholderName: string; placeholderDesc: string }
> = {
  entrada: {
    label: 'Entradas & Canapés',
    group: 'food',
    icon: '🥗',
    badgeColor: '#10b981',
    placeholderName: 'Ex.: Tártaro de Salmão com Abacate ou Tábua de Queijos Nobres',
    placeholderDesc: 'Indica os ingredientes, molhos e acompanhamentos finos...',
  },
  prato_principal: {
    label: 'Pratos Principais',
    group: 'food',
    icon: '🥩',
    badgeColor: '#f59e0b',
    placeholderName: 'Ex.: Lombo de Novilho em Crosta de Ervas Finas com Gratin',
    placeholderDesc: 'Guarnições, ponto de carne, peixe, molhos especiais ou opção vegetariana...',
  },
  comida: {
    label: 'Pratos Principais',
    group: 'food',
    icon: '🥩',
    badgeColor: '#f59e0b',
    placeholderName: 'Ex.: Lombo de Novilho ou Robalo Selvagem Grelhado',
    placeholderDesc: 'Detalhes gastronómicos do prato principal...',
  },
  sobremesa: {
    label: 'Sobremesas & Doces',
    group: 'food',
    icon: '🍰',
    badgeColor: '#ec4899',
    placeholderName: 'Ex.: Bolo de Gala Red Velvet & Frutos Silvestres',
    placeholderDesc: 'Camadas do bolo, sobremesas individuais ou mesa de frutas...',
  },
  lanche: {
    label: 'Ceia & Lanches Noturnos',
    group: 'food',
    icon: '🌙',
    badgeColor: '#a855f7',
    placeholderName: 'Ex.: Caldo Verde Tradicional com Broa ou Mini Pregos',
    placeholderDesc: 'Serviço da madrugada para recuperar energias na festa...',
  },
  bebida: {
    label: 'Bar, Vinhos & Bebidas',
    group: 'drink',
    icon: '🥂',
    badgeColor: '#38bdf8',
    placeholderName: 'Ex.: Espumante Brut de Honra 750ml ou Cocktail de Assinatura',
    placeholderDesc: 'Garrafeira, cocktails, cervejas ou refrigerantes e águas...',
  },
  bar: {
    label: 'Bar, Vinhos & Bebidas',
    group: 'drink',
    icon: '🥂',
    badgeColor: '#38bdf8',
    placeholderName: 'Ex.: Cocktail Eventox Gold com Gin e Citrinos',
    placeholderDesc: 'Bebidas alcoólicas e não-alcoólicas...',
  },
};

const blankItem: Item = {
  id: 0,
  name: '',
  category: 'prato_principal',
  description: '',
  stock: 120,
  unit: 'prato',
  available: true,
};

const blankSong: Song = { id: 0, title: '', artist: '', url: '', position: 0, status: 'fila' };
const orderStatus: Record<string, string> = {
  pendente: 'Pendente',
  preparacao: 'Em preparação',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const isFoodCategory = (c: string) => ['entrada', 'prato_principal', 'comida', 'sobremesa', 'lanche'].includes(c);

export default function Hospitality({
  mode,
  tables,
  slug = 'emerson',
}: {
  mode: 'menu' | 'orders' | 'playlist';
  tables: Table[];
  slug?: string;
}) {
  const [data, setData] = useState<Payload>({ items: [], orders: [], songs: [] });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [itemEdit, setItemEdit] = useState<Item | null>(null);
  const [itemTypeTab, setItemTypeTab] = useState<'food' | 'drink'>('food');
  const [songEdit, setSongEdit] = useState<Song | null>(null);
  const [category, setCategory] = useState('todos');
  const [search, setSearch] = useState('');
  const [orderTable, setOrderTable] = useState(1);
  const [orderItem, setOrderItem] = useState(0);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [orderFilter, setOrderFilter] = useState('ativos');
  const [activePlayingSong, setActivePlayingSong] = useState<Song | null>(null);

  const load = async () => {
    const res = await fetch('/api/hospitality?slug=' + encodeURIComponent(slug), { cache: 'no-store' });
    const json = (await res.json()) as Payload & { error?: string };
    if (!res.ok) throw Error(json.error);
    setData(json);
  };

  useEffect(() => {
    load().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [slug]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/hospitality?slug=' + encodeURIComponent(slug), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw Error(json.error);
      await load();
      setSuccess('Alterações guardadas com sucesso.');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocorreu um erro');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleImportGalaTemplate = async () => {
    if (!confirm('Desejas pré-carregar o Menu de Gala Completo (Entradas finas, 3 Pratos Principais, Sobremesas, Ceia e Bar de Gala)?')) {
      return;
    }
    const ok = await act({ action: 'template-gala-menu' });
    if (ok) {
      setSuccess('✦ Menu de Gala completo pré-carregado com sucesso!');
    }
  };

  const products = useMemo(() => {
    return data.items.filter((p) => {
      let matchCategory = false;
      if (category === 'todos') {
        matchCategory = true;
      } else if (category === 'comidas') {
        matchCategory = isFoodCategory(p.category);
      } else if (category === 'bebidas') {
        matchCategory = p.category === 'bebida' || p.category === 'bar';
      } else if (category === 'prato_principal') {
        matchCategory = p.category === 'prato_principal' || p.category === 'comida';
      } else {
        matchCategory = p.category === category;
      }

      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());

      return matchCategory && matchSearch;
    });
  }, [data.items, category, search]);

  const ordered = useMemo(() => {
    return data.orders
      .filter((o) =>
        orderFilter === 'todos'
          ? true
          : orderFilter === 'ativos'
          ? !['entregue', 'cancelado'].includes(o.status)
          : o.status === orderFilter
      )
      .sort((a, b) => b.id - a.id);
  }, [data.orders, orderFilter]);

  const sortedSongs = [...data.songs].sort((a, b) => a.position - b.position || a.id - b.id);
  const available = data.items.filter((p) => p.available && p.stock > 0);
  const activeOrders = data.orders.filter((o) => !['entregue', 'cancelado'].includes(o.status)).length;

  const nameOf = (id: number) => data.items.find((p) => p.id === id)?.name || 'Produto removido';
  const tableOf = (id: number) => tables.find((t) => t.id === id)?.name || `Mesa ${id}`;

  const countEntradas = data.items.filter((x) => x.category === 'entrada').length;
  const countPratos = data.items.filter((x) => x.category === 'prato_principal' || x.category === 'comida').length;
  const countSobremesas = data.items.filter((x) => x.category === 'sobremesa').length;
  const countBebidas = data.items.filter((x) => x.category === 'bebida' || x.category === 'bar').length;
  const countLanches = data.items.filter((x) => x.category === 'lanche').length;

  // Sync modal category tab when opening edit
  const openEditModal = (item: Item, initialType?: 'food' | 'drink') => {
    const isFood = initialType ? initialType === 'food' : isFoodCategory(item.category);
    setItemTypeTab(isFood ? 'food' : 'drink');
    setItemEdit(item);
  };

  const currentMeta = CATEGORY_META[itemEdit?.category || 'prato_principal'] || CATEGORY_META['prato_principal'];

  return (
    <div className="hospitality">
      {error && (
        <div className="error">
          {error}
          <button onClick={() => setError('')}>
            <X size={17} />
          </button>
        </div>
      )}
      {success && (
        <div className="h-success">
          {success}
          <button onClick={() => setSuccess('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {loading && <p className="loading">A carregar informações…</p>}

      {mode === 'menu' && (
        <>
          <div className="page-head flex-wrap gap-4">
            <div>
              <span className="overline">GASTRONOMIA, CATERING & BAR</span>
              <h1>Cardápio & Serviço da Festa</h1>
              <p>Organiza as refeições completas (entradas, pratos principais, sobremesas, ceia) e o bar de bebidas em tempo real.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="outline"
                onClick={handleImportGalaTemplate}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderColor: '#d4af37',
                  color: '#d4af37',
                  fontWeight: 600,
                  fontSize: '12.5px',
                  padding: '10px 16px',
                }}
                title="Pré-carregar um cardápio completo de gala com entradas, pratos, sobremesas e bar"
              >
                <Sparkles size={16} /> Pré-Carregar Menu de Gala
              </button>
              <button
                className="outline"
                onClick={() =>
                  openEditModal(
                    { ...blankItem, category: 'bebida', unit: 'garrafa', stock: 50 },
                    'drink'
                  )
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  fontSize: '12.5px',
                  padding: '10px 16px',
                }}
              >
                <GlassWater size={16} className="text-sky-500" /> + Bebida / Bar
              </button>
              <button
                className="primary"
                onClick={() =>
                  openEditModal(
                    { ...blankItem, category: 'prato_principal', unit: 'prato', stock: 120 },
                    'food'
                  )
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  padding: '10px 18px',
                }}
              >
                <UtensilsCrossed size={16} /> + Comida / Prato
              </button>
            </div>
          </div>

          {/* Quick Catering Summary Stats */}
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6"
            style={{ marginBottom: '24px' }}
          >
            <div
              onClick={() => setCategory('entrada')}
              className={`p-3.5 rounded-xl border cursor-pointer transition ${
                category === 'entrada'
                  ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md'
                  : 'bg-white border-neutral-200 hover:border-emerald-400'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🥗</span>
                <div>
                  <b className="block text-xl font-serif text-neutral-900 leading-tight">{countEntradas}</b>
                  <span className="text-xs text-neutral-500">Entradas & Canapés</span>
                </div>
              </div>
            </div>

            <div
              onClick={() => setCategory('prato_principal')}
              className={`p-3.5 rounded-xl border cursor-pointer transition ${
                category === 'prato_principal'
                  ? 'bg-amber-500/10 border-amber-500/50 shadow-md'
                  : 'bg-white border-neutral-200 hover:border-amber-400'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🥩</span>
                <div>
                  <b className="block text-xl font-serif text-neutral-900 leading-tight">{countPratos}</b>
                  <span className="text-xs text-neutral-500">Pratos Principais</span>
                </div>
              </div>
            </div>

            <div
              onClick={() => setCategory('sobremesa')}
              className={`p-3.5 rounded-xl border cursor-pointer transition ${
                category === 'sobremesa'
                  ? 'bg-pink-500/10 border-pink-500/50 shadow-md'
                  : 'bg-white border-neutral-200 hover:border-pink-400'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🍰</span>
                <div>
                  <b className="block text-xl font-serif text-neutral-900 leading-tight">{countSobremesas}</b>
                  <span className="text-xs text-neutral-500">Sobremesas & Doces</span>
                </div>
              </div>
            </div>

            <div
              onClick={() => setCategory('bebidas')}
              className={`p-3.5 rounded-xl border cursor-pointer transition ${
                category === 'bebidas'
                  ? 'bg-sky-500/10 border-sky-500/50 shadow-md'
                  : 'bg-white border-neutral-200 hover:border-sky-400'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🥂</span>
                <div>
                  <b className="block text-xl font-serif text-neutral-900 leading-tight">{countBebidas}</b>
                  <span className="text-xs text-neutral-500">Bar & Bebidas</span>
                </div>
              </div>
            </div>

            <div
              onClick={() => setCategory('lanche')}
              className={`p-3.5 rounded-xl border cursor-pointer transition ${
                category === 'lanche'
                  ? 'bg-purple-500/10 border-purple-500/50 shadow-md'
                  : 'bg-white border-neutral-200 hover:border-purple-400'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🌙</span>
                <div>
                  <b className="block text-xl font-serif text-neutral-900 leading-tight">{countLanches}</b>
                  <span className="text-xs text-neutral-500">Ceia & Lanches</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filtering toolbar */}
          <div className="h-toolbar">
            <label className="search">
              <Search size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por prato, ingrediente ou bebida…"
              />
            </label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="todos">🍽️ Todos os Itens ({data.items.length})</option>
              <option value="comidas">🍲 Todas as Comidas ({countEntradas + countPratos + countSobremesas + countLanches})</option>
              <option value="entrada">🥗 Entradas & Canapés ({countEntradas})</option>
              <option value="prato_principal">🥩 Pratos Principais ({countPratos})</option>
              <option value="sobremesa">🍰 Sobremesas & Doces ({countSobremesas})</option>
              <option value="bebidas">🥂 Bar & Bebidas ({countBebidas})</option>
              <option value="lanche">🌙 Ceia & Lanches Noturnos ({countLanches})</option>
            </select>
          </div>

          {/* Products Grid */}
          <div className="h-products">
            {products.map((p) => {
              const meta = CATEGORY_META[p.category] || CATEGORY_META['prato_principal'];
              const isFood = isFoodCategory(p.category);

              return (
                <article className="h-product" key={p.id}>
                  <div
                    className="h-prod-icon"
                    style={{
                      background: `${meta.badgeColor}15`,
                      color: meta.badgeColor,
                      fontSize: '22px',
                    }}
                  >
                    {meta.icon}
                  </div>
                  <div className="h-prod-copy">
                    <span
                      className="overline"
                      style={{ color: meta.badgeColor, fontWeight: 700 }}
                    >
                      {meta.label.toUpperCase()}
                    </span>
                    <h3>{p.name}</h3>
                    <p>{p.description || (isFood ? 'Prato confeccionado pela comissão de catering' : 'Bebida disponível no bar')}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={'h-stock ' + (p.stock === 0 ? 'out' : p.stock <= 5 ? 'low' : '')}>
                        {p.stock} {p.unit}
                        {p.stock === 0 ? ' · Esgotado' : p.stock <= 5 ? ' · Stock baixo' : ''}
                      </span>
                      {p.available ? (
                        <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          ✓ No cardápio público
                        </span>
                      ) : (
                        <span className="h-inactive">Oculto</span>
                      )}
                    </div>
                  </div>
                  <div className="h-prod-actions">
                    <button onClick={() => openEditModal(p)}>Editar</button>
                    <button
                      title="Eliminar produto"
                      onClick={async () => {
                        if (confirm(`Remover "${p.name}" do cardápio?`)) {
                          await act({ action: 'item-delete', id: p.id });
                        }
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {!products.length && (
            <div className="empty" style={{ background: 'white', borderRadius: '16px', padding: '50px 20px', border: '1px solid var(--line)' }}>
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-3xl">
                🍽️
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px', color: '#3d2531' }}>
                O cardápio gastronómico está à espera das primeiras opções
              </h3>
              <p style={{ fontSize: '13px', color: '#7a6870', maxWidth: '460px', margin: '0 auto 20px' }}>
                Adiciona as entradas, pratos principais, sobremesas e bebidas da festa, ou usa o botão abaixo para pré-carregar um Menu de Gala com 1 clique.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  className="primary"
                  onClick={handleImportGalaTemplate}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <Sparkles size={16} /> Pré-Carregar Menu de Gala Completo
                </button>
                <button
                  className="outline"
                  onClick={() =>
                    openEditModal(
                      { ...blankItem, category: 'prato_principal', unit: 'prato', stock: 120 },
                      'food'
                    )
                  }
                >
                  <Plus size={16} /> Criar Prato do Zero
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'orders' && (
        <>
          <div className="page-head">
            <div>
              <span className="overline">SERVIÇO ÀS MESAS</span>
              <h1>Pedidos da festa</h1>
              <p>Regista os pedidos por mesa (refeições, bebidas, pedidos especiais) e acompanha a preparação e entrega.</p>
            </div>
            <span className="capacity">{activeOrders} pedidos ativos</span>
          </div>

          <div className="h-order-layout">
            <section className="h-order-form">
              <h2>
                <ClipboardList size={21} /> Novo pedido para mesa
              </h2>
              <p>Ao registar, a quantidade é reservada e atualizada no controlo do serviço.</p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await act({
                      action: 'order-create',
                      tableId: orderTable,
                      itemId: orderItem,
                      quantity: qty,
                      note,
                    })
                  ) {
                    setQty(1);
                    setNote('');
                  }
                }}
              >
                <label className="field">
                  Mesa
                  <select value={orderTable} onChange={(e) => setOrderTable(+e.target.value)}>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        Mesa {t.id} — {t.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Item do Cardápio (Comida ou Bebida)
                  <select required value={orderItem} onChange={(e) => setOrderItem(+e.target.value)}>
                    <option value={0}>Seleciona o item do pedido...</option>
                    <optgroup label="🍽️ Comidas & Pratos da Gala">
                      {available
                        .filter((p) => isFoodCategory(p.category))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {CATEGORY_META[p.category]?.icon || '🍲'} {p.name} · {p.stock} {p.unit}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="🥂 Bar & Bebidas">
                      {available
                        .filter((p) => !isFoodCategory(p.category))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            🥂 {p.name} · {p.stock} {p.unit}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </label>

                <label className="field">
                  Quantidade
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={qty}
                    onChange={(e) => setQty(+e.target.value)}
                  />
                </label>

                <label className="field">
                  Observações de Preparação / Alergénios
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Ex.: sem gelo, ponto bem passado, servir em simultâneo com a mesa 2…"
                  />
                </label>

                <button className="primary" disabled={busy || !orderItem || !available.length}>
                  <Plus size={17} /> Registar pedido para mesa
                </button>
              </form>
            </section>

            <section className="h-order-list">
              <div className="h-list-head">
                <h2>Pedidos registados</h2>
                <select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)}>
                  <option value="ativos">Ativos</option>
                  <option value="todos">Todos</option>
                  {Object.entries(orderStatus).map(([k, v]) => (
                    <option value={k} key={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {ordered.map((o) => (
                <article className="h-order" key={o.id}>
                  <div className="h-order-id">
                    <strong>#{String(o.id).padStart(3, '0')}</strong>
                    <small>
                      {new Date(o.createdAt).toLocaleString('pt-PT', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                        timeZone: 'Africa/Maputo',
                      })}
                    </small>
                  </div>
                  <div className="h-order-body">
                    <strong>
                      {nameOf(o.itemId)} <span>× {o.quantity}</span>
                    </strong>
                    <p>
                      Mesa {o.tableId} · {tableOf(o.tableId)}
                    </p>
                    {o.note && <small>“{o.note}”</small>}
                  </div>
                  <div className="h-order-control">
                    <span className={'h-status ' + o.status}>{orderStatus[o.status]}</span>
                    <select
                      aria-label={`Estado do pedido ${o.id}`}
                      value={o.status}
                      disabled={busy || o.status === 'cancelado'}
                      onChange={(e) => act({ action: 'order-status', id: o.id, status: e.target.value })}
                    >
                      {Object.entries(orderStatus).map(([k, v]) => (
                        <option
                          key={k}
                          value={k}
                          disabled={o.status === 'entregue' && k === 'cancelado'}
                        >
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}

              {!ordered.length && (
                <Empty
                  icon={<ClipboardList />}
                  title="Sem pedidos neste estado"
                  subtitle="Os pedidos das mesas aparecerão aqui."
                />
              )}
            </section>
          </div>
        </>
      )}

      {mode === 'playlist' && (
        <>
          <div className="page-head">
            <div>
              <span className="overline">BANDA SONORA DA CELEBRAÇÃO</span>
              <h1>Playlist da festa</h1>
              <p>Prepara a ordem das músicas, adiciona links e acompanha o que já tocou.</p>
            </div>
            <button className="primary" onClick={() => setSongEdit({ ...blankSong })}>
              <Plus size={17} /> Adicionar música
            </button>
          </div>

          <div className="h-music-banner">
            <Music2 size={31} />
            <div>
              <span className="overline">A NOSSA BANDA SONORA</span>
              <h2>Os momentos especiais merecem a música certa.</h2>
              <p>
                {data.songs.length} músicas na lista · {data.songs.filter((s) => s.status === 'tocada').length} já tocadas
              </p>
            </div>
          </div>

          <div className="h-song-list">
            {sortedSongs.map((s, i) => (
              <article className="h-song" key={s.id}>
                <span className="h-song-no">{String(i + 1).padStart(2, '0')}</span>
                <span className="h-song-icon">
                  <Music2 size={19} />
                </span>
                <div className="h-song-copy">
                  <strong>{s.title}</strong>
                  <small>{s.artist || 'Artista não indicado'}</small>
                </div>
                <span className={'h-song-status ' + s.status}>
                  {s.status === 'fila' ? 'Na fila' : s.status === 'tocando' ? 'A tocar' : 'Já tocou'}
                </span>
                <div className="h-song-actions">
                  <button
                    type="button"
                    title="Ouvir no painel"
                    onClick={() => setActivePlayingSong(s)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(212,175,55,0.15)',
                      border: '1px solid rgba(212,175,55,0.4)',
                      color: '#f1db96',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '11.5px',
                      fontWeight: 600,
                    }}
                  >
                    <Play size={13} /> Ouvir
                  </button>
                  <button
                    title="Subir"
                    disabled={i === 0 || busy}
                    onClick={() => act({ action: 'song-move', id: s.id, direction: -1 })}
                  >
                    <ArrowUp size={17} />
                  </button>
                  <button
                    title="Descer"
                    disabled={i === sortedSongs.length - 1 || busy}
                    onClick={() => act({ action: 'song-move', id: s.id, direction: 1 })}
                  >
                    <ArrowDown size={17} />
                  </button>
                  <button title="Editar" onClick={() => setSongEdit({ ...s })}>
                    Editar
                  </button>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" title="Abrir externamente">
                      <ExternalLink size={17} />
                    </a>
                  )}
                  <button
                    title="Eliminar"
                    onClick={async () => {
                      if (confirm(`Remover ${s.title}?`)) {
                        await act({ action: 'song-delete', id: s.id });
                      }
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="h-song-controls">
                  <button
                    disabled={busy}
                    onClick={() =>
                      act({
                        action: 'song-status',
                        id: s.id,
                        status: s.status === 'tocando' ? 'fila' : 'tocando',
                      })
                    }
                  >
                    {s.status === 'tocando' ? 'Retirar de reprodução' : 'Marcar a tocar'}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      act({
                        action: 'song-status',
                        id: s.id,
                        status: s.status === 'tocada' ? 'fila' : 'tocada',
                      })
                    }
                  >
                    {s.status === 'tocada' ? 'Voltar à fila' : 'Marcar como tocada'}
                  </button>
                </div>
              </article>
            ))}
          </div>

          {!sortedSongs.length && (
            <Empty icon={<Music2 />} title="A tua playlist começa aqui" subtitle="Adiciona músicas e define a sequência da festa." />
          )}
          <p className="h-disclaimer">
            Podes reproduzir músicas diretamente no painel através do leitor incorporado (YouTube & Spotify).
          </p>
        </>
      )}

      {/* MODAL: ADD / EDIT MENU ITEM (FOOD & DRINKS) */}
      {itemEdit && (
        <div
          className="modal-cover"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setItemEdit(null);
          }}
        >
          <div className="modal" style={{ maxWidth: '620px' }}>
            <div className="modal-title">
              <div>
                <span className="overline">GASTRONOMIA & CATERING</span>
                <h2>{itemEdit.id ? 'Editar Item do Cardápio' : 'Adicionar ao Cardápio'}</h2>
              </div>
              <button onClick={() => setItemEdit(null)}>
                <X />
              </button>
            </div>

            {/* Segmented Type Toggle: Comida vs Bebida */}
            <div
              className="flex items-center gap-2 p-1.5 rounded-xl border border-neutral-200 bg-neutral-100 mb-5"
            >
              <button
                type="button"
                onClick={() => {
                  setItemTypeTab('food');
                  if (!isFoodCategory(itemEdit.category)) {
                    setItemEdit({ ...itemEdit, category: 'prato_principal', unit: 'prato' });
                  }
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                  itemTypeTab === 'food'
                    ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200/80'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <span>🍽️</span> Refeição / Prato de Comida
              </button>
              <button
                type="button"
                onClick={() => {
                  setItemTypeTab('drink');
                  setItemEdit({ ...itemEdit, category: 'bebida', unit: 'garrafa' });
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                  itemTypeTab === 'drink'
                    ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200/80'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <span>🥂</span> Bebida / Bar da Festa
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act({ action: 'item-save', ...itemEdit })) {
                  setItemEdit(null);
                }
              }}
              className="form-grid"
            >
              <label className="field">
                Secção do Cardápio
                {itemTypeTab === 'food' ? (
                  <select
                    value={itemEdit.category === 'comida' ? 'prato_principal' : itemEdit.category}
                    onChange={(e) => setItemEdit({ ...itemEdit, category: e.target.value })}
                  >
                    <option value="entrada">🥗 Entrada & Canapé (Aperitivos)</option>
                    <option value="prato_principal">🥩 Prato Principal (Carne / Peixe / Vegetariano)</option>
                    <option value="sobremesa">🍰 Sobremesa & Doces (Bolo Comemorativo)</option>
                    <option value="lanche">🌙 Ceia & Lanches Noturnos (Madrugada)</option>
                  </select>
                ) : (
                  <select
                    value={itemEdit.category}
                    onChange={(e) => setItemEdit({ ...itemEdit, category: e.target.value })}
                  >
                    <option value="bebida">🥂 Garrafeira, Cocktails, Cervejas & Bebidas</option>
                  </select>
                )}
              </label>

              <label className="field">
                Unidade de Serviço
                <select
                  value={itemEdit.unit}
                  onChange={(e) => setItemEdit({ ...itemEdit, unit: e.target.value })}
                >
                  {itemTypeTab === 'food' ? (
                    <>
                      <option value="prato">prato</option>
                      <option value="dose">dose</option>
                      <option value="porção">porção</option>
                      <option value="buffet livre">buffet livre</option>
                      <option value="fatia">fatia</option>
                      <option value="tigela">tigela</option>
                      <option value="travessa">travessa</option>
                      <option value="unidade">unidade</option>
                    </>
                  ) : (
                    <>
                      <option value="garrafa">garrafa</option>
                      <option value="copo">copo</option>
                      <option value="taça">taça</option>
                      <option value="lata">lata</option>
                      <option value="dose">dose</option>
                      <option value="unidade">unidade</option>
                      <option value="litro">litro</option>
                    </>
                  )}
                </select>
              </label>

              <label className="field full">
                Nome do Prato ou Bebida *
                <input
                  autoFocus
                  required
                  value={itemEdit.name}
                  onChange={(e) => setItemEdit({ ...itemEdit, name: e.target.value })}
                  placeholder={currentMeta.placeholderName}
                />
              </label>

              <label className="field full">
                Descrição & Ingredientes Principais
                <textarea
                  rows={3}
                  value={itemEdit.description}
                  onChange={(e) => setItemEdit({ ...itemEdit, description: e.target.value })}
                  placeholder={currentMeta.placeholderDesc}
                />
              </label>

              <label className="field">
                {itemTypeTab === 'food' ? 'Doses / Porções Previstas' : 'Quantidade em Stock'}
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  required
                  value={itemEdit.stock}
                  onChange={(e) => setItemEdit({ ...itemEdit, stock: +e.target.value })}
                />
              </label>

              <label className="field h-checkbox" style={{ paddingTop: '24px' }}>
                <input
                  type="checkbox"
                  checked={itemEdit.available}
                  onChange={(e) => setItemEdit({ ...itemEdit, available: e.target.checked })}
                />
                Visível no cardápio dos convidados
              </label>

              <div className="modal-actions full">
                <button type="button" className="outline" onClick={() => setItemEdit(null)}>
                  Cancelar
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? 'A guardar…' : '✦ Guardar no Cardápio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT SONG */}
      {songEdit && (
        <div
          className="modal-cover"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSongEdit(null);
          }}
        >
          <div className="modal compact">
            <div className="modal-title">
              <div>
                <span className="overline">PLAYLIST</span>
                <h2>{songEdit.id ? 'Editar música' : 'Adicionar música'}</h2>
              </div>
              <button onClick={() => setSongEdit(null)}>
                <X />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act({ action: 'song-save', ...songEdit })) {
                  setSongEdit(null);
                }
              }}
              className="form-grid"
            >
              <label className="field full">
                Título da música
                <input
                  autoFocus
                  required
                  value={songEdit.title}
                  onChange={(e) => setSongEdit({ ...songEdit, title: e.target.value })}
                />
              </label>
              <label className="field full">
                Artista
                <input
                  value={songEdit.artist}
                  onChange={(e) => setSongEdit({ ...songEdit, artist: e.target.value })}
                />
              </label>
              <label className="field full">
                Link (YouTube, Spotify, etc.)
                <input
                  type="url"
                  value={songEdit.url}
                  onChange={(e) => setSongEdit({ ...songEdit, url: e.target.value })}
                  placeholder="https://…"
                />
              </label>
              <div className="modal-actions full">
                <button type="button" className="outline" onClick={() => setSongEdit(null)}>
                  Cancelar
                </button>
                <button className="primary" disabled={busy}>
                  Guardar música
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <EmbeddedMusicPlayer song={activePlayingSong} onClose={() => setActivePlayingSong(null)} />
    </div>
  );
}

function Empty({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      <p>{subtitle}</p>
    </div>
  );
}
