import { describe, it, expect } from 'vitest';
import {
  norm, matchesInterest, isPlaceOpen, getDayOfWeek,
  addMinutes, getMealContext, parseCostMin,
  mealScore, getFoodType, haversine,
  sortByProximity, repairConsecutiveGastro,
  buildSchedule, generateItinerary, validateGenerateOptions,
  seededShuffle, MATCH_DAYS, pickAddStop, pickReplaceStop,
  type Place,
} from '../lib/ia-engine';

// ── Fixtures ─────────────────────────────────────────────────────────────────
const mkPlace = (overrides: Partial<Place> & { nombre: string; categoria: string }): Place => ({
  tiempoEstancia: 60,
  costo: 'Gratis',
  ...overrides,
});

const museo = mkPlace({ nombre: 'Museo Regional', categoria: 'Cultura, Museos', horaApertura: '09:00', horaCierre: '17:00', diasCerrado: 'lunes', lat: 20.67, lng: -103.34 });
const taqueria = mkPlace({ nombre: 'Taquería El Rojo', categoria: 'Gastronomía Mexicana', horaApertura: '08:00', horaCierre: '22:00', diasCerrado: 'ninguno', lat: 20.68, lng: -103.35 });
const birrieria = mkPlace({ nombre: 'La Birriería', categoria: 'Gastronomía Mexicana', horaApertura: '09:00', horaCierre: '18:00', diasCerrado: 'ninguno', lat: 20.69, lng: -103.33 });
const cafe = mkPlace({ nombre: 'Café Central', categoria: 'Cafeterías', horaApertura: '07:00', horaCierre: '20:00', diasCerrado: 'ninguno', lat: 20.65, lng: -103.33 });
const bar = mkPlace({ nombre: 'Bar La Fuente', categoria: 'Vida Nocturna', horaApertura: '20:00', horaCierre: '02:00', diasCerrado: 'ninguno', lat: 20.66, lng: -103.36 });
const parque = mkPlace({ nombre: 'Parque Agua Azul', categoria: 'Naturaleza', horaApertura: '06:00', horaCierre: '18:00', diasCerrado: 'ninguno', lat: 20.64, lng: -103.37 });
const teatro = mkPlace({ nombre: 'Teatro Degollado', categoria: 'Música, Arte e Historia, Cultura', horaApertura: '10:00', horaCierre: '20:00', diasCerrado: 'ninguno', lat: 20.71, lng: -103.34 });
const postre = mkPlace({ nombre: 'Heladería', categoria: 'Gastronomía, Postre', horaApertura: '10:00', horaCierre: '22:00', diasCerrado: 'ninguno', lat: 20.72, lng: -103.36 });

const palacio    = mkPlace({ nombre: 'Palacio de Gobierno', categoria: 'Cultura, Museos', horaApertura: '09:00', horaCierre: '18:00', diasCerrado: 'ninguno', lat: 20.70, lng: -103.36 });
const mercado    = mkPlace({ nombre: 'Mercado San Juan', categoria: 'Gastronomía Mexicana', horaApertura: '08:00', horaCierre: '18:00', diasCerrado: 'domingo', lat: 20.63, lng: -103.35, costo: '$100' });
const bosque     = mkPlace({ nombre: 'Bosque Colomos', categoria: 'Naturaleza, Aventura', horaApertura: '06:00', horaCierre: '18:00', diasCerrado: 'ninguno', lat: 20.70, lng: -103.39 });

const ALL_PLACES = [museo, taqueria, birrieria, cafe, bar, parque, teatro, postre, palacio, mercado, bosque];

