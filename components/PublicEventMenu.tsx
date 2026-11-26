'use client';

import React, { useState, useMemo } from 'react';
import {
  Search, X, Sparkles, Clock3, UtensilsCrossed, GlassWater,
  Wine, Salad, Beef, Cake, ChefHat, Info
} from 'lucide-react';
import {
  menuCategories, menuCategory, menuGroups,
  type MenuCategory, type MenuGroup
} from '../lib/menu-categories';

export type MenuItem = {
  id: string | number;
  name: string;
  category: string;
  description?: string | null;
  unit?: string | null;
  stock?: number | null;
  available?: boolean;
};

// Fallback curated gala banquet menu if none configured
const DEFAULT_GALA_MENU: MenuItem[] = [
  {
    id: 'g-1',
    name: 'Tártaro de Salmão com Abacate & Citrinos',
    category: 'entrada',
    description: 'Salmão fresco finamente cortado, cubos de abacate maduro, vinagrete de citrinos frescos e emulsão de ervas finas acompanhado de tostas crocantes.',
    unit: 'porção individual',
  },
  {
    id: 'g-2',
    name: 'Bruschettas Mediterrânicas de Tomate Cereja',
    category: 'entrada',
    description: 'Pão rústico artesanal com tomate cereja confitado, manjericão fresco da horta, alho suave, azeite virgem extra e redução balsâmica.',
    unit: 'porção (3 unid)',
  },
  {
    id: 'g-3',
    name: 'Tábua de Queijos Nobres & Charcutaria Fina',
    category: 'entrada',
    description: 'Seleção requintada de queijo manchego, brie e gouda trufado, presunto serrano, nozes caramelizadas e compotas artesanais de figo.',
    unit: 'tábua de degustação',
  },
  {
    id: 'g-4',
    name: 'Lombo de Novilho em Crosta de Ervas Finas',
    category: 'prato_principal',
    description: 'Carne tenra de novilho grelhada no ponto ideal, envolvida em crosta aromática de ervas frescas com molho rico de vinho do Porto e batata gratinada dauphinoise.',
    unit: 'prato de gala',
  },
  {
    id: 'g-5',
    name: 'Robalo Selvagem na Chapa com Risotto de Limão',
    category: 'prato_principal',
    description: 'Filete de robalo selvagem selado na manteiga de tomilho, servido sobre risotto cremoso de limão siciliano e espargos verdes salteados.',
    unit: 'prato de gala',
  },
  {
    id: 'g-6',
    name: 'Ravioli de Cogumelos Selvagens com Creme de Trufa',
    category: 'prato_principal',
    description: 'Massa fresca artesanal recheada com cogumelos boletus e porto belo, envolvida em creme aveludado de trufa negra e lascas de queijo parmesão envelhecido.',
    unit: 'prato vegetariano',
  },
  {
    id: 'g-7',
    name: 'Chamuças Artesanais com Chutney de Manga',
    category: 'salgado',
    description: 'Triângulos crocantes recheados com frango estufado com especiarias orientais suaves, servidos com chutney caseiro de manga madura.',
    unit: 'porção (4 unid)',
  },
  {
    id: 'g-8',
    name: 'Rissóis Dourados de Camarão da Costa',
    category: 'salgado',
    description: 'Massa fina e estaladiça com recheio cremoso e generoso de camarão da costa e toque de coentros frescos.',
    unit: 'porção (4 unid)',
  },
  {
    id: 'g-9',
    name: 'Bolo Solene de Gala Red Velvet & Frutos Silvestres',
    category: 'doce',
    description: 'O bolo solene do corte de honra da festa: massa aveludada red velvet, recheio de cream cheese suave e cobertura generosa de frutos silvestres frescos.',
    unit: 'fatia de honra',
  },
  {
    id: 'g-10',
    name: 'Petit Gâteau de Chocolate Belga com Gelado',
    category: 'doce',
    description: 'Bolo quente com coração derretido de puro chocolate belga a 70%, servido com bola de gelado artesanal de baunilha de Madagáscar e crocante de amêndoa.',
    unit: 'dose individual',
  },
  {
    id: 'g-11',
    name: 'Mousse Aveludada de Maracujá Fresco com Merengue',
    category: 'doce',
    description: 'Creme leve, sedoso e refrescante preparado com polpa natural de maracujá, finalizado com suspiro tostado e raspas de chocolate branco.',
    unit: 'taça de cristal',
  },
  {
    id: 'g-12',
    name: 'Espumante Brut de Honra & Champagne',
    category: 'bar',
    description: 'Servido para o brinde solene oficial de abertura e corte do bolo. Bolha fina, aroma frutado e frescura incomparável para celebrar esta conquista.',
    unit: 'taça / garrafa',
  },
  {
    id: 'g-13',
    name: 'Cocktail de Assinatura "Eventox Gold"',
    category: 'bar',
    description: 'Gin premium importado, xarope artesanal de flor de sabugueiro, citrinos frescos, água tónica premium e flocos de ouro comestível.',
    unit: 'copo balão',
  },
  {
    id: 'g-14',
    name: 'Vinhos Tintos & Brancos Reserva Selecionada',
    category: 'bar',
    description: 'Garrafeira selecionada especialmente para a celebração: tintos encorpados e brancos aromáticos com perfil harmonioso para os pratos principais.',
    unit: 'garrafa / copo',
  },
  {
    id: 'g-15',
    name: 'Águas Aromatizadas, Sumos Naturais & Bar Livre',
    category: 'bebida',
    description: 'Estação de hidratação contínua com sumos naturais de laranja e frutos tropicais, águas aromatizadas com hortelã e pepino, refrigerantes e cervejas.',
    unit: 'serviço contínuo',
  },
];

