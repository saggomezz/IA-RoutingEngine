/**
 * categories.ts — Fuente única de verdad para la taxonomía de categorías de Pitzbol.
 * Usada por: ia-engine (INTEREST_MAP), página de formulario (emojis/labels).
 *
 * Estructura:
 *   id       → identificador interno (igual al interest ID del formulario)
 *   label    → nombre que ve el usuario
 *   emoji    → ícono en el formulario
 *   keywords → palabras clave que matchean con el campo `categoria` de los lugares
 *   subs     → sub-categorías (etiquetas específicas que puede tener un lugar)
 */

export interface SubCategory {
  id: string;
  label: string;
  keywords: string[];
}

export interface Category {
  id: string;
  label: string;
  emoji: string;
  keywords: string[];   // para matching directo con categoria del lugar
  subs: SubCategory[];
}

export const TAXONOMY: Category[] = [
  {
    id: 'gastronomia',
    label: 'Gastronomía',
    emoji: '🍽️',
    keywords: ['gastronomia', 'mexicana', 'postre', 'vegana', 'comida calle', 'lonche'],
    subs: [
      { id: 'mexicana',     label: 'Mexicana',           keywords: ['mexicana', 'birria', 'torta ahogada', 'tacos', 'pozole'] },
      { id: 'cafeterias',   label: 'Cafeterías',          keywords: ['cafeteria', 'cafe', 'brunch', 'cafe de especialidad'] },
      { id: 'internacional',label: 'Internacional',        keywords: ['gastronomia', 'internacional', 'bistro', 'americana'] },
      { id: 'postres',      label: 'Postres & Dulces',    keywords: ['postre', 'nieves', 'dulces', 'churros', 'helado'] },
      { id: 'vegana',       label: 'Vegana / Saludable',  keywords: ['vegana', 'vegetariana', 'sano', 'plant-based'] },
      { id: 'callejera',    label: 'Comida de calle',     keywords: ['comida calle', 'street food', 'lonche', 'fonda'] },
    ],
  },
  {
    id: 'cafeterias',
    label: 'Cafeterías',
    emoji: '☕',
    keywords: ['cafeteria', 'cafe', 'brunch', 'cafe de especialidad'],
    subs: [
      { id: 'especialidad', label: 'Café de especialidad', keywords: ['cafe de especialidad', 'specialty'] },
      { id: 'brunch',       label: 'Brunch',               keywords: ['brunch'] },
    ],
  },
  {
    id: 'futbol',
    label: 'Fútbol',
    emoji: '⚽',
    keywords: ['futbol', 'fan zone', 'fanzone', 'deportivo', 'zona deportiva', 'estadio'],
    subs: [
      { id: 'estadios',   label: 'Estadios',           keywords: ['estadio', 'futbol'] },
      { id: 'fan_zone',   label: 'Fan Zones / Fest',   keywords: ['fan zone', 'fanzone', 'fan fest'] },
      { id: 'bares_dep',  label: 'Bares deportivos',   keywords: ['sportsbar', 'bar deportivo', 'deportivo'] },
    ],
  },
  {
    id: 'cultura',
    label: 'Cultura',
    emoji: '🏛️',
    keywords: ['cultura', 'museos', 'arte e historia', 'arquitectura', 'patrimonio', 'historico'],
    subs: [
      { id: 'museos',       label: 'Museos',             keywords: ['museos', 'museo'] },
      { id: 'arte',         label: 'Arte e Historia',    keywords: ['arte e historia', 'arte'] },
      { id: 'arquitectura', label: 'Arquitectura',       keywords: ['arquitectura', 'historico', 'patrimonio'] },
      { id: 'fotografia',   label: 'Fotografía',         keywords: ['fotografia', 'mirador', 'vista'] },
      { id: 'musica_vivo',  label: 'Música en vivo',     keywords: ['musica', 'teatro', 'concierto'] },
    ],
  },
  {
    id: 'vida-nocturna',
    label: 'Clubs / Bar',
    emoji: '🍹',
    keywords: ['nocturna', 'bar', 'cantina', 'club', 'mezcal', 'tequila'],
    subs: [
      { id: 'cantinas',    label: 'Cantinas',           keywords: ['cantina'] },
      { id: 'bares',       label: 'Bares',              keywords: ['bar', 'nocturna'] },
      { id: 'clubs',       label: 'Clubs nocturnos',    keywords: ['club', 'discoteca'] },
      { id: 'rooftops',    label: 'Rooftops',           keywords: ['rooftop', 'terraza'] },
      { id: 'mezcalerias', label: 'Mezcalerías',        keywords: ['mezcal', 'tequila', 'destilado'] },
    ],
  },
  {
    id: 'eventos',
    label: 'Eventos',
    emoji: '🎉',
    keywords: ['eventos', 'musica', 'conciertos', 'festival'],
    subs: [
      { id: 'conciertos', label: 'Conciertos',         keywords: ['concierto', 'musica en vivo'] },
      { id: 'teatro',     label: 'Teatro',             keywords: ['teatro'] },
      { id: 'ferias',     label: 'Ferias y Mercados',  keywords: ['feria', 'mercados locales'] },
      { id: 'fifa',       label: 'Eventos FIFA',       keywords: ['fifa', 'mundial', 'fan fest'] },
    ],
  },
  {
    id: 'naturaleza',
    label: 'Naturaleza',
    emoji: '🌿',
    keywords: ['naturaleza', 'parque', 'verde', 'bosque', 'aventura'],
    subs: [
      { id: 'parques',   label: 'Parques',            keywords: ['parque', 'verde'] },
      { id: 'miradores', label: 'Miradores',           keywords: ['mirador', 'vista', 'fotografia'] },
      { id: 'bosques',   label: 'Bosques y jardines', keywords: ['bosque', 'jardin', 'naturaleza'] },
      { id: 'aventura',  label: 'Aventura',            keywords: ['aventura', 'deporte extremo'] },
    ],
  },
  {
    id: 'fotografia',
    label: 'Fotografía',
    emoji: '📷',
    keywords: ['fotografia', 'mirador', 'vista', 'arte e historia'],
    subs: [
      { id: 'miradores', label: 'Miradores',   keywords: ['mirador', 'vista'] },
      { id: 'murales',   label: 'Arte urbano', keywords: ['mural', 'street art', 'arte urbano'] },
    ],
  },
  {
    id: 'compras',
    label: 'Compras',
    emoji: '🛍️',
    keywords: ['compras', 'mercados locales', 'centro comercial', 'artesanias'],
    subs: [
      { id: 'mercados',    label: 'Mercados Locales',    keywords: ['mercado local', 'mercados locales', 'tianguis'] },
      { id: 'centros_com', label: 'Centros Comerciales', keywords: ['centro comercial', 'plaza', 'mall', 'fashion'] },
      { id: 'artesanias',  label: 'Artesanías',          keywords: ['artesanias', 'artesanal', 'tlaquepaque', 'tonala'] },
      { id: 'diseno',      label: 'Diseño y Moda',       keywords: ['diseno', 'ropa', 'boutique', 'moda'] },
    ],
  },
  {
    id: 'arquitectura',
    label: 'Arquitectura',
    emoji: '🏗️',
    keywords: ['arquitectura', 'historico', 'patrimonio', 'arte e historia'],
    subs: [
      { id: 'colonial',  label: 'Colonial',       keywords: ['colonial', 'historico', 'patrimonio'] },
      { id: 'moderno',   label: 'Moderno',        keywords: ['moderno', 'contemporaneo'] },
      { id: 'religioso', label: 'Religioso',      keywords: ['iglesia', 'catedral', 'religion'] },
    ],
  },
  {
    id: 'arte',
    label: 'Arte e Historia',
    emoji: '🎨',
    keywords: ['arte e historia', 'arte', 'museos', 'fotografia'],
    subs: [
      { id: 'museos_arte', label: 'Museos de Arte', keywords: ['museo', 'arte'] },
      { id: 'galerías',    label: 'Galerías',       keywords: ['galeria'] },
      { id: 'murales',     label: 'Murales',        keywords: ['mural', 'muralismo'] },
    ],
  },
  {
    id: 'callejera',
    label: 'Comida de calle',
    emoji: '🌮',
    keywords: ['comida calle', 'comida de calle', 'street food', 'lonche', 'fonda', 'callejera'],
    subs: [],
  },
  {
    id: 'mercados',
    label: 'Mercados Locales',
    emoji: '🏪',
    keywords: ['mercados locales', 'mercado local', 'mercado', 'tianguis', 'parian'],
    subs: [],
  },
];

