'use client';

import { useState } from 'react';
import { ArrowLeftRight, Crown, Edit3, Plus, Search, Trash2, UtensilsCrossed, X } from 'lucide-react';

type Table = { id: number; name: string; capacity: number };
type Guest = { id: number; name: string; tableId: number; seat: number };
type Destination = { tableId: number; seat: number; guestId: number | null };
type Move = Destination & { id: number; fromTableId: number; fromSeat: number };
const guestDragType = 'application/x-eventox-seating-guest';
const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export default function SeatingPlanner<T extends Guest>({
  tables, guests, canMove, canCreate, canEditTable, canDeleteTable, canViewGuests, saving, error,
  onMove, onCreateGuest, onEditGuest, onEditTable, onDeleteTable, onViewGuests,
}: {
  tables: Table[];
  guests: T[];
  canMove: boolean;
  canCreate: boolean;
  canEditTable: boolean;
  canDeleteTable: boolean;
  canViewGuests: boolean;
  saving: boolean;
  error: string;
  onMove: (move: Move) => Promise<boolean>;
  onCreateGuest: (tableId: number, seat: number) => void;
  onEditGuest: (guest: T) => void;
  onEditTable: (table: Table) => void;
  onDeleteTable: (tableId: number) => void;
  onViewGuests: (tableId: number) => void;
}) {
  const [selected, setSelected] = useState<T | null>(null);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [view, setView] = useState<'lista' | 'planta'>('lista');
  const tableNames = new Map(tables.map(table => [table.id, table.name]));
  const guestsByTable = new Map<number, Map<number, T>>();
  for (const guest of guests) {
    if (!guestsByTable.has(guest.tableId)) guestsByTable.set(guest.tableId, new Map());
    guestsByTable.get(guest.tableId)!.set(guest.seat, guest);
  }
  const matches = query.trim()
    ? guests.filter(guest => normalize(guest.name).includes(normalize(query.trim()))).slice(0, 6) : [];
  const destinationGuest = guests.find(guest => guest.id === destination?.guestId);

  function select(guest: T) {
    setNotice('');
    setSelected(guest);
    setDestination(null);
    setQuery('');
  }

  function choose(tableId: number, seat: number, occupant?: T) {
    if (saving) return;
    setNotice('');
    if (selected) {
      if (occupant?.id === selected.id) return setDestination(null);
      setDestination({ tableId, seat, guestId: occupant?.id ?? null });
    } else if (occupant && canMove) {
      select(occupant);
    } else if (!occupant && canCreate) {
      onCreateGuest(tableId, seat);
    }
  }

  async function confirmMove() {
    if (!selected || !destination || saving) return;
    const name = selected.name;
    const label = `${tableNames.get(destination.tableId)} · lugar ${destination.seat}`;
    const success = await onMove({
      id: selected.id, fromTableId: selected.tableId, fromSeat: selected.seat, ...destination,
    });
    setSelected(null);
    setDestination(null);
    if (success) setNotice(`${name} · ${label}. ${destination.guestId ? 'Lugares trocados.' : 'Mudança guardada.'}`);
  }

  return (
    <div className="seating-planner">
      <div className="seating-toolbar">
        <div className="desk-tabs" role="group" aria-label="Vista das mesas">
          <button type="button" aria-pressed={view === 'lista'} onClick={() => setView('lista')}>Lugares por nome</button>
          <button type="button" aria-pressed={view === 'planta'} onClick={() => setView('planta')}>Planta</button>
        </div>
        {canMove && (
          <div className="seating-search">
            <label className="desk-search"><Search size={18} aria-hidden="true" />
              <input type="search" value={query} aria-label="Localizar convidado" placeholder="Localizar convidado"
                disabled={saving} onChange={event => setQuery(event.target.value)} />
            </label>
            {query.trim() && (
              <ul className="seating-results" aria-label="Convidados encontrados">
                {matches.map(guest => (
                  <li key={guest.id}>
                    <button type="button" disabled={saving} onClick={() => select(guest)}>
                      <strong>{guest.name}</strong><small>{tableNames.get(guest.tableId)} · Lugar {guest.seat}</small>
                    </button>
                  </li>
                ))}
                {!matches.length && <li>Nenhum convidado encontrado.</li>}
              </ul>
            )}
          </div>
        )}
      </div>

      {(selected || notice || error) && (
        <div className="seating-selection" aria-live="polite">
          {selected ? (
            <>
              <div>
                <strong>{selected.name}</strong>
                <p>{tableNames.get(selected.tableId)} · Lugar {selected.seat}</p>
                <p>{destination ? (
                  <>{destination.guestId ? 'Trocar com ' : 'Mover para '}
                    <strong>{destinationGuest?.name ? `${destinationGuest.name} · ` : ''}{tableNames.get(destination.tableId)} · lugar {destination.seat}</strong></>
                ) : 'Escolhe um lugar de destino.'}</p>
              </div>
              <div className="organizer-actions">
                {destination ? (
                  <button type="button" className="primary" disabled={saving} onClick={confirmMove}>
                    <ArrowLeftRight size={17} />{saving ? 'A guardar…' : destination.guestId ? 'Trocar lugares' : 'Mover convidado'}
                  </button>
                ) : <button type="button" className="outline" disabled={saving} onClick={() => {
                  onEditGuest(selected); setSelected(null);
                }}>Editar ficha</button>}
                <button type="button" className="outline" disabled={saving} onClick={() => {
                  setSelected(null); setDestination(null);
                }}><X size={16} /> Cancelar</button>
              </div>
            </>
          ) : <p>{error || notice}</p>}
        </div>
      )}

      <div className="seating-tables">
        {tables.map(table => {
          const seats = guestsByTable.get(table.id);
          const count = seats?.size ?? 0;
          const honor = table.name.toLowerCase().includes('honra');
          const circle = view === 'planta' && table.capacity <= 10 && canViewGuests;
          return (
            <article key={table.id} className={`seat-card seating-table ${honor ? 'seat-card-honra' : ''}`}>
              <header>
                <div>
                  <h2>{table.name}</h2>
                  <p>{canViewGuests ? `${count} de ${table.capacity} ocupados` : `${table.capacity} lugares`}</p>
                </div>
                <div className="seating-table-actions">
                  {canEditTable && <button type="button" className="outline" aria-label={`Editar ${table.name}`}
                    onClick={() => onEditTable(table)}><Edit3 size={16} /></button>}
                  {canDeleteTable && canViewGuests && !count && <button type="button" className="outline" aria-label={`Eliminar ${table.name}`}
                    onClick={() => onDeleteTable(table.id)}><Trash2 size={16} /></button>}
                </div>
              </header>
              {canViewGuests && (
                <div className={circle ? 'diagram seating-visual' : 'seating-place-list'}>
                  {circle && (
                    <div className={`round ${honor ? 'round-honra' : ''}`} aria-hidden="true">
                      {honor ? <Crown size={24} /> : <UtensilsCrossed size={24} />}
                      <small>{count}/{table.capacity}</small>
                    </div>
                  )}
                  {Array.from({ length: table.capacity }, (_, index) => {
                    const seat = index + 1;
                    const guest = seats?.get(seat);
                    const active = selected?.id === guest?.id && Boolean(guest);
                    const target = destination?.tableId === table.id && destination.seat === seat;
                    const label = `${table.name}, lugar ${seat}: ${guest?.name ?? 'Livre'}`;
                    const angle = (index / table.capacity) * 2 * Math.PI - Math.PI / 2;
                    const style = circle && table.capacity !== 10
                      ? { left: `${92 + 88 * Math.cos(angle)}px`, top: `${88 + 88 * Math.sin(angle)}px` } : undefined;
                    return (
                      <button key={seat} type="button"
                        className={circle
                          ? `seat seating-dot ${table.capacity === 10 ? `pos-${seat}` : ''} ${guest ? 'taken' : ''}`
                          : 'seating-place'}
                        style={style} aria-label={label} title={circle ? label : undefined}
                        data-selected={active} data-target={target} disabled={saving}
                        aria-disabled={!canMove && (Boolean(guest) || !canCreate)}
                        draggable={canMove && !saving && Boolean(guest)}
                        onClick={() => choose(table.id, seat, guest)}
                        onDragStart={event => {
                          if (!guest || !canMove) return;
                          event.dataTransfer.setData(guestDragType, String(guest.id));
                          event.dataTransfer.effectAllowed = 'move';
                          select(guest);
                        }}
                        onDragOver={event => {
                          if (canMove && !saving && event.dataTransfer.types.includes(guestDragType)) {
                            event.preventDefault(); event.dataTransfer.dropEffect = 'move';
                          }
                        }}
                        onDrop={event => {
                          if (!canMove || saving) return;
                          const source = guests.find(item => item.id === Number(event.dataTransfer.getData(guestDragType)));
                          if (!source) return;
                          event.preventDefault();
                          if (source.id === guest?.id) return;
                          setSelected(source);
                          setDestination({ tableId: table.id, seat, guestId: guest?.id ?? null });
                        }}>
                        <span>{seat}</span>
                        {!circle && <strong>{guest?.name ?? (selected ? 'Livre' : <><Plus size={14} /> Livre</>)}</strong>}
                      </button>
                    );
                  })}
                </div>
              )}
              {canViewGuests && <button type="button" className="text-link" onClick={() => onViewGuests(table.id)}>Ver convidados desta mesa</button>}
            </article>
          );
        })}
      </div>
    </div>
  );
}