const categoryIcons: Record<string, string> = {
  entrada: '🥗',
  prato_principal: '🥩',
  salgado: '🥟',
  doce: '🍰',
  bebida: '🍹',
  bar: '🥂',
};

const getDishHighlights = (name: string, description: string = '') => {
  const text = (name + ' ' + description).toLowerCase();
  const tags: { label: string; icon: string; bg: string; color: string }[] = [];
  if (text.includes('vegetariano') || text.includes('vegano') || text.includes('cogumelos') || text.includes('abacate') || text.includes('manjericão')) {
    tags.push({ label: 'Vegetariano', icon: '🌿', bg: 'rgba(34,197,94,0.12)', color: '#16a34a' });
  }
  if (text.includes('salmão') || text.includes('robalo') || text.includes('peixe') || text.includes('marisco') || text.includes('camarão')) {
    tags.push({ label: 'Peixe & Mar', icon: '🐟', bg: 'rgba(14,165,233,0.12)', color: '#0284c7' });
  }
  if (text.includes('novilho') || text.includes('carne') || text.includes('lombo') || text.includes('frango') || text.includes('chouriço')) {
    tags.push({ label: 'Carne Selecionada', icon: '🥩', bg: 'rgba(217,119,6,0.12)', color: '#b45309' });
  }
  if (text.includes('gala') || text.includes('red velvet') || text.includes('ouro') || text.includes('assinatura') || text.includes('trufa')) {
    tags.push({ label: 'Seleção do Chef', icon: '⭐', bg: 'rgba(212,175,55,0.16)', color: '#b8860b' });
  }
  if (text.includes('espumante') || text.includes('champagne') || text.includes('reserva') || text.includes('brut') || text.includes('cocktail') || text.includes('vinho')) {
    tags.push({ label: 'Carta de Bar', icon: '🥂', bg: 'rgba(168,85,247,0.12)', color: '#9333ea' });
  }
  if (text.includes('chocolate') || text.includes('gelado') || text.includes('petit gâteau') || text.includes('merengue') || text.includes('tarte') || text.includes('doce')) {
    tags.push({ label: 'Doce Fino', icon: '🍰', bg: 'rgba(244,63,94,0.12)', color: '#e11d48' });
  }
  return tags;
};

const getDishPairing = (category: string, name: string) => {
  const n = name.toLowerCase();
  if (n.includes('salmão') || n.includes('robalo') || n.includes('peixe') || n.includes('camarão')) {
    return 'Harmonização recomendada com Vinho Branco Reserva frutado ou Espumante Brut gelado.';
  }
  if (n.includes('novilho') || n.includes('carne') || n.includes('lombo')) {
    return 'Harmonização com Vinho Tinto Reserva encorpado da garrafeira oficial de gala.';
  }
  if (n.includes('ravioli') || n.includes('trufa') || n.includes('bruschetta')) {
    return 'Harmonização sugerida com Vinho Branco mineral ou água aromatizada com limão e hortelã.';
  }
  if (n.includes('chamuça') || n.includes('salgado') || n.includes('rissol')) {
    return 'Acompanhamento ideal com cerveja artesanal, cocktail fresco ou sumo natural de maracujá.';
  }
  if (n.includes('bolo') || n.includes('chocolate') || n.includes('mousse') || n.includes('tarte')) {
    return 'Harmonização solene com Espumante de Honra ou café expresso gourmet.';
  }
  if (n.includes('cocktail') || n.includes('gin')) {
    return 'Coquetelaria de autor servida com citrinos frescos, especiarias e gelo cristalino.';
  }
  return 'Confeção gastronómica requintada preparada artesanalmente para o banquete oficial.';
};

