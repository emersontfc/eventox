'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, Check, ClipboardList, ExternalLink, GlassWater,
  Minus, Music2, Package, Play, Plus, Search, Trash2, UtensilsCrossed,
  X, Sandwich, Salad, CakeSlice, Wine
} from 'lucide-react';
import { menuCategories, menuCategory, type MenuCategory } from '../lib/menu-categories';
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

const categoryIcons = { doce: CakeSlice, salgado: Sandwich, entrada: Salad, bebida: GlassWater, bar: Wine };

const blankItem: Item = {
  id: 0, name: '', category: 'salgado', description: '', stock: 0, unit: 'unidade', available: true,
};

const basketUnits = ['unidade', 'porção', 'prato', 'dose', 'buffet livre', 'fatia', 'tigela', 'travessa', 'garrafa', 'copo', 'taça', 'lata', 'litro'];

const blankSong: Song = { id: 0, title: '', artist: '', url: '', position: 0, status: 'fila' };
const orderStatus: Record<string, string> = {
  pendente: 'Pendente',
  preparacao: 'Em preparação',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export default function Hospitality({
  mode,
  initialOrderFilter = 'ativos',
  tables,
  slug = 'emerson',
}: {
  mode: 'menu' | 'orders' | 'playlist';
  initialOrderFilter?: string;
  tables: Table[];
  slug?: string;
}) {
  const [data, setData] = useState<Payload>({ items: [], orders: [], songs: [] });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [itemEdit, setItemEdit] = useState<Item | null>(null);
  const [songEdit, setSongEdit] = useState<Song | null>(null);
  const [category, setCategory] = useState<MenuCategory | 'todos'>('todos');
  const [search, setSearch] = useState('');
  const [orderTable, setOrderTable] = useState(1);
  const [orderItem, setOrderItem] = useState(0);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [orderFilter, setOrderFilter] = useState(initialOrderFilter);
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

  const products = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt');
    return data.items.filter(item =>
      (category === 'todos' || menuCategory(item.category).id === category) &&
      `${item.name} ${item.description}`.toLocaleLowerCase('pt').includes(query));
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

  const currentMeta = menuCategory(itemEdit?.category ?? 'salgado');
  const selectedGroups = menuCategories.filter(group => category === 'todos' || group.id === category);

  function addItem(initialCategory: MenuCategory = category === 'todos' ? 'salgado' : category) {
    setItemEdit({ ...blankItem, category: initialCategory });
  }

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
        <section>
          <div className="page-head menu-management-heading">
            <div><h1>Cardápio e bar</h1><p>Organiza o stock e escolhe o que aparece no convite.</p></div>
            <button className="primary" type="button" onClick={() => addItem()}><Plus size={17} /> Adicionar item</button>
          </div>

          <div className="menu-management-toolbar">
            <div className="desk-tabs" role="group" aria-label="Categorias do cardápio">
              <button type="button" aria-pressed={category === 'todos'} onClick={() => setCategory('todos')}>
                Todos <b>{data.items.length}</b>
              </button>
              {menuCategories.map(({ id, label }) => (
                <button type="button" key={id} aria-pressed={category === id} onClick={() => setCategory(id)}>
                  {label} <b>{data.items.filter(item => menuCategory(item.category).id === id).length}</b>
                </button>
              ))}
            </div>
            <label className="desk-search">
              <Search size={18} aria-hidden="true" />
              <input aria-label="Pesquisar no cardápio" value={search} placeholder="Pesquisar por nome ou ingrediente"
                onChange={event => setSearch(event.target.value)} />
            </label>
          </div>

          {selectedGroups.map(group => {
            const items = products.filter(item => menuCategory(item.category).id === group.id);
            if (!items.length) return null;
            const Icon = categoryIcons[group.id];
            return (
              <section className="menu-management-group" key={group.id}>
                <h2><Icon size={19} aria-hidden="true" /> {group.label}</h2>
                <div className="h-products">
                  {items.map(item => (
                    <article className="h-product" key={item.id}>
                      <div className="h-prod-copy">
                        <h3>{item.name}</h3>
                        {item.description && <p>{item.description}</p>}
                        <div className="menu-product-status">
                          <span className={`h-stock ${item.stock === 0 ? 'out' : item.stock <= 5 ? 'low' : ''}`}>
                            {item.stock} {item.unit}{item.stock === 0 ? ' · Esgotado' : item.stock <= 5 ? ' · Stock baixo' : ''}
                          </span>
                          <span>{item.available ? 'Visível no convite' : 'Oculto'}</span>
                        </div>
                      </div>
                      <div className="h-prod-actions">
                        <button type="button" onClick={() => setItemEdit({ ...item, category: group.id })}>Editar</button>
                        <button type="button" aria-label={`Eliminar ${item.name}`} onClick={() => {
                          if (confirm(`Remover "${item.name}" do cardápio?`)) void act({ action: 'item-delete', id: item.id });
                        }}><Trash2 size={17} /></button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}

          {!products.length && !loading && (
            <div className="empty">
              <h2>{search.trim() ? 'Nenhum item encontrado' : category === 'todos' ? 'O cardápio ainda está vazio' : 'Sem itens nesta categoria'}</h2>
              {search.trim() ? <button type="button" className="outline" onClick={() => setSearch('')}>Limpar pesquisa</button>
                : <button type="button" className="outline" onClick={() => addItem()}>Adicionar item</button>}
            </div>
          )}
        </section>
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
                    {menuCategories.map(({ id, label }) => {
                      const items = available.filter(item => menuCategory(item.category).id === id);
                      return items.length > 0 && (
                        <optgroup label={label} key={id}>
                          {items.map(item => (
                            <option key={item.id} value={item.id}>{item.name} · {item.stock} {item.unit}</option>
                          ))}
                        </optgroup>
                      );
                    })}
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

      {itemEdit && (
        <div className="modal-cover" onMouseDown={event => {
          if (event.target === event.currentTarget && !busy) setItemEdit(null);
        }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="menu-item-title">
            <div className="modal-title">
              <h2 id="menu-item-title">{itemEdit.id ? 'Editar item' : 'Adicionar ao cardápio'}</h2>
              <button type="button" aria-label="Fechar" disabled={busy} onClick={() => setItemEdit(null)}><X /></button>
            </div>
            {error && <p className="auth-alert-error" role="alert">{error}</p>}
            <form className="form-grid" onSubmit={async event => {
              event.preventDefault();
              if (await act({ action: 'item-save', ...itemEdit })) setItemEdit(null);
            }}>
              <label className="field full">Nome
                <input autoFocus required maxLength={140} value={itemEdit.name} placeholder={currentMeta.example}
                  onChange={event => setItemEdit({ ...itemEdit, name: event.target.value })} />
              </label>
              <label className="field full">Categoria
                <select value={currentMeta.id} onChange={event => setItemEdit({ ...itemEdit, category: event.target.value })}>
                  {menuCategories.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
              <label className="field">Quantidade em stock
                <input type="number" min={0} max={1000000} required value={itemEdit.stock}
                  onChange={event => setItemEdit({ ...itemEdit, stock: +event.target.value })} />
              </label>
              <label className="field">Unidade
                <select value={itemEdit.unit} onChange={event => setItemEdit({ ...itemEdit, unit: event.target.value })}>
                  {Array.from(new Set([...basketUnits, itemEdit.unit])).map(unit => <option key={unit}>{unit}</option>)}
                </select>
              </label>
              <label className="field full">Descrição
                <textarea rows={3} maxLength={400} value={itemEdit.description}
                  onChange={event => setItemEdit({ ...itemEdit, description: event.target.value })} />
              </label>
              <label className="field full h-checkbox">
                <input type="checkbox" checked={itemEdit.available}
                  onChange={event => setItemEdit({ ...itemEdit, available: event.target.checked })} />
                Visível no convite
              </label>
              <div className="modal-actions full">
                <button type="button" className="outline" disabled={busy} onClick={() => setItemEdit(null)}>Cancelar</button>
                <button className="primary" disabled={busy}>{busy ? 'A guardar…' : 'Guardar item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
