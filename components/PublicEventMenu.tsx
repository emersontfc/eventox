'use client';

import { useState } from 'react';
import { GlassWater, UtensilsCrossed } from 'lucide-react';
import { menuCategories, menuCategory, menuGroups, type MenuGroup } from '../lib/menu-categories';

type Item = { id: string | number; name: string; category: string; description?: string | null; unit?: string | null };

export default function PublicEventMenu({ items }: { items: Item[] }) {
  const [filter, setFilter] = useState<MenuGroup | 'todos'>('todos');
  const groups = menuGroups.map(group => ({
    ...group,
    sections: menuCategories.filter(category => category.group === group.id)
      .map(category => ({ ...category, items: items.filter(item => menuCategory(item.category).id === category.id) }))
      .filter(section => section.items.length > 0),
  })).filter(group => group.sections.length > 0);

  return (
    <section className="portal-menu-section public-menu">
      <header className="public-menu-heading"><h2>Cardápio e bar</h2></header>
      {!items.length && <p className="public-menu-empty">O cardápio será publicado em breve.</p>}
      {groups.length > 1 && (
        <div className="public-menu-filters" role="group" aria-label="Filtrar o cardápio">
          <button type="button" aria-pressed={filter === 'todos'} onClick={() => setFilter('todos')}>Tudo</button>
          {groups.map(group => (
            <button type="button" key={group.id} aria-pressed={filter === group.id} onClick={() => setFilter(group.id)}>
              {group.label}
            </button>
          ))}
        </div>
      )}
      {groups.filter(group => filter === 'todos' || groups.length === 1 || group.id === filter).map(group => {
        const Icon = group.id === 'comidas' ? UtensilsCrossed : GlassWater;
        return (
          <section className="public-menu-group" key={group.id}>
            <h3><Icon size={19} aria-hidden="true" />{group.label}</h3>
            <div className="public-menu-grid">
              {group.sections.map(section => (
                <section className="public-menu-card" key={section.id}>
                  <h4>{section.label}</h4>
                  <ul>
                    {section.items.map(item => (
                      <li key={item.id}>
                        <div className="public-menu-item"><strong>{item.name}</strong>{item.unit && <span>{item.unit}</span>}</div>
                        {item.description && <p>{item.description}</p>}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        );
      })}
    </section>
  );
}