const getCourseTiming = (catId: string) => {
  switch (catId) {
    case 'entrada':
      return { moment: '1º Momento', time: '15:30', label: 'Welcome Drink & Canapés', icon: '🥗' };
    case 'prato_principal':
      return { moment: '2º Momento', time: '17:30', label: 'Banquete de Gala', icon: '🥩' };
    case 'salgado':
      return { moment: 'Cocktail & Ceia', time: 'Contínuo', label: 'Salgados & Finger Food', icon: '🥟' };
    case 'doce':
      return { moment: '3º Momento', time: '19:30', label: 'Corte do Bolo & Doces', icon: '🍰' };
    case 'bebida':
      return { moment: 'Hidratação', time: 'Contínuo', label: 'Sumos, Águas & Refrescos', icon: '🍹' };
    case 'bar':
      return { moment: 'Bar Aberto', time: '15:30 - Noite', label: 'Vinhos, Espumantes & Cocktails', icon: '🥂' };
    default:
      return { moment: 'Serviço de Gala', time: 'Durante o evento', label: 'Gastronomia', icon: '🍽️' };
  }
};

export default function PublicEventMenu({ items }: { items: MenuItem[] }) {
  const isFallback = items.length === 0;
  const rawList = isFallback ? DEFAULT_GALA_MENU : items;

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<MenuCategory | 'todos'>('todos');
  const [activeGroup, setActiveGroup] = useState<MenuGroup | 'todos'>('todos');
  const [dietaryFilter, setDietaryFilter] = useState<'todos' | 'veg' | 'fish' | 'meat' | 'chef' | 'bar'>('todos');
  const [selectedDishModal, setSelectedDishModal] = useState<MenuItem | null>(null);

  // Filtered List
  const filteredItems = useMemo(() => {
    return rawList.filter(item => {
      const cat = menuCategory(item.category);

      // Group filter
      if (activeGroup !== 'todos' && cat.group !== activeGroup) return false;

      // Category filter
      if (activeCategory !== 'todos' && cat.id !== activeCategory) return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const text = (item.name + ' ' + (item.description || '')).toLowerCase();
        if (!text.includes(q)) return false;
      }

      // Dietary filter
      if (dietaryFilter !== 'todos') {
        const text = (item.name + ' ' + (item.description || '')).toLowerCase();
        if (dietaryFilter === 'veg' && !(text.includes('vegetariano') || text.includes('vegano') || text.includes('cogumelos') || text.includes('abacate') || text.includes('manjericão'))) return false;
        if (dietaryFilter === 'fish' && !(text.includes('salmão') || text.includes('robalo') || text.includes('peixe') || text.includes('marisco') || text.includes('camarão'))) return false;
        if (dietaryFilter === 'meat' && !(text.includes('novilho') || text.includes('carne') || text.includes('lombo') || text.includes('frango') || text.includes('prego'))) return false;
        if (dietaryFilter === 'chef' && !(text.includes('gala') || text.includes('ouro') || text.includes('assinatura') || text.includes('trufa') || text.includes('red velvet'))) return false;
        if (dietaryFilter === 'bar' && !(cat.id === 'bar' || cat.id === 'bebida' || text.includes('espumante') || text.includes('vinho') || text.includes('cocktail'))) return false;
      }

      return true;
    });
  }, [rawList, search, activeCategory, activeGroup, dietaryFilter]);

  // Group sections that have items
  const activeSections = useMemo(() => {
    return menuCategories.map(cat => ({
      ...cat,
      items: filteredItems.filter(item => menuCategory(item.category).id === cat.id),
      totalCount: rawList.filter(item => menuCategory(item.category).id === cat.id).length,
    })).filter(section => section.items.length > 0 || (activeCategory === section.id && filteredItems.length > 0));
  }, [filteredItems, rawList, activeCategory]);

  return (
    <section className="portal-menu-section public-menu-enhanced">
      {/* Visual Header */}
      <div className="capabilities-header" style={{ textAlign: 'center', marginBottom: '24px' }}>
        <span className="overline">ALTA GASTRONOMIA & COCKTAIL BAR</span>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(28px, 4vw, 38px)', margin: '8px 0 10px' }}>
          Cardápio & Serviço de Gala
        </h2>
        <p style={{ maxWidth: '620px', margin: '0 auto', fontSize: '13.5px', color: 'var(--portal-text-secondary)', lineHeight: '1.6' }}>
          Uma experiência sensorial exclusiva desenhada para brindar a esta celebração extraordinária.
        </p>

        {isFallback && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '20px', padding: '4px 14px', marginTop: '14px', fontSize: '11.5px', color: '#b8860b', fontWeight: 600 }}>
            <Sparkles size={13} /> Menu Oficial Previsto para o Evento
          </div>
        )}
      </div>

      {/* Banquet Moments Timeline Strip */}
      <div className="menu-banquet-timeline">
        <div className="banquet-moment-box">
          <span className="banquet-moment-icon">🥗</span>
          <div className="banquet-moment-info">
            <strong>15:30 · Boas-Vindas</strong>
            <small>Canapés & Welcome Drink</small>
          </div>
        </div>
        <div className="banquet-moment-box">
          <span className="banquet-moment-icon">🥩</span>
          <div className="banquet-moment-info">
            <strong>17:30 · Banquete de Gala</strong>
            <small>Pratos Quentes & Carnes</small>
          </div>
        </div>
        <div className="banquet-moment-box">
          <span className="banquet-moment-icon">🍰</span>
          <div className="banquet-moment-info">
            <strong>19:30 · Corte do Bolo</strong>
            <small>Brinde Solene & Doces</small>
          </div>
        </div>
        <div className="banquet-moment-box">
          <span className="banquet-moment-icon">🥂</span>
          <div className="banquet-moment-info">
            <strong>21:00 · Ceia & Bar</strong>
            <small>Salgados Quentes & Bar Aberto</small>
          </div>
        </div>
      </div>

      {/* Interactive Controls Toolbar */}
      <div className="menu-controls-toolbar">
        {/* Search Input */}
        <div className="menu-search-row">
          <div className="menu-search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar iguarias, vinhos, sobremesas ou ingredientes…"
              aria-label="Pesquisar no cardápio"
            />
            {search && (
              <button className="clear-btn" onClick={() => setSearch('')} title="Limpar pesquisa">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Main Category Pills */}
        <div className="menu-category-nav" role="tablist" aria-label="Categorias do cardápio">
          <button
            type="button"
            className={`menu-nav-pill ${activeCategory === 'todos' && activeGroup === 'todos' ? 'active' : ''}`}
            onClick={() => {
              setActiveCategory('todos');
              setActiveGroup('todos');
            }}
          >
            🍽️ Todas as Opções
            <span className="pill-counter">{rawList.length}</span>
          </button>

          {menuCategories.map((cat) => {
            const count = rawList.filter((i) => menuCategory(i.category).id === cat.id).length;
            if (count === 0 && !isFallback) return null;
            const emoji = categoryIcons[cat.id] || '🍽️';

            return (
              <button
                type="button"
                key={cat.id}
                className={`menu-nav-pill ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setActiveGroup('todos');
                }}
              >
                <span>{emoji}</span> {cat.label}
                <span className="pill-counter">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Dietary / Highlight Chips */}
        <div className="menu-dietary-strip">
          <span className="diet-filter-label">PREFERÊNCIAS:</span>
          <button
            type="button"
            className={`diet-filter-btn ${dietaryFilter === 'todos' ? 'active' : ''}`}
            onClick={() => setDietaryFilter('todos')}
          >
            Todas as Opções
          </button>
          <button
            type="button"
            className={`diet-filter-btn ${dietaryFilter === 'veg' ? 'active' : ''}`}
            onClick={() => setDietaryFilter('veg')}
          >
            🌿 Vegetarianas
          </button>
          <button
            type="button"
            className={`diet-filter-btn ${dietaryFilter === 'fish' ? 'active' : ''}`}
            onClick={() => setDietaryFilter('fish')}
          >
            🐟 Peixes & Frutos do Mar
          </button>
          <button
            type="button"
            className={`diet-filter-btn ${dietaryFilter === 'meat' ? 'active' : ''}`}
            onClick={() => setDietaryFilter('meat')}
          >
            🥩 Carnes Selecionadas
          </button>
          <button
            type="button"
            className={`diet-filter-btn ${dietaryFilter === 'chef' ? 'active' : ''}`}
            onClick={() => setDietaryFilter('chef')}
          >
            ⭐ Seleção do Chef
          </button>
          <button
            type="button"
            className={`diet-filter-btn ${dietaryFilter === 'bar' ? 'active' : ''}`}
            onClick={() => setDietaryFilter('bar')}
          >
            🥂 Carta de Bar
          </button>
        </div>
      </div>

      {/* Dishes Sections Display */}
      {filteredItems.length === 0 ? (
        <div className="menu-empty-feedback">
          <span style={{ fontSize: '38px' }}>🍽️</span>
          <h4>Nenhuma opção encontrada com estes filtros</h4>
          <p>Tenta pesquisar por outro termo ou limpa os filtros para visualizar todas as opções do banquete.</p>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setSearch('');
              setActiveCategory('todos');
              setActiveGroup('todos');
              setDietaryFilter('todos');
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            Ver Cardápio Completo
          </button>
        </div>
      ) : (
        <div className="menu-display-area">
          {activeSections.map((section) => {
            const timing = getCourseTiming(section.id);
            const emoji = categoryIcons[section.id] || '🍽️';

            return (
              <div className="course-section-wrapper" key={section.id}>
                <div className="course-section-header">
                  <div className="course-section-title">
                    <h3>{emoji} {section.label}</h3>
                    <span className="course-section-badge">{timing.moment.toUpperCase()}</span>
                  </div>
                  <span className="course-timing-tag">
                    <Clock3 size={14} /> {timing.label} ({timing.time})
                  </span>
                </div>

                <div className="luxury-dishes-grid">
                  {section.items.map((item) => {
                    const highlights = getDishHighlights(item.name, item.description || '');
                    const pairing = getDishPairing(section.id, item.name);

                    return (
                      <div
                        key={item.id}
                        className="luxury-dish-card"
                        onClick={() => setSelectedDishModal(item)}
                        title="Toca para ver a ficha gastronómica e harmonização recomendada"
                      >
                        <div>
                          <div className="dish-card-header">
                            <h4>{item.name}</h4>
                            {item.unit && <span className="dish-unit-badge">{item.unit}</span>}
                          </div>

                          <p className="dish-card-desc">
                            {item.description || 'Confeção gastronómica requintada preparada exclusivamente para o banquete de celebração.'}
                          </p>
                        </div>

                        <div className="dish-card-footer">
                          {highlights.length > 0 && (
                            <div className="dish-tags-row">
                              {highlights.map((h, idx) => (
                                <span key={idx} className="dish-tag-chip" style={{ background: h.bg, color: h.color }}>
                                  <span>{h.icon}</span> {h.label}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="dish-pairing-row">
                            <Sparkles size={13} />
                            <span>{pairing}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dish Detail Popup Modal */}
      {selectedDishModal && (() => {
        const cat = menuCategory(selectedDishModal.category);
        const timing = getCourseTiming(cat.id);
        const pairing = getDishPairing(cat.id, selectedDishModal.name);
        const highlights = getDishHighlights(selectedDishModal.name, selectedDishModal.description || '');

        return (
          <div
            className="dish-modal-overlay"
            onClick={() => setSelectedDishModal(null)}
          >
            <div
              className="dish-modal-box"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="dish-modal-close"
                onClick={() => setSelectedDishModal(null)}
                title="Fechar"
              >
                <X size={18} />
              </button>

              <div className="dish-modal-header">
                <span className="dish-modal-moment">
                  {timing.icon} {timing.moment} · {timing.label} ({timing.time})
                </span>
                <h3 className="dish-modal-title">{selectedDishModal.name}</h3>
                {selectedDishModal.unit && (
                  <span className="dish-unit-badge" style={{ marginTop: '8px', display: 'inline-block' }}>
                    Formato de Serviço: {selectedDishModal.unit}
                  </span>
                )}
              </div>

              <div className="dish-modal-body">
                <p>
                  {selectedDishModal.description ||
                    'Confeção gastronómica requintada preparada artesanalmente pela equipa de catering para este momento especial.'}
                </p>

                <div className="dish-modal-pairing-card">
                  <strong>
                    <Sparkles size={16} /> Harmonização Culinária Sugerida
                  </strong>
                  <p>{pairing}</p>
                </div>

                {highlights.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--portal-text-secondary)', display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>
                      CARACTERÍSTICAS & DESTAQUES:
                    </span>
                    <div className="dish-tags-row">
                      {highlights.map((h, i) => (
                        <span key={i} className="dish-tag-chip" style={{ background: h.bg, color: h.color, padding: '4px 10px', fontSize: '11.5px' }}>
                          <span>{h.icon}</span> {h.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="dish-modal-footer">
                <button type="button" onClick={() => setSelectedDishModal(null)}>
                  Voltar ao Cardápio
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}
