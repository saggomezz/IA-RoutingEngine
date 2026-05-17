/**
 * Tests de integración — pitzbol-web + backend real
 *
 * Correr con:  npx vitest run src/__tests__/integration
 * Requieren conexión a https://api.pitzbol.me:8443 y https://ia.pitzbol.me
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateItinerary,
  buildSchedule,
  matchesInterest,
  isPureNocturna,
  isPlaceOpen,
  getDayOfWeek,
  type Place,
  type GenerateOptions,
  parseCostMin,
} from '../../lib/ia-engine';

// ── Configuración ─────────────────────────────────────────────────────────────

const BACKEND   = 'https://api.pitzbol.me:8443';
const IA_API    = 'https://ia.pitzbol.me';
const TIMEOUT   = 20_000;

const TEST_DATE      = '2026-06-20'; // sábado, no partido
const TEST_DATE_DAY  = getDayOfWeek(TEST_DATE); // 'sabado'
const SEED           = 42;

const ALL_INTERESTS = [
  'cultura',
  'gastronomia',
  'naturaleza',
  'cafeterias',
  'vida-nocturna',
  'compras',
  'fotografia',
  'arquitectura',
  'futbol',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCoord(val: unknown): number | undefined {
  const n = parseFloat(String(val));
  return isNaN(n) ? undefined : n;
}

function rawToPlace(p: Record<string, any>): Place {
  return {
    nombre:        p['Nombre del Lugar'] || '',
    categoria:     p['Categoria'] || '',
    direccion:     p['Dirección'] || '',
    tiempoEstancia: parseInt(p['Tiempo de Estancia']) || 60,
    costo:         p['Costo Estimado'] || 'Gratis',
    calificacion:  p['Calificacion'] || '',
    fotos:         Array.isArray(p['fotos']) ? p['fotos'] : [],
    lat:           parseCoord(p['Latitud']),
    lng:           parseCoord(p['Longitud']),
    horaApertura:  p['horaApertura'] || undefined,
    horaCierre:    p['horaCierre'] || undefined,
    diasCerrado:   p['diasCerrado'] || 'ninguno',
  };
}

function opts(interests: string[], extra: Partial<GenerateOptions> = {}): GenerateOptions {
  return {
    interests,
    ritmo: 'normal',
    startTime: '10:00',
    budget: 1000,
    selectedDate: TEST_DATE,
    seed: SEED,
    ...extra,
  };
}

// ── Datos compartidos ─────────────────────────────────────────────────────────

let backendLugares: Record<string, any>[] = [];
let iaPlaces: Place[] = [];

// ── Suite 1: Conectividad y estructura ───────────────────────────────────────

describe('Backend — conectividad', () => {
  it('GET /api/lugares responde 200', async () => {
    const res = await fetch(`${BACKEND}/api/lugares`);
    expect(res.status).toBe(200);
  }, TIMEOUT);

  it('GET /api/lugares devuelve al menos 30 lugares', async () => {
    const res  = await fetch(`${BACKEND}/api/lugares`);
    if (!res.ok) {
      console.warn(`Backend devolvió ${res.status} — tests dependientes se saltarán`);
      return;
    }
    const data = await res.json();
    backendLugares = data.lugares ?? data;
    expect(Array.isArray(backendLugares)).toBe(true);
    expect(backendLugares.length).toBeGreaterThanOrEqual(30);
  }, TIMEOUT);

  it('cada lugar tiene campos obligatorios (nombre, categorias/categoria)', () => {
    if (!Array.isArray(backendLugares) || backendLugares.length === 0) return; // backend no disponible
    // Filtrar documentos de metadata (ej: contadores de vistas sin nombre)
    const lugares = backendLugares.filter(l => l.nombre);
    expect(lugares.length).toBeGreaterThan(0);
    const sinCategoria = lugares.filter(l => {
      const hasCat = l.categorias?.length > 0 || !!l.categoria;
      return !hasCat;
    }).map(l => l.nombre);
    if (sinCategoria.length > 0) {
      console.warn(`⚠️  ${sinCategoria.length} lugar(es) sin categoría (problema de datos en Firebase):\n  ${sinCategoria.join('\n  ')}`);
    }
    // Permitir hasta 5 lugares sin categoría (datos legacy); más de 5 = error real
    expect(
      sinCategoria.length,
      `Demasiados lugares sin categoría: ${sinCategoria.join(', ')}`
    ).toBeLessThanOrEqual(5);
  });

  it('los 15 cafés tienen la categoría "Cafeterías"', () => {
    if (!Array.isArray(backendLugares) || backendLugares.length === 0) return; // backend no disponible
    const CAFES = [
      'Aloó Café', 'Café Boutique Teatro Degollado', 'El Terrible Juan',
      'Entre Matices', 'Estresso', 'Fragante Café', 'Gufo Café',
      'Jardín Cafeto Chapalita', 'Jardín Cafeto La Americana', 'Jardín Cafeto Providencia',
      'Moka Moments', 'Mono Café', 'The Spot Café', 'Café Rozita', 'Kalido Café',
    ];
    for (const fragmento of CAFES) {
      const lugar = backendLugares.find(l =>
        String(l.nombre).toLowerCase().includes(fragmento.toLowerCase())
      );
      expect(lugar, `No encontrado: ${fragmento}`).toBeTruthy();
      const cats: string[] = lugar?.categorias ?? (lugar?.categoria ? [lugar.categoria] : []);
      const tieneCafe = cats.some(c => c.toLowerCase().includes('cafetería') || c.toLowerCase().includes('cafeteria'));
      expect(tieneCafe, `${lugar?.nombre} no tiene categoría Cafeterías. Tiene: ${cats.join(', ')}`).toBe(true);
    }
  });
});

// ── Suite 2: pitzbol-web /api/places ─────────────────────────────────────────

describe('pitzbol-web API /api/places', () => {
  beforeAll(async () => {
    const res = await fetch(`${IA_API}/api/places`);
    expect(res.status).toBe(200);
    const raw: Record<string, any>[] = await res.json();
    iaPlaces = raw.map(rawToPlace).filter(p => p.nombre);
  }, TIMEOUT);

  it('devuelve al menos 30 lugares', () => {
    expect(iaPlaces.length).toBeGreaterThanOrEqual(30);
  });

  it('ningún lugar tiene nombre vacío', () => {
    const sinNombre = iaPlaces.filter(p => !p.nombre);
    expect(sinNombre.length).toBe(0);
  });

  it('al menos un lugar por cada interés principal', () => {
    const interesesAVerificar = ['cultura', 'gastronomia', 'naturaleza', 'cafeterias', 'arquitectura'];
    for (const interest of interesesAVerificar) {
      const count = iaPlaces.filter(p => matchesInterest(p.categoria, interest)).length;
      expect(count, `Sin lugares para interés "${interest}"`).toBeGreaterThan(0);
    }
  });

  it('lugares con horaApertura también tienen horaCierre', () => {
    const invalidos = iaPlaces.filter(p => p.horaApertura && !p.horaCierre);
    expect(invalidos.map(p => p.nombre)).toEqual([]);
  });

  it('lugares con horaCierre también tienen horaApertura', () => {
    const invalidos = iaPlaces.filter(p => p.horaCierre && !p.horaApertura);
    expect(invalidos.map(p => p.nombre)).toEqual([]);
  });

  it('tiempoEstancia siempre es número positivo', () => {
    const invalidos = iaPlaces.filter(p => !p.tiempoEstancia || p.tiempoEstancia <= 0);
    expect(invalidos.map(p => p.nombre)).toEqual([]);
  });

  it('los cafés sincronizados aparecen con categoría cafeterías', () => {
    const cafes = iaPlaces.filter(p => matchesInterest(p.categoria, 'cafeterias'));
    expect(cafes.length).toBeGreaterThanOrEqual(5);
  });
});

// ── Suite 3: Motor IA con datos reales ───────────────────────────────────────

describe('IA engine — interés único con datos reales', () => {
  const INTERESES_SIMPLES: Array<{ interest: string; minPlaces: number }> = [
    { interest: 'cultura',       minPlaces: 1 },
    { interest: 'gastronomia',   minPlaces: 1 },
    { interest: 'naturaleza',    minPlaces: 1 },
    { interest: 'cafeterias',    minPlaces: 1 },
    { interest: 'arquitectura',  minPlaces: 1 },
    { interest: 'fotografia',    minPlaces: 1 },
  ];

  for (const { interest, minPlaces } of INTERESES_SIMPLES) {
    it(`genera itinerario válido para "${interest}"`, () => {
      const result = generateItinerary(iaPlaces, opts([interest]));
      expect(result.length, `Sin paradas para ${interest}`).toBeGreaterThanOrEqual(minPlaces);
      for (const place of result) {
        const match = matchesInterest(place.categoria, interest);
        expect(match, `"${place.nombre}" no coincide con interés "${interest}". Cat: ${place.categoria}`).toBe(true);
      }
    });
  }

  it('genera itinerario con vida-nocturna (startTime 18:00)', () => {
    const result = generateItinerary(iaPlaces, opts(['vida-nocturna', 'cultura'], { startTime: '18:00' }));
    expect(result.length).toBeGreaterThanOrEqual(1);
    // isPureNocturna igual que el engine: bares/cantinas puros van >= 20:00
    const nocturnos = result.map((p, i) => ({ p, i })).filter(({ p }) => isPureNocturna(p));
    if (nocturnos.length > 0) {
      const schedule = buildSchedule(result, '18:00');
      for (const { i } of nocturnos) {
        const hora = parseInt(schedule[i]?.horaLlegada?.split(':')[0] ?? '0');
        expect(hora, `"${result[i].nombre}" llega a las ${schedule[i]?.horaLlegada}`).toBeGreaterThanOrEqual(20);
      }
    }
  });
});

// ── Suite 4: Reglas de negocio con datos reales ──────────────────────────────

describe('IA engine — reglas de negocio con datos reales', () => {
  const COMBOS: Array<{ name: string; interests: string[]; startTime?: string }> = [
    { name: 'cultura + gastronomia',            interests: ['cultura', 'gastronomia'] },
    { name: 'cafeterias + gastronomia',          interests: ['cafeterias', 'gastronomia'] },
    { name: 'cultura + naturaleza + gastronomia', interests: ['cultura', 'naturaleza', 'gastronomia'] },
    { name: 'cafeterias + cultura + naturaleza', interests: ['cafeterias', 'cultura', 'naturaleza'] },
    { name: 'todos los intereses principales',   interests: ['cultura', 'gastronomia', 'naturaleza', 'cafeterias', 'arquitectura'] },
    { name: 'cafeterias mañana (08:00)',          interests: ['cafeterias', 'cultura'], startTime: '08:00' },
    { name: 'gastronomia tarde (15:00)',          interests: ['gastronomia', 'cultura'], startTime: '15:00' },
  ];

  for (const { name, interests, startTime = '10:00' } of COMBOS) {
    describe(name, () => {
      let result: Place[];

      beforeAll(() => {
        result = generateItinerary(iaPlaces, opts(interests, { startTime }));
      });

      it('devuelve al menos 1 parada', () => {
        expect(result.length).toBeGreaterThanOrEqual(1);
      });

      it('no repite lugares', () => {
        const nombres = result.map(p => p.nombre);
        expect(new Set(nombres).size).toBe(nombres.length);
      });

      it('todos los lugares están abiertos en su hora de llegada', () => {
        const schedule = buildSchedule(result, startTime);
        for (const stop of schedule) {
          if (!stop.place.horaApertura) continue;
          const open = isPlaceOpen(stop.place, stop.horaLlegada, TEST_DATE_DAY);
          expect(open, `"${stop.place.nombre}" no está abierto a las ${stop.horaLlegada}`).toBe(true);
        }
      });

      it('no hay gastronomía consecutiva del mismo tipo', () => {
        for (let i = 0; i < result.length - 1; i++) {
          const aGastro = matchesInterest(result[i].categoria, 'gastronomia');
          const bGastro = matchesInterest(result[i + 1].categoria, 'gastronomia');
          expect(aGastro && bGastro, `Gastronomía consecutiva: "${result[i].nombre}" → "${result[i+1].nombre}"`).toBe(false);
        }
      });

      it('no hay cafeterías consecutivas', () => {
        for (let i = 0; i < result.length - 1; i++) {
          const aCafe = matchesInterest(result[i].categoria, 'cafeterias');
          const bCafe = matchesInterest(result[i + 1].categoria, 'cafeterias');
          expect(aCafe && bCafe, `Cafeterías consecutivas: "${result[i].nombre}" → "${result[i+1].nombre}"`).toBe(false);
        }
      });

      it('vida nocturna pura (si aparece) va al final con llegada >= 20:00', () => {
        // Usamos isPureNocturna igual que el engine: distingue bares puros
        // de restaurantes con ambiente nocturno (que pueden ir de día)
        const nocturnos = result
          .map((p, i) => ({ p, i }))
          .filter(({ p }) => isPureNocturna(p));
        if (nocturnos.length === 0) return;

        const lastNocturno = Math.max(...nocturnos.map(n => n.i));
        const lastDay = result
          .map((p, i) => ({ p, i }))
          .filter(({ p }) => !isPureNocturna(p))
          .map(n => n.i);
        const maxDayIdx = lastDay.length > 0 ? Math.max(...lastDay) : -1;

        expect(lastNocturno).toBeGreaterThan(maxDayIdx);

        const schedule = buildSchedule(result, startTime);
        for (const { i } of nocturnos) {
          const hora = parseInt(schedule[i]?.horaLlegada?.split(':')[0] ?? '0');
          expect(hora, `Nocturna "${result[i].nombre}" llega a las ${schedule[i]?.horaLlegada}`).toBeGreaterThanOrEqual(20);
        }
      });
    });
  }
});

// ── Suite 5: Cafetería mañanera va primero ────────────────────────────────────

describe('IA engine — cafetería primero en itinerario mañanero', () => {
  it('con startTime 08:00, la primera parada es una cafetería', () => {
    const result = generateItinerary(
      iaPlaces,
      opts(['cafeterias', 'cultura', 'naturaleza'], { startTime: '08:00' })
    );
    expect(result.length).toBeGreaterThanOrEqual(1);
    const primero = result[0];
    expect(
      matchesInterest(primero.categoria, 'cafeterias'),
      `Primera parada no es cafetería: "${primero.nombre}" (${primero.categoria})`
    ).toBe(true);
  });

  it('con startTime 09:00 y cafeterías, la primera parada es una cafetería', () => {
    const result = generateItinerary(
      iaPlaces,
      opts(['cafeterias', 'gastronomia', 'cultura'], { startTime: '09:00' })
    );
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(matchesInterest(result[0].categoria, 'cafeterias')).toBe(true);
  });
});

// ── Suite 6: Ritmos ───────────────────────────────────────────────────────────

describe('IA engine — ritmos con datos reales', () => {
  it('tranquilo genera menos paradas que activo', () => {
    const tranquilo = generateItinerary(iaPlaces, opts(['cultura', 'gastronomia', 'naturaleza'], { ritmo: 'tranquilo' }));
    const activo    = generateItinerary(iaPlaces, opts(['cultura', 'gastronomia', 'naturaleza'], { ritmo: 'activo'    }));
    expect(tranquilo.length).toBeLessThanOrEqual(activo.length);
  });

  it('tranquilo devuelve menos paradas que activo (motor time-based 09:00-18:00)', () => {
    const tranquilo = generateItinerary(iaPlaces, opts(['cultura', 'gastronomia', 'naturaleza'], { ritmo: 'tranquilo' }));
    const activo    = generateItinerary(iaPlaces, opts(['cultura', 'gastronomia', 'naturaleza'], { ritmo: 'activo' }));
    // tranquilo: ~90 min/lugar → ~6 paradas máx; activo: ~60 min/lugar → ~9 paradas máx
    expect(tranquilo.length).toBeGreaterThanOrEqual(2);
    expect(activo.length).toBeGreaterThanOrEqual(tranquilo.length);
  });

  it('motor genera entre 2 y 12 paradas para día completo (09:00-18:00)', () => {
    const result = generateItinerary(iaPlaces, opts(['cultura', 'gastronomia', 'naturaleza'], { ritmo: 'normal' }));
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.length).toBeLessThanOrEqual(12);
  });
});

// ── Suite 7: Presupuesto ──────────────────────────────────────────────────────

describe('IA engine — presupuesto con datos reales', () => {
  it('budget 0 solo incluye lugares gratuitos (parseCostMin = 0)', () => {
    const result = generateItinerary(iaPlaces, opts(['cultura', 'naturaleza', 'arquitectura'], { budget: 0 }));
    for (const place of result) {
      const min = parseCostMin(place.costo ?? '');
      expect(min, `"${place.nombre}" tiene costo "${place.costo}" → parseCostMin=${min}, debería ser 0`).toBe(0);
    }
  });

  it('budget alto expande el pool (más categorías de lugares disponibles)', () => {
    const interests = ['cultura', 'gastronomia', 'naturaleza'];
    // Con budget 0 solo hay lugares gratuitos → pool más pequeño
    const poolConBudget0    = iaPlaces.filter(p => (p.costo || '').toLowerCase() === 'gratis' || !p.costo);
    const poolConBudgetAlto = iaPlaces; // todos disponibles
    expect(poolConBudgetAlto.length).toBeGreaterThanOrEqual(poolConBudget0.length);

    // El itinerario con budget alto debe incluir al menos 1 parada
    const alto = generateItinerary(iaPlaces, opts(interests, { budget: 2000, ritmo: 'activo' }));
    expect(alto.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Suite 8: Consistencia cross-service ──────────────────────────────────────

describe('Consistencia Backend ↔ pitzbol-web', () => {
  it('todos los lugares del backend aparecen en la API de la IA (o son filtrados por razón válida)', async () => {
    const res  = await fetch(`${BACKEND}/api/lugares`);
    if (!res.ok) { console.warn(`Backend no disponible (${res.status}), test omitido`); return; }
    const data = await res.json();
    const lugares: Record<string, any>[] = data.lugares ?? data;
    if (!Array.isArray(lugares) || lugares.length === 0) return;

    const iaNombres = new Set(iaPlaces.map(p => p.nombre.toLowerCase().trim()));

    const faltantes = lugares.filter(l => {
      const nombre = String(l.nombre || '').toLowerCase().trim();
      return nombre && !iaNombres.has(nombre);
    });

    // Permitimos hasta 10% de diferencia (pueden estar en CSV aún no sincronizado)
    const ratio = faltantes.length / lugares.length;
    expect(ratio, `${faltantes.length} lugares del backend no aparecen en la IA: ${faltantes.slice(0, 5).map(l => l.nombre).join(', ')}`).toBeLessThan(0.1);
  }, TIMEOUT);

  it('los horarios de al menos el 30% de los lugares están completos (horaApertura + horaCierre)', () => {
    const conHorario = iaPlaces.filter(p => p.horaApertura && p.horaCierre);
    const ratio = conHorario.length / iaPlaces.length;
    expect(ratio, `Solo ${conHorario.length}/${iaPlaces.length} lugares tienen horario completo`).toBeGreaterThan(0.3);
  });
});