// ── Helpers derivados de la taxonomía ──────────────────────────────────────────

/** INTEREST_MAP compatible con ia-engine — generado desde la taxonomía */
export const INTEREST_MAP_FROM_TAXONOMY: Record<string, string[]> = Object.fromEntries(
  TAXONOMY.map(cat => [
    cat.id,
    [...new Set([...cat.keywords, ...cat.subs.flatMap(s => s.keywords)])],
  ])
);

/** Todas las etiquetas disponibles para el admin (categoría principal + sub-categorías) */
export const ALL_TAGS: string[] = [
  ...TAXONOMY.map(c => c.label),
  ...TAXONOMY.flatMap(c => c.subs.map(s => s.label)),
].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a.localeCompare(b, 'es'));

/** Sub-categorías de una categoría principal por su id */
export function getSubsFor(categoryId: string): SubCategory[] {
  return TAXONOMY.find(c => c.id === categoryId)?.subs ?? [];
}

/** Devuelve todos los keywords de una categoría + sus subs (para matching) */
export function getAllKeywordsFor(categoryId: string): string[] {
  const cat = TAXONOMY.find(c => c.id === categoryId);
  if (!cat) return [];
  return [...new Set([...cat.keywords, ...cat.subs.flatMap(s => s.keywords)])];
}