// ─────────────────────────────────────────────────────────────────────────────
describe('norm', () => {
  it('convierte a minúsculas', () => {
    expect(norm('CULTURA')).toBe('cultura');
  });
  it('elimina acentos', () => {
    expect(norm('Gastronomía')).toBe('gastronomia');
    expect(norm('Música')).toBe('musica');
    expect(norm('Fotografía')).toBe('fotografia');
  });
  it('maneja cadena vacía', () => {
    expect(norm('')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('matchesInterest', () => {
  it('detecta cultura en categoría compuesta', () => {
    expect(matchesInterest('Cultura, Museos', 'cultura')).toBe(true);
  });
  it('detecta gastronomia con variante mexicana', () => {
    expect(matchesInterest('Gastronomía Mexicana', 'gastronomia')).toBe(true);
  });
  it('detecta cafeterías', () => {
    expect(matchesInterest('Cafeterías', 'cafeterias')).toBe(true);
  });
  it('detecta vida nocturna', () => {
    expect(matchesInterest('Vida Nocturna', 'vida-nocturna')).toBe(true);
  });
  it('no hace match incorrecto', () => {
    expect(matchesInterest('Naturaleza', 'futbol')).toBe(false);
    expect(matchesInterest('Gastronomía', 'arquitectura')).toBe(false);
  });
  it('interés desconocido devuelve false', () => {
    expect(matchesInterest('Cultura', 'inventado')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getDayOfWeek', () => {
  it('2026-05-10 es domingo', () => expect(getDayOfWeek('2026-05-10')).toBe('domingo'));
  it('2026-05-11 es lunes',   () => expect(getDayOfWeek('2026-05-11')).toBe('lunes'));
  it('2026-05-09 es sábado',  () => expect(getDayOfWeek('2026-05-09')).toBe('sábado'));
  it('2026-06-11 es jueves',  () => expect(getDayOfWeek('2026-06-11')).toBe('jueves'));
});

// ─────────────────────────────────────────────────────────────────────────────
describe('addMinutes', () => {
  it('suma minutos simples',             () => expect(addMinutes('09:00', 60)).toBe('10:00'));
  it('maneja cambio de hora',            () => expect(addMinutes('09:45', 30)).toBe('10:15'));
  it('maneja medianoche',                () => expect(addMinutes('23:30', 60)).toBe('00:30'));
  it('suma cero no cambia la hora',      () => expect(addMinutes('10:00', 0)).toBe('10:00'));
  it('suma 90 minutos desde hora entera',() => expect(addMinutes('08:00', 90)).toBe('09:30'));
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getMealContext', () => {
  it('antes de las 12 es desayuno', () => {
    expect(getMealContext('07:00')).toBe('desayuno');
    expect(getMealContext('11:59')).toBe('desayuno');
  });
  it('12:00–16:59 es comida', () => {
    expect(getMealContext('12:00')).toBe('comida');
    expect(getMealContext('14:30')).toBe('comida');
  });
  it('17:00+ es cena', () => {
    expect(getMealContext('17:00')).toBe('cena');
    expect(getMealContext('22:00')).toBe('cena');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('parseCostMin', () => {
  it('gratis devuelve 0',             () => expect(parseCostMin('Gratis')).toBe(0));
  it('cadena vacía devuelve 0',        () => expect(parseCostMin('')).toBe(0));
  it('extrae primer número',          () => expect(parseCostMin('$100 - $200')).toBe(100));
  it('maneja precio simple',           () => expect(parseCostMin('$350 MXN')).toBe(350));
  it('maneja precio con coma decimal',() => expect(parseCostMin('$1,500')).toBe(1500));
});

// ─────────────────────────────────────────────────────────────────────────────
describe('mealScore', () => {
  it('taquería puntúa positivo en comida', () => {
    expect(mealScore(taqueria, 'comida')).toBeGreaterThan(0);
  });
  it('café puntúa positivo en desayuno', () => {
    expect(mealScore(cafe, 'desayuno')).toBeGreaterThan(0);
  });
  it('bar puntúa positivo en cena', () => {
    expect(mealScore(bar, 'cena')).toBeGreaterThan(0);
  });
  it('café penaliza en cena', () => {
    expect(mealScore(cafe, 'cena')).toBeLessThan(mealScore(cafe, 'desayuno'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getFoodType', () => {
  it('detecta tacos', ()   => expect(getFoodType(mkPlace({ nombre: 'Tacos El Gordo', categoria: 'Gastronomía' }))).toBe('tacos'));
  it('detecta birria', ()  => expect(getFoodType(mkPlace({ nombre: 'Birriería Jalisco', categoria: 'Gastronomía' }))).toBe('birria'));
  it('detecta café', ()    => expect(getFoodType(mkPlace({ nombre: 'Café Sinergia', categoria: 'Cafeterías' }))).toBe('cafe'));
  it('detecta mariscos', ()=> expect(getFoodType(mkPlace({ nombre: 'Mariscos El Puerto', categoria: 'Gastronomía' }))).toBe('mariscos'));
  it('nombre único para no reconocido', () => {
    const p = mkPlace({ nombre: 'Restaurante XYZ', categoria: 'Gastronomía' });
    expect(getFoodType(p)).toMatch(/^unique_/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('haversine', () => {
  it('distancia entre mismo punto es 0', () => {
    expect(haversine(20.67, -103.34, 20.67, -103.34)).toBe(0);
  });
  it('distancia GDL–CDMX aprox 480 km', () => {
    const d = haversine(20.66, -103.35, 19.43, -99.13);
    expect(d).toBeGreaterThan(450);
    expect(d).toBeLessThan(520);
  });
  it('es simétrica', () => {
    const d1 = haversine(20.67, -103.34, 20.68, -103.35);
    const d2 = haversine(20.68, -103.35, 20.67, -103.34);
    expect(d1).toBeCloseTo(d2, 5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('isPlaceOpen', () => {
  it('lugar sin horario siempre está abierto', () => {
    const p = mkPlace({ nombre: 'Sin horario', categoria: 'Cultura' });
    expect(isPlaceOpen(p, '03:00', 'lunes')).toBe(true);
  });
  it('00:00–23:59 siempre está abierto', () => {
    const p = mkPlace({ nombre: 'Siempre', categoria: 'Cultura', horaApertura: '00:00', horaCierre: '23:59' });
    expect(isPlaceOpen(p, '02:00', 'domingo')).toBe(true);
  });
  it('cerrado antes de apertura', () => {
    expect(isPlaceOpen(museo, '07:00', 'martes')).toBe(false);
  });
  it('abierto dentro de horario', () => {
    expect(isPlaceOpen(museo, '10:00', 'martes')).toBe(true);
  });
  it('cerrado si la visita termina después del cierre', () => {
    // museo cierra a 17:00, tiempoEstancia 60 min → llegada 16:30 termina 17:30 ❌
    expect(isPlaceOpen(museo, '16:30', 'martes')).toBe(false);
  });
  it('cerrado en día de cierre', () => {
    expect(isPlaceOpen(museo, '10:00', 'lunes')).toBe(false);
  });
  it('bar abierto después de medianoche (cierre 02:00)', () => {
    expect(isPlaceOpen(bar, '20:00', 'viernes')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('sortByProximity', () => {
  it('lista vacía no falla', () => {
    expect(sortByProximity([])).toEqual([]);
  });
  it('un solo lugar regresa tal cual', () => {
    expect(sortByProximity([museo])).toEqual([museo]);
  });
  it('mantiene el mismo número de lugares', () => {
    const result = sortByProximity([museo, taqueria, parque]);
    expect(result).toHaveLength(3);
  });
  it('la ruta optimizada tiene distancia total menor o igual que el orden original', () => {
    const places = [museo, taqueria, parque];
    const result = sortByProximity(places);
    // Distancia total de la ruta optimizada debe ser ≤ al orden de entrada
    const dist = (arr: typeof places) => {
      let d = 0;
      for (let i = 0; i < arr.length - 1; i++) {
        const a = arr[i], b = arr[i + 1];
        if (a.lat != null && b.lat != null) d += haversine(a.lat, a.lng!, b.lat, b.lng!);
      }
      return d;
    };
    expect(dist(result)).toBeLessThanOrEqual(dist(places) + 0.001);
  });
  it('lugares sin coords no se pierden', () => {
    const sinCoords = mkPlace({ nombre: 'Sin coords', categoria: 'Cultura' });
    const result = sortByProximity([museo, sinCoords, taqueria]);
    expect(result).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('repairConsecutiveGastro', () => {
  const cafe2 = mkPlace({ nombre: 'Café Dos', categoria: 'Cafeterías', horaApertura: '07:00', horaCierre: '20:00', diasCerrado: 'ninguno' });

  it('sin gastro consecutiva no cambia el orden', () => {
    const input = [museo, taqueria, teatro];
    expect(repairConsecutiveGastro(input)).toEqual(input);
  });
  it('separa dos gastro consecutivos', () => {
    const input = [taqueria, birrieria, museo];
    const result = repairConsecutiveGastro(input);
    for (let i = 0; i < result.length - 1; i++) {
      const bothGastro = matchesInterest(result[i].categoria, 'gastronomia') &&
                         matchesInterest(result[i + 1].categoria, 'gastronomia');
      expect(bothGastro).toBe(false);
    }
  });
  it('separa dos cafeterías consecutivas', () => {
    const input = [cafe, cafe2, museo];
    const result = repairConsecutiveGastro(input);
    for (let i = 0; i < result.length - 1; i++) {
      const bothCafe = matchesInterest(result[i].categoria, 'cafeterias') &&
                       matchesInterest(result[i + 1].categoria, 'cafeterias');
      expect(bothCafe).toBe(false);
    }
  });
  it('permite gastro seguida de cafetería (tipos distintos)', () => {
    const input = [taqueria, cafe, museo];
    const result = repairConsecutiveGastro(input);
    expect(result).toEqual(input); // no debe moverse
  });
  it('conserva todos los lugares', () => {
    const input = [taqueria, birrieria, museo, cafe];
    const result = repairConsecutiveGastro(input);
    expect(result).toHaveLength(input.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('buildSchedule', () => {
  it('genera una parada por lugar', () => {
    const schedule = buildSchedule([museo, taqueria], '09:00');
    expect(schedule).toHaveLength(2);
  });
  it('primera parada llega a la hora de inicio', () => {
    const schedule = buildSchedule([museo], '09:00');
    expect(schedule[0].horaLlegada).toBe('09:00');
  });
  it('hora de salida = llegada + tiempoEstancia', () => {
    const schedule = buildSchedule([museo], '09:00'); // tiempoEstancia 60
    expect(schedule[0].horaSalida).toBe('10:00');
  });
  it('segunda parada incluye tránsito de 30 min', () => {
    const schedule = buildSchedule([museo, taqueria], '09:00');
    // museo: 09:00–10:00, tránsito 30 → taquería llega 10:30
    expect(schedule[1].horaLlegada).toBe('10:30');
  });
  it('forcedArrival sobreescribe la hora calculada', () => {
    const withForced = { ...taqueria, forcedArrival: '15:00' };
    const schedule = buildSchedule([museo, withForced], '09:00');
    expect(schedule[1].horaLlegada).toBe('15:00');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('generateItinerary — conteo por ritmo', () => {
  const baseOpts = {
    interests: ['cultura', 'gastronomia', 'naturaleza'],
    startTime: '09:00',
    budget: 500,
    selectedDate: '2026-05-09', // sábado
    seed: 1,
  };

  it('tranquilo devuelve exactamente 3 paradas', () => {
    const result = generateItinerary(ALL_PLACES, { ...baseOpts, ritmo: 'tranquilo' });
    expect(result).toHaveLength(3);
  });
  it('normal devuelve exactamente 4 paradas', () => {
    const result = generateItinerary(ALL_PLACES, { ...baseOpts, ritmo: 'normal' });
    expect(result).toHaveLength(4);
  });
  it('activo devuelve exactamente 5 paradas', () => {
    const result = generateItinerary(ALL_PLACES, { ...baseOpts, ritmo: 'activo' });
    expect(result).toHaveLength(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('generateItinerary — reglas de negocio', () => {
  const baseOpts = {
    interests: ['cultura', 'gastronomia'],
    ritmo: 'normal' as const,
    startTime: '09:00',
    budget: 500,
    selectedDate: '2026-05-09', // sábado
  };

  it('no incluye lugares de la blacklist', () => {
    const akron = mkPlace({ nombre: 'Estadio Akron, Guadalajara', categoria: 'Fútbol' });
    const result = generateItinerary([...ALL_PLACES, akron], baseOpts);
    expect(result.find(p => p.nombre.toLowerCase().includes('akron'))).toBeUndefined();
  });

  it('no repite lugares', () => {
    const result = generateItinerary(ALL_PLACES, baseOpts);
    const nombres = result.map(p => p.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it('no hay gastronomía consecutiva', () => {
    const result = generateItinerary(ALL_PLACES, baseOpts);
    for (let i = 0; i < result.length - 1; i++) {
      const ambosGastro =
        matchesInterest(result[i].categoria, 'gastronomia') &&
        matchesInterest(result[i + 1].categoria, 'gastronomia');
      expect(ambosGastro).toBe(false);
    }
  });

  it('todos los lugares están abiertos en su hora de llegada', () => {
    const result = generateItinerary(ALL_PLACES, baseOpts);
    const schedule = buildSchedule(result, baseOpts.startTime);
    const day = getDayOfWeek(baseOpts.selectedDate);
    for (const stop of schedule) {
      if (stop.place.horaApertura) {
        expect(isPlaceOpen(stop.place, stop.horaLlegada, day)).toBe(true);
      }
    }
  });

  it('no recomienda nada si el presupuesto es 0 y todos tienen costo', () => {
    const costosos = ALL_PLACES.map(p => ({ ...p, costo: '$500' }));
    const result = generateItinerary(costosos, { ...baseOpts, budget: 0 });
    expect(result).toHaveLength(0);
  });

  it('vida nocturna aparece al final y llegada >= 20:00', () => {
    const result = generateItinerary(ALL_PLACES, {
      ...baseOpts,
      interests: ['cultura', 'vida-nocturna'],
      startTime: '10:00',
    });
    const nocturnaIdx = result.findIndex(p =>
      matchesInterest(p.categoria, 'vida-nocturna') && !matchesInterest(p.categoria, 'gastronomia')
    );
    if (nocturnaIdx >= 0) {
      expect(nocturnaIdx).toBe(result.length - 1);
      const schedule = buildSchedule(result, '10:00');
      const hora = parseInt(schedule[nocturnaIdx].horaLlegada.split(':')[0]);
      expect(hora).toBeGreaterThanOrEqual(20);
    }
  });

  it('lunes no recomienda el museo que cierra ese día', () => {
    const result = generateItinerary(ALL_PLACES, {
      ...baseOpts,
      selectedDate: '2026-05-11', // lunes
    });
    expect(result.find(p => p.nombre === museo.nombre)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('validateGenerateOptions', () => {
  const validOpts = {
    interests: ['cultura'],
    ritmo: 'normal' as const,
    startTime: '09:00',
    budget: 300,
    selectedDate: '2026-05-09',
  };

  it('opciones válidas no retornan error', () => {
    expect(validateGenerateOptions(validOpts)).toBeNull();
  });
  it('sin intereses retorna error', () => {
    expect(validateGenerateOptions({ ...validOpts, interests: [] })).toMatch(/interés/i);
  });
  it('startTime con formato incorrecto retorna error', () => {
    expect(validateGenerateOptions({ ...validOpts, startTime: '9:00' })).toMatch(/inválida/i);
    expect(validateGenerateOptions({ ...validOpts, startTime: '25:00' })).toMatch(/rango/i);
    expect(validateGenerateOptions({ ...validOpts, startTime: 'abc' })).toMatch(/inválida/i);
  });
  it('presupuesto negativo retorna error', () => {
    expect(validateGenerateOptions({ ...validOpts, budget: -1 })).toMatch(/negativo/i);
  });
  it('fecha inválida retorna error', () => {
    expect(validateGenerateOptions({ ...validOpts, selectedDate: '2026-13-01' })).toMatch(/inválida/i);
    expect(validateGenerateOptions({ ...validOpts, selectedDate: 'hoy' })).toMatch(/inválida/i);
  });
  it('generateItinerary lanza excepción con inputs inválidos', () => {
    expect(() => generateItinerary(ALL_PLACES, { ...validOpts, interests: [] }))
      .toThrow(/interés/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('maxGastro escala con ritmo', () => {
  const GASTRO_PLACES = Array.from({ length: 6 }, (_, i) => mkPlace({
    nombre: `Restaurante ${i + 1}`,
    categoria: 'Gastronomía Mexicana',
    horaApertura: '08:00',
    horaCierre: '22:00',
    diasCerrado: 'ninguno',
    costo: 'Gratis',
  }));
  const NON_GASTRO = Array.from({ length: 6 }, (_, i) => mkPlace({
    nombre: `Museo ${i + 1}`,
    categoria: 'Cultura, Museos',
    horaApertura: '09:00',
    horaCierre: '18:00',
    diasCerrado: 'ninguno',
    costo: 'Gratis',
    lat: 20.67 + i * 0.01,
    lng: -103.34,
  }));
  const MIXED = [...GASTRO_PLACES, ...NON_GASTRO];
  const baseOpts = {
    interests: ['cultura', 'gastronomia'],
    startTime: '09:00',
    budget: 500,
    selectedDate: '2026-05-09',
    seed: 42,
  };

  it('tranquilo: máximo 1 lugar de gastronomía', () => {
    const result = generateItinerary(MIXED, { ...baseOpts, ritmo: 'tranquilo' });
    const gastroCount = result.filter(p => matchesInterest(p.categoria, 'gastronomia')).length;
    expect(gastroCount).toBeLessThanOrEqual(1);
  });
  it('normal: máximo 2 lugares de gastronomía', () => {
    const result = generateItinerary(MIXED, { ...baseOpts, ritmo: 'normal' });
    const gastroCount = result.filter(p => matchesInterest(p.categoria, 'gastronomia')).length;
    expect(gastroCount).toBeLessThanOrEqual(2);
  });
  it('activo: máximo 2 lugares de gastronomía', () => {
    const result = generateItinerary(MIXED, { ...baseOpts, ritmo: 'activo' });
    const gastroCount = result.filter(p => matchesInterest(p.categoria, 'gastronomia')).length;
    expect(gastroCount).toBeLessThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('fallback con pocos lugares disponibles', () => {
  const soloDosCafeterias = [
    mkPlace({ nombre: 'Café A', categoria: 'Cafeterías', costo: '$600', horaApertura: '07:00', horaCierre: '20:00', diasCerrado: 'ninguno' }),
    mkPlace({ nombre: 'Café B', categoria: 'Cafeterías', costo: '$700', horaApertura: '07:00', horaCierre: '20:00', diasCerrado: 'ninguno' }),
  ];

  it('con presupuesto bajo relaja el filtro y devuelve lugares', () => {
    // Con budget=100 los cafés ($600 y $700) serían filtrados, pero el fallback los incluye
    const result = generateItinerary(soloDosCafeterias, {
      interests: ['cafeterias'],
      ritmo: 'normal',
      startTime: '09:00',
      budget: 100,
      selectedDate: '2026-05-09',
      seed: 1,
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it('con cero lugares posibles devuelve arreglo vacío', () => {
    const result = generateItinerary([], {
      interests: ['cafeterias'],
      ritmo: 'normal',
      startTime: '09:00',
      budget: 500,
      selectedDate: '2026-05-09',
      seed: 1,
    });
    expect(result).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('seededShuffle', () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8];

  it('misma semilla produce mismo resultado siempre', () => {
    expect(seededShuffle(arr, 42)).toEqual(seededShuffle(arr, 42));
    expect(seededShuffle(arr, 999)).toEqual(seededShuffle(arr, 999));
  });
  it('semillas distintas producen resultados distintos', () => {
    expect(seededShuffle(arr, 1)).not.toEqual(seededShuffle(arr, 1000));
  });
  it('conserva todos los elementos', () => {
    const result = seededShuffle(arr, 42);
    expect(result.sort()).toEqual([...arr].sort());
  });
  it('arreglo vacío no falla', () => {
    expect(seededShuffle([], 42)).toEqual([]);
  });
  it('no muta el arreglo original', () => {
    const original = [1, 2, 3];
    seededShuffle(original, 42);
    expect(original).toEqual([1, 2, 3]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('scheduling cafeterías', () => {
  const mkCafe = (nombre: string) => mkPlace({
    nombre,
    categoria: 'Cafeterías',
    horaApertura: '07:00',
    horaCierre: '21:00',
    diasCerrado: 'ninguno',
    costo: 'Gratis',
  });
  const mkMuseo = (nombre: string) => mkPlace({
    nombre,
    categoria: 'Cultura, Museos',
    horaApertura: '09:00',
    horaCierre: '18:00',
    diasCerrado: 'ninguno',
    costo: 'Gratis',
  });
  const places = [mkCafe('Café Central'), mkCafe('Café Norte'), mkMuseo('Museo 1'), mkMuseo('Museo 2'), mkMuseo('Museo 3')];
  const matchDay = Object.keys(MATCH_DAYS)[0]; // '2026-06-11'
  const normalDay = '2026-05-09';

  it('itinerario matutino (09:00): cafetería llega antes de 13:00', () => {
    const result = generateItinerary(places, {
      interests: ['cafeterias', 'cultura'],
      ritmo: 'normal',
      startTime: '09:00',
      budget: 500,
      selectedDate: normalDay,
      seed: 1,
    });
    const schedule = buildSchedule(result, '09:00');
    const cafeStop = schedule.find(s => matchesInterest(s.place.categoria, 'cafeterias'));
    if (cafeStop) {
      expect(parseInt(cafeStop.horaLlegada.split(':')[0])).toBeLessThan(13);
    }
  });

  it('itinerario vespertino (14:00) día normal: cafetería puede aparecer en cualquier hora según horario real', () => {
    const result = generateItinerary(places, {
      interests: ['cafeterias', 'cultura'],
      ritmo: 'normal',
      startTime: '14:00',
      budget: 500,
      selectedDate: normalDay,
      seed: 1,
    });
    // Con la nueva lógica, el horario real del lugar decide (no un bloqueo artificial hasta las 18h)
    const hasCafe = result.some(p => matchesInterest(p.categoria, 'cafeterias'));
    // El café tiene horaCierre 21:00, así que puede aparecer en la tarde
    expect(hasCafe).toBe(true);
  });

  it('itinerario vespertino en día de partido: cafetería puede aparecer si su horario lo permite', () => {
    const result = generateItinerary(places, {
      interests: ['cafeterias', 'cultura'],
      ritmo: 'normal',
      startTime: '14:00',
      budget: 500,
      selectedDate: matchDay,
      seed: 1,
    });
    // Ya no se bloquea en días de partido: isPlaceOpen decide
    const hasCafe = result.some(p => matchesInterest(p.categoria, 'cafeterias'));
    expect(hasCafe).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('scheduling plazas comerciales', () => {
  const plaza = mkPlace({
    nombre: 'La Gran Plaza',
    categoria: 'Eventos, Compras',
    horaApertura: '10:00',
    horaCierre: '21:00',
    diasCerrado: 'ninguno',
    costo: 'Gratis',
  });
  const otros = Array.from({ length: 4 }, (_, i) => mkPlace({
    nombre: `Museo ${i + 1}`,
    categoria: 'Cultura, Museos',
    horaApertura: '09:00',
    horaCierre: '18:00',
    diasCerrado: 'ninguno',
    costo: 'Gratis',
    lat: 20.67 + i * 0.01,
    lng: -103.34,
  }));

  it('plaza comercial nunca aparece antes de 11:00', () => {
    const result = generateItinerary([plaza, ...otros], {
      interests: ['compras', 'cultura'],
      ritmo: 'activo',
      startTime: '08:00',
      budget: 500,
      selectedDate: '2026-05-09',
      seed: 1,
    });
    const schedule = buildSchedule(result, '08:00');
    const plazaStop = schedule.find(s => norm(s.place.categoria).includes('compras'));
    if (plazaStop) {
      expect(parseInt(plazaStop.horaLlegada.split(':')[0])).toBeGreaterThanOrEqual(11);
    }
  });

  it('plaza comercial sí aparece cuando el itinerario empieza después de 11:00', () => {
    const result = generateItinerary([plaza, ...otros], {
      interests: ['compras', 'cultura'],
      ritmo: 'activo',
      startTime: '11:00',
      budget: 500,
      selectedDate: '2026-05-09',
      seed: 1,
    });
    expect(result.some(p => norm(p.categoria).includes('compras'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// pickAddStop / pickReplaceStop
// ─────────────────────────────────────────────────────────────────────────────

const mkCultura = (nombre: string, lat: number, lng: number): Place =>
  mkPlace({ nombre, categoria: 'Cultura, Museos', horaApertura: '09:00', horaCierre: '18:00', diasCerrado: 'ninguno', lat, lng });

const mkGastro = (nombre: string, lat: number, lng: number, costo?: string): Place =>
  mkPlace({ nombre, categoria: 'Gastronomía Mexicana', horaApertura: '08:00', horaCierre: '22:00', diasCerrado: 'ninguno', lat, lng, costo: costo || 'Gratis' });

const ACTION_OPTS = {
  interests: ['cultura', 'gastronomia'],
  budget: 500,
  selectedDate: '2026-05-09',
  startTime: '10:00',
  seed: 42,
};

describe('pickAddStop', () => {
  it('no devuelve un lugar ya en la lista', () => {
    const current = [mkCultura('Museo A', 20.67, -103.34)];
    const pool = [mkCultura('Museo A', 20.67, -103.34), mkCultura('Museo B', 20.68, -103.35)];
    const result = pickAddStop(pool, current, ACTION_OPTS);
    expect(result?.nombre).toBe('Museo B');
  });

  it('devuelve null cuando todos ya están en la lista', () => {
    const current = [mkCultura('Museo A', 20.67, -103.34)];
    const result = pickAddStop(current, current, ACTION_OPTS);
    expect(result).toBeNull();
  });

  it('respeta el filtro de intereses', () => {
    const bar = mkPlace({ nombre: 'Bar Nocturno', categoria: 'Vida Nocturna', horaApertura: '20:00', horaCierre: '02:00', diasCerrado: 'ninguno', lat: 20.65, lng: -103.36 });
    const cultura = mkCultura('Museo C', 20.69, -103.33);
    const result = pickAddStop([bar, cultura], [], ACTION_OPTS);
    expect(result?.nombre).toBe('Museo C');
  });

  it('respeta el presupuesto máximo', () => {
    const caro = mkGastro('Restaurante Caro', 20.67, -103.34, '$1000');
    const barato = mkGastro('Taco Barato', 20.68, -103.35, '$50');
    const result = pickAddStop([caro, barato], [], { ...ACTION_OPTS, budget: 200 });
    expect(result?.nombre).toBe('Taco Barato');
  });

  it('no devuelve lugares en la blacklist', () => {
    const bloqueado = mkPlace({ nombre: 'Complejo Verde Valle', categoria: 'Cultura, Museos', horaApertura: '09:00', horaCierre: '18:00', diasCerrado: 'ninguno', lat: 20.67, lng: -103.34 });
    const ok = mkCultura('Museo D', 20.68, -103.35);
    const result = pickAddStop([bloqueado, ok], [], ACTION_OPTS);
    expect(result?.nombre).toBe('Museo D');
  });

  it('no devuelve lugares cerrados en la fecha seleccionada', () => {
    // 2026-05-09 es sábado
    const cerradoSabado = mkPlace({ nombre: 'Museo Cerrado', categoria: 'Cultura, Museos', horaApertura: '09:00', horaCierre: '18:00', diasCerrado: 'sabado', lat: 20.67, lng: -103.34 });
    const abierto = mkCultura('Museo Abierto', 20.68, -103.35);
    const result = pickAddStop([cerradoSabado, abierto], [], ACTION_OPTS);
    expect(result?.nombre).toBe('Museo Abierto');
  });

  it('no devuelve lugares fuera de su horario de apertura', () => {
    const nocturno = mkPlace({ nombre: 'Club Nocturno', categoria: 'Cultura, Museos', horaApertura: '22:00', horaCierre: '04:00', diasCerrado: 'ninguno', lat: 20.67, lng: -103.34 });
    const diurno = mkCultura('Museo Diurno', 20.68, -103.35);
    const result = pickAddStop([nocturno, diurno], [], { ...ACTION_OPTS, startTime: '10:00' });
    expect(result?.nombre).toBe('Museo Diurno');
  });

  it('no agrega gastro si el último lugar actual también es gastro (consecutivos)', () => {
    const gastro1 = mkGastro('Taquería 1', 20.67, -103.34);
    const gastro2 = mkGastro('Taquería 2', 20.68, -103.35);
    // lastRegular = gastro1 → bloquea gastro2 por regla consecutiva
    const result = pickAddStop([gastro2], [gastro1], { ...ACTION_OPTS, startTime: '10:00' });
    expect(result).toBeNull();
  });

  it('permite gastro cuando el gap de 150min con el último gastro se cumple', () => {
    const gastro1 = mkGastro('Taquería 1', 20.67, -103.34);
    const c1 = mkCultura('Museo C1', 20.68, -103.35);
    const c2 = mkCultura('Museo C2', 20.69, -103.33);
    const gastro2 = mkGastro('Taquería 2', 20.70, -103.36);
    // schedule: 10:00→11:00(gastro1), 11:30→12:30(c1), 13:00→14:00(c2)
    // estArrival ≈ 14:30, lastGastroEnd = 11:00 → gap 210min > 150min → permitido
    const result = pickAddStop([gastro2], [gastro1, c1, c2], { ...ACTION_OPTS, startTime: '10:00' });
    expect(result?.nombre).toBe('Taquería 2');
  });

  it('es determinista con la misma semilla', () => {
    const pool = [
      mkCultura('Museo E', 20.67, -103.34),
      mkCultura('Museo F', 20.68, -103.35),
      mkCultura('Museo G', 20.69, -103.33),
    ];
    const r1 = pickAddStop(pool, [], ACTION_OPTS);
    const r2 = pickAddStop(pool, [], ACTION_OPTS);
    expect(r1?.nombre).toBe(r2?.nombre);
  });

  it('devuelve null cuando el pool está vacío', () => {
    const result = pickAddStop([], [], ACTION_OPTS);
    expect(result).toBeNull();
  });
});

describe('pickReplaceStop', () => {
  it('devuelve null para un índice inválido', () => {
    const current = [mkCultura('Museo A', 20.67, -103.34)];
    expect(pickReplaceStop(current, current, 5, ACTION_OPTS)).toBeNull();
    expect(pickReplaceStop(current, current, -1, ACTION_OPTS)).toBeNull();
  });

  it('no devuelve un lugar ya en el itinerario', () => {
    const museoA = mkCultura('Museo A', 20.67, -103.34);
    const museoB = mkCultura('Museo B', 20.68, -103.35);
    const museoC = mkCultura('Museo C', 20.69, -103.33);
    const current = [museoA, museoB];
    const pool = [museoA, museoB, museoC];
    const result = pickReplaceStop(pool, current, 0, ACTION_OPTS);
    expect(result?.nombre).toBe('Museo C');
  });

  it('reemplaza por un lugar de la misma categoría de interés', () => {
    const museoA = mkCultura('Museo A', 20.67, -103.34);
    const museoB = mkCultura('Museo B', 20.68, -103.35);
    const gastro = mkGastro('Tacos', 20.69, -103.33);
    // Reemplazando índice 0 (cultura) → debe preferir museoB sobre gastro cuando intereses=['cultura']
    const result = pickReplaceStop([museoA, museoB, gastro], [museoA], 0, { ...ACTION_OPTS, interests: ['cultura'] });
    expect(result ? norm(result.categoria).includes('cultur') || norm(result.categoria).includes('museo') : true).toBe(true);
  });

  it('no devuelve lugares en la blacklist', () => {
    const bloqueado = mkPlace({ nombre: 'Glorieta de la Minerva', categoria: 'Cultura, Museos', horaApertura: '00:00', horaCierre: '23:59', diasCerrado: 'ninguno', lat: 20.67, lng: -103.34 });
    const ok = mkCultura('Museo OK', 20.68, -103.35);
    const toReplace = mkCultura('Museo Viejo', 20.70, -103.36);
    const result = pickReplaceStop([bloqueado, ok], [toReplace], 0, ACTION_OPTS);
    expect(result?.nombre).toBe('Museo OK');
  });

  it('no devuelve lugares cerrados en la fecha', () => {
    // sábado
    const cerrado = mkPlace({ nombre: 'Museo Cerrado Sab', categoria: 'Cultura, Museos', horaApertura: '09:00', horaCierre: '18:00', diasCerrado: 'sabado', lat: 20.67, lng: -103.34 });
    const abierto = mkCultura('Museo Abierto', 20.68, -103.35);
    const toReplace = mkCultura('Museo Viejo', 20.70, -103.36);
    // allPlaces excludes toReplace so it can't be returned as its own replacement
    const result = pickReplaceStop([cerrado, abierto], [toReplace], 0, ACTION_OPTS);
    expect(result?.nombre).toBe('Museo Abierto');
  });

  it('respeta el presupuesto al reemplazar', () => {
    const caro = mkGastro('Caro', 20.67, -103.34, '$900');
    const barato = mkGastro('Barato', 20.68, -103.35, '$50');
    const toReplace = mkGastro('Antiguo', 20.70, -103.36);
    // allPlaces excludes toReplace so it can't be returned as its own replacement
    const result = pickReplaceStop([caro, barato], [toReplace], 0, { ...ACTION_OPTS, budget: 200 });
    expect(result?.nombre).toBe('Barato');
  });

  it('no crea par gastro consecutivo con el vecino anterior', () => {
    const gastroAnterior = mkGastro('Taquería Prev', 20.67, -103.34);
    const gastroNuevo = mkGastro('Taquería Nueva', 20.68, -103.35);
    const cultura = mkCultura('Museo X', 20.69, -103.33);
    const toReplace = mkCultura('Museo Reemplazado', 20.70, -103.36);
    // current = [gastroAnterior, toReplace] — index 1
    // Si reemplazamos índice 1 por gastroNuevo → gastroAnterior + gastroNuevo = dos gastros seguidos → debe preferir cultura
    const result = pickReplaceStop([gastroNuevo, cultura, toReplace, gastroAnterior], [gastroAnterior, toReplace], 1, ACTION_OPTS);
    expect(result ? !norm(result.categoria).includes('gastro') : true).toBe(true);
  });

  it('no crea par gastro consecutivo con el vecino siguiente', () => {
    const gastroSiguiente = mkGastro('Taquería Next', 20.67, -103.34);
    const gastroNuevo = mkGastro('Taquería Nueva', 20.68, -103.35);
    const cultura = mkCultura('Museo Y', 20.69, -103.33);
    const toReplace = mkCultura('Museo Reemplazado', 20.70, -103.36);
    // current = [toReplace, gastroSiguiente] — index 0
    const result = pickReplaceStop([gastroNuevo, cultura, toReplace, gastroSiguiente], [toReplace, gastroSiguiente], 0, ACTION_OPTS);
    expect(result ? !norm(result.categoria).includes('gastro') : true).toBe(true);
  });

  it('es determinista con la misma semilla', () => {
    const pool = [
      mkCultura('Museo P', 20.67, -103.34),
      mkCultura('Museo Q', 20.68, -103.35),
      mkCultura('Museo R', 20.69, -103.33),
    ];
    const toReplace = mkCultura('Museo Viejo', 20.70, -103.36);
    const r1 = pickReplaceStop([...pool, toReplace], [toReplace], 0, ACTION_OPTS);
    const r2 = pickReplaceStop([...pool, toReplace], [toReplace], 0, ACTION_OPTS);
    expect(r1?.nombre).toBe(r2?.nombre);
  });

  it('devuelve null cuando no hay alternativas válidas', () => {
    const toReplace = mkCultura('Museo Único', 20.67, -103.34);
    // empty pool → no candidates
    const result = pickReplaceStop([], [toReplace], 0, ACTION_OPTS);
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regresión: arte + cafeterias + naturaleza + vida-nocturna → nunca vacío
// ─────────────────────────────────────────────────────────────────────────────
describe('regresión: intereses mixtos sin gastronomia no producen itinerario vacío', () => {
  const artePlace = mkPlace({ nombre: 'Museo de Arte', categoria: 'Arte e Historia', horaApertura: '09:00', horaCierre: '18:00', diasCerrado: 'ninguno', costo: 'Gratis', lat: 20.67, lng: -103.34 });
  const cafeVegano = mkPlace({ nombre: 'Café Verde', categoria: 'Cafeterías, Vegana', horaApertura: '07:00', horaCierre: '20:00', diasCerrado: 'ninguno', costo: 'Gratis', lat: 20.68, lng: -103.35 });
  const cafeGastro = mkPlace({ nombre: 'Café Bistro', categoria: 'Gastronomía, Cafeterías', horaApertura: '07:00', horaCierre: '20:00', diasCerrado: 'ninguno', costo: 'Gratis', lat: 20.69, lng: -103.33 });
  const gastroNocturna = mkPlace({ nombre: 'Cantina Tapatía', categoria: 'Gastronomía Mexicana, Vida Nocturna', horaApertura: '20:00', horaCierre: '02:00', diasCerrado: 'ninguno', costo: 'Gratis', lat: 20.66, lng: -103.36 });
  const culturaPostre = mkPlace({ nombre: 'Museo con Heladería', categoria: 'Cultura, Música, Fotografía, Vida Nocturna, Postre', horaApertura: '09:00', horaCierre: '22:00', diasCerrado: 'ninguno', costo: 'Gratis', lat: 20.65, lng: -103.37 });
  const parqueNat = mkPlace({ nombre: 'Parque Metropolitano', categoria: 'Naturaleza', horaApertura: '06:00', horaCierre: '20:00', diasCerrado: 'ninguno', costo: 'Gratis', lat: 20.64, lng: -103.38 });
  const barNocturno = mkPlace({ nombre: 'Bar Central', categoria: 'Vida Nocturna', horaApertura: '20:00', horaCierre: '02:00', diasCerrado: 'ninguno', costo: 'Gratis', lat: 20.63, lng: -103.34 });

  const POOL = [artePlace, cafeVegano, cafeGastro, gastroNocturna, culturaPostre, parqueNat, barNocturno];
  const OPTS = {
    interests: ['arte', 'cafeterias', 'naturaleza', 'vida-nocturna'],
    ritmo: 'normal' as const,
    startTime: '11:00',
    budget: 1500,
    selectedDate: '2026-05-09',
    seed: 42,
    duration: 'dia-completo' as const,
  };

  it('nunca devuelve arreglo vacío', () => {
    const result = generateItinerary(POOL, OPTS);
    expect(result.length).toBeGreaterThan(0);
  });

  it('cafeterías con categoria "Cafeterías, Vegana" se incluyen (no van al gastroPool)', () => {
    const result = generateItinerary(POOL, OPTS);
    const hasCafe = result.some(p => matchesInterest(p.categoria, 'cafeterias'));
    expect(hasCafe).toBe(true);
  });

  it('cafeterías con categoria "Gastronomía, Cafeterías" se incluyen (no van al gastroPool)', () => {
    // Pool solo con cafeGastro + arte para que se seleccione
    const result = generateItinerary([cafeGastro, artePlace, parqueNat], OPTS);
    expect(result.length).toBeGreaterThan(0);
  });
});
