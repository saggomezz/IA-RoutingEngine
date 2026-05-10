import { describe, it, expect } from 'vitest';
import {
  norm, matchesInterest, isPlaceOpen, getDayOfWeek,
  addMinutes, getMealContext, parseCostMin,
  mealScore, getFoodType, haversine,
  sortByProximity, repairConsecutiveGastro,
  buildSchedule, generateItinerary,
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
const birrieria = mkPlace({ nombre: 'La Birriería', categoria: 'Gastronomía Mexicana', horaApertura: '09:00', horaCierre: '18:00', diasCerrado: 'ninguno', lat: 20.67, lng: -103.34 });
const cafe = mkPlace({ nombre: 'Café Central', categoria: 'Cafeterías', horaApertura: '07:00', horaCierre: '20:00', diasCerrado: 'ninguno', lat: 20.67, lng: -103.33 });
const bar = mkPlace({ nombre: 'Bar La Fuente', categoria: 'Vida Nocturna', horaApertura: '20:00', horaCierre: '02:00', diasCerrado: 'ninguno', lat: 20.66, lng: -103.34 });
const parque = mkPlace({ nombre: 'Parque Agua Azul', categoria: 'Naturaleza', horaApertura: '06:00', horaCierre: '18:00', diasCerrado: 'ninguno', lat: 20.66, lng: -103.36 });
const teatro = mkPlace({ nombre: 'Teatro Degollado', categoria: 'Música, Arte e Historia, Cultura', horaApertura: '10:00', horaCierre: '20:00', diasCerrado: 'ninguno', lat: 20.67, lng: -103.34 });
const postre = mkPlace({ nombre: 'Heladería', categoria: 'Gastronomía, Postre', horaApertura: '10:00', horaCierre: '22:00', diasCerrado: 'ninguno', lat: 20.67, lng: -103.34 });

const palacio    = mkPlace({ nombre: 'Palacio de Gobierno', categoria: 'Cultura, Museos', horaApertura: '09:00', horaCierre: '18:00', diasCerrado: 'ninguno', lat: 20.67, lng: -103.34 });
const mercado    = mkPlace({ nombre: 'Mercado San Juan', categoria: 'Gastronomía Mexicana', horaApertura: '08:00', horaCierre: '18:00', diasCerrado: 'domingo', lat: 20.68, lng: -103.34, costo: '$100' });
const bosque     = mkPlace({ nombre: 'Bosque Colomos', categoria: 'Naturaleza, Aventura', horaApertura: '06:00', horaCierre: '18:00', diasCerrado: 'ninguno', lat: 20.70, lng: -103.37 });

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
  it('el primer lugar es siempre el mismo', () => {
    const result = sortByProximity([museo, taqueria, parque]);
    expect(result[0]).toBe(museo);
  });
  it('lugares sin coords no se pierden', () => {
    const sinCoords = mkPlace({ nombre: 'Sin coords', categoria: 'Cultura' });
    const result = sortByProximity([museo, sinCoords, taqueria]);
    expect(result).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('repairConsecutiveGastro', () => {
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
