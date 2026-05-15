// Funciones puras del motor de itinerarios — importables sin React
//
// REVISIÓN MAYO 2026 — Cambios principales:
//   FIX A: pickAddStop y pickReplaceStop ahora calculan horarios reales
//          considerando isMatch/isCamino y devuelven el lugar con
//          forcedArrival para que buildSchedule lo respete.
//   FIX B: pickAddStop respeta maxPlaces, intereses originales y valida
//          que la nueva llegada no caiga fuera del horario operativo.
//   FIX C: Itinerario vacío — múltiples salvavidas: el fallback final
//          ahora valida con tryAdd relajando restricciones gradualmente
//          en vez de hacer un push directo sin validar.
//   FIX D: revalidateSlots ya no puede vaciar todo el itinerario; si
//          quedaría vacío, conserva al menos la primera parada válida.
//   FIX E: Constantes nombradas, helpers compartidos (toMins, isOpenWindow),
//          tipos de comida no se duplican en pickAddStop/pickReplaceStop.

// ── Constantes ───────────────────────────────────────────────────────────────
const TRANSIT_MINS = 30;
const MIN_GASTRO_GAP_MINS = 150;
const EARTH_RADIUS_KM = 6371;

// Ventanas horarias (en horas)
const CAFE_MORNING_CUTOFF_HOUR = 12;
const NOCTURNA_OPEN_HOUR = 20;
const COMPRAS_OPEN_HOUR = 11;
const LAST_REASONABLE_ARRIVAL_HOUR = 23; // tope absoluto para añadir paradas

// Duración del día por modo (min)
const DURATION_MINS: Record<'rapido' | 'medio-dia' | 'dia-completo', number> = {
  'rapido': 180,
  'medio-dia': 360,
  'dia-completo': 540,
};

// ── Helpers de tiempo (compartidos) ──────────────────────────────────────────
export function toMins(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function addMinutes(time: string, mins: number): string {
  const total = toMins(time) + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(((total % 60) + 60) % 60).padStart(2, '0')}`;
}

// ── Shuffle con semilla (evita aleatoriedad no determinista) ─────────────────
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  const rand = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Semilla diaria: varía cada día pero es constante dentro del mismo día
export function dailySeed(): number {
  return parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
}

// ── Tipos ────────────────────────────────────────────────────────────────────
export interface Place {
  nombre: string;
  categoria: string;
  tiempoEstancia: number;
  costo: string;
  lat?: number;
  lng?: number;
  horaApertura?: string;
  horaCierre?: string;
  diasCerrado?: string;
  isMatch?: boolean;
  isCamino?: boolean;
  forcedArrival?: string;
  fotos?: string[];
  calificacion?: string;
  direccion?: string;
}

export interface Stop {
  place: Place;
  horaLlegada: string;
  horaSalida: string;
  traslado: string;
}

export type MealContext = 'desayuno' | 'comida' | 'cena';
export type Ritmo = 'tranquilo' | 'normal' | 'activo';

// ── Datos estáticos ──────────────────────────────────────────────────────────
export const BLACKLIST = ['glorieta de la minerva', 'julieta venegas', 'sebastian yatra', 'akron', 'complejo verde valle', 'tacos el super'];

export const MATCH_DAYS: Record<string, { partido: string; equipos: string; hora: string }> = {
  '2026-06-11': { partido: 'Grupo A · Estadio Akron', equipos: 'Corea del Sur vs. Chequia',    hora: '20:00' },
  '2026-06-18': { partido: 'Grupo A · Estadio Akron', equipos: 'México vs. Corea del Sur',      hora: '19:00' },
  '2026-06-23': { partido: 'Grupo K · Estadio Akron', equipos: 'Colombia vs. RD Congo',         hora: '20:00' },
  '2026-06-26': { partido: 'Grupo H · Estadio Akron', equipos: 'Uruguay vs. España',            hora: '18:00' },
};

export const INTEREST_MAP: Record<string, string[]> = {
  futbol:          ['futbol', 'fan zone', 'fanzone', 'deportivo', 'zona deportiva'],
  gastronomia:     ['gastronomia', 'mexicana', 'postre', 'vegana', 'comida calle'],
  'vida-nocturna': ['nocturna', 'bar', 'cantina'],
  cultura:         ['cultura', 'museos', 'arte e historia', 'arquitectura'],
  compras:         ['compras'],
  naturaleza:      ['naturaleza', 'parque', 'verde'],
  fotografia:      ['fotografia', 'mirador', 'vista'],
  arquitectura:    ['arquitectura', 'historico', 'patrimonio'],
  arte:            ['arte e historia', 'arte'],
  cafeterias:      ['cafeteria', 'cafe', 'brunch', 'cafe de especialidad'],
};

// ── Helpers de strings y matching ────────────────────────────────────────────
export function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function matchesInterest(categoria: string, interest: string): boolean {
  const cat = norm(categoria);
  return (INTEREST_MAP[interest] || []).some(kw => cat.includes(kw));
}

// Distingue cantinas/bares puros (bloqueados a 20 h) de restaurantes que
// también tienen vida nocturna (pueden aparecer de día para comer).
export function isPureNocturna(p: Place): boolean {
  if (!matchesInterest(p.categoria, 'vida-nocturna')) return false;
  const nombre = norm(p.nombre);
  const cat = norm(p.categoria);
  const isCantina = nombre.includes('cantina') || cat.includes('cantina');
  // Restaurantes con gastronomía (que no sean cantinas) son flexibles
  if (matchesInterest(p.categoria, 'gastronomia') && !isCantina) return false;
  // Lugares culturales con vida nocturna también son flexibles de día
  if (matchesInterest(p.categoria, 'cultura') ||
      matchesInterest(p.categoria, 'arte') ||
      matchesInterest(p.categoria, 'fotografia')) return false;
  // Cantinas, bares y clubs puros → bloqueados a 20 h
  return true;
}

export function getDayOfWeek(dateStr: string): string {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

export function getMealContext(time: string): MealContext {
  const hour = parseInt(time.split(':')[0]);
  if (hour < 12) return 'desayuno';
  if (hour < 17) return 'comida';
  return 'cena';
}

export function parseCostMin(costoStr: string): number {
  if (!costoStr || /gratis/i.test(costoStr)) return 0;
  const match = costoStr.replace(/[,. ]/g, '').match(/\$?(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

// ── Apertura ────────────────────────────────────────────────────────────────
export function isPlaceOpen(place: Place, arrivalTime: string, dayOfWeek: string): boolean {
  if (!place.horaApertura || !place.horaCierre) return true;
  if (place.horaApertura === '00:00' && place.horaCierre === '23:59') return true;
  if (place.diasCerrado && place.diasCerrado !== 'ninguno') {
    const closed = place.diasCerrado.split(',').map(d => norm(d.trim()));
    if (closed.includes(norm(dayOfWeek))) return false;
  }
  const arr = toMins(arrivalTime);
  const open = toMins(place.horaApertura);
  let close = toMins(place.horaCierre);
  if (close <= open) close += 24 * 60;
  return arr >= open && (arr + place.tiempoEstancia) <= close;
}

// ── Scoring de comida ────────────────────────────────────────────────────────
export function mealScore(place: Place, meal: MealContext): number {
  const text = norm(`${place.nombre} ${place.categoria}`);
  const keywords: Record<MealContext, string[]> = {
    desayuno: ['desayuno', 'cafe', 'cafeteria', 'brunch', 'pan', 'jugo', 'breakfast', 'torta'],
    comida:   ['comida', 'birria', 'torta ahogada', 'pozole', 'taco', 'tacos', 'fonda', 'mexicana', 'lonche'],
    cena:     ['cena', 'cantina', 'nocturna', 'mariscos', 'coctel', 'restaurant'],
  };
  const penalize: Record<MealContext, string[]> = {
    desayuno: ['cena', 'nocturna', 'bar', 'cantina'],
    comida:   [],
    cena:     ['desayuno', 'cafe', 'brunch'],
  };
  let score = 0;
  for (const kw of keywords[meal]) if (text.includes(norm(kw))) score++;
  for (const kw of penalize[meal]) if (text.includes(norm(kw))) score--;
  return score;
}

export function getFoodType(place: Place): string {
  const text = norm(place.nombre);
  if (text.includes('taco')) return 'tacos';
  if (text.includes('birria') || text.includes('birriera') || text.includes('birrieria')) return 'birria';
  if (text.includes('torta')) return 'tortas';
  if (text.includes('pozole')) return 'pozole';
  if (text.includes('tamal')) return 'tamales';
  if (text.includes('mariscos') || text.includes('ceviche')) return 'mariscos';
  if (text.includes('cafe') || text.includes('cafeteria') || text.includes('brunch')) return 'cafe';
  if (text.includes('lonche')) return 'lonches';
  return `unique_${norm(place.nombre)}`;
}

// ── Geo ──────────────────────────────────────────────────────────────────────
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function routeDistance(places: Place[]): number {
  let total = 0;
  for (let i = 0; i < places.length - 1; i++) {
    const a = places[i], b = places[i + 1];
    if (a.lat != null && a.lng != null && b.lat != null && b.lng != null)
      total += haversine(a.lat, a.lng, b.lat, b.lng);
  }
  return total;
}

export function sortByProximity(places: Place[]): Place[] {
  if (places.length <= 2) return places;

  const greedyFrom = (startIdx: number): Place[] => {
    const remaining = places.filter((_, i) => i !== startIdx);
    const route: Place[] = [places[startIdx]];
    while (remaining.length > 0) {
      const last = route[route.length - 1];
      if (last.lat == null || last.lng == null) { route.push(remaining.splice(0, 1)[0]); continue; }
      let minDist = Infinity, minIdx = 0;
      remaining.forEach((p, i) => {
        if (p.lat != null && p.lng != null) {
          const d = haversine(last.lat!, last.lng!, p.lat, p.lng);
          if (d < minDist) { minDist = d; minIdx = i; }
        }
      });
      route.push(remaining.splice(minIdx, 1)[0]);
    }
    return route;
  };

  let best = greedyFrom(0);
  let bestDist = routeDistance(best);
  for (let i = 1; i < places.length; i++) {
    const route = greedyFrom(i);
    const dist = routeDistance(route);
    if (dist < bestDist) { bestDist = dist; best = route; }
  }
  return best;
}

export function repairConsecutiveGastro(places: Place[]): Place[] {
  const isFood = (p: Place) =>
    matchesInterest(p.categoria, 'gastronomia') || matchesInterest(p.categoria, 'cafeterias');

  const arr = [...places];
  for (let i = 0; i < arr.length - 1; i++) {
    const aFood = isFood(arr[i]);
    const bFood = isFood(arr[i + 1]);
    if (!aFood || !bFood) continue;

    // Mismo tipo de "comida" consecutivo → buscar un no-comida para intercalar
    const sameType =
      (matchesInterest(arr[i].categoria, 'gastronomia') && matchesInterest(arr[i + 1].categoria, 'gastronomia')) ||
      (matchesInterest(arr[i].categoria, 'cafeterias')  && matchesInterest(arr[i + 1].categoria, 'cafeterias'));
    if (!sameType) continue;

    const pairType = matchesInterest(arr[i].categoria, 'gastronomia') ? 'gastronomia' : 'cafeterias';
    let swapIdx = -1;
    for (let j = i + 2; j < arr.length; j++) {
      if (!matchesInterest(arr[j].categoria, pairType)) { swapIdx = j; break; }
    }
    if (swapIdx >= 0) {
      const tmp = arr[swapIdx];
      arr.splice(swapIdx, 1);
      arr.splice(i + 1, 0, tmp);
      i = Math.max(0, i - 1);
    }
  }
  return arr;
}

// ── Schedule ─────────────────────────────────────────────────────────────────
export function buildSchedule(places: Place[], startTime: string): Stop[] {
  let current = startTime;
  return places.map((place, i) => {
    if (place.forcedArrival) current = place.forcedArrival;
    const horaLlegada = current;
    const horaSalida = addMinutes(current, place.tiempoEstancia || 60);
    current = addMinutes(horaSalida, i < places.length - 1 ? TRANSIT_MINS : 0);
    return { place, horaLlegada, horaSalida, traslado: '' };
  });
}

// FIX A: Calcula la hora real de llegada a la posición `targetIndex` en una
// lista de paradas existentes, respetando forcedArrival de partidos/caminos.
// Si targetIndex >= length, devuelve la hora de llegada al "siguiente hueco".
export function estimateArrivalAt(
  places: Place[],
  targetIndex: number,
  startTime: string
): string {
  const schedule = buildSchedule(places, startTime);
  if (targetIndex < schedule.length) {
    return schedule[targetIndex].horaLlegada;
  }
  if (schedule.length === 0) return startTime;
  const last = schedule[schedule.length - 1];
  return addMinutes(last.horaSalida, TRANSIT_MINS);
}

// Revalida reglas de horario tras el reordenamiento geográfico.
// FIX D: nunca vacía completamente la lista si había candidatos válidos al
//        principio. Si todas las paradas fallan, conserva la primera del
//        input para que el itinerario no salga vacío.
function revalidateSlots(
  places: Place[],
  startTime: string,
  params: { hasCafeterias: boolean; isMatchDay: boolean; startHour: number; dayOfWeek: string }
): Place[] {
  const valid: Place[] = [];
  let time = startTime;
  for (const place of places) {
    const arrHour = parseInt(time.split(':')[0]);
    const isCafe = matchesInterest(place.categoria, 'cafeterias');
    let ok = true;

    if (!isPlaceOpen(place, time, params.dayOfWeek)) ok = false;
    if (isCafe && params.hasCafeterias) {
      if (params.startHour < CAFE_MORNING_CUTOFF_HOUR && arrHour >= CAFE_MORNING_CUTOFF_HOUR) ok = false;
      // tarde/noche: isPlaceOpen ya filtra por horario real del lugar
    }
    if (norm(place.categoria).includes('compras') && arrHour < COMPRAS_OPEN_HOUR) ok = false;

    if (ok) {
      valid.push(place);
      time = addMinutes(addMinutes(time, place.tiempoEstancia), TRANSIT_MINS);
    }
  }

  // FIX D: salvavidas — si todo se descartó pero había paradas, conserva la
  // primera. Mejor un itinerario imperfecto que uno vacío.
  if (valid.length === 0 && places.length > 0) {
    return [places[0]];
  }
  return valid;
}

// ── Validación de inputs ──────────────────────────────────────────────────────
export interface GenerateOptions {
  interests: string[];
  ritmo: Ritmo;
  startTime: string;
  budget: number;
  selectedDate: string;
  seed?: number;
  duration?: 'rapido' | 'medio-dia' | 'dia-completo';
  foodPreference?: string;
  userLat?: number;
  userLng?: number;
  walkRadius?: number;
  reservedMins?: number;
}

export function validateGenerateOptions(opts: GenerateOptions): string | null {
  if (!opts.interests || opts.interests.length === 0)
    return 'Debes seleccionar al menos un interés';
  if (!/^\d{2}:\d{2}$/.test(opts.startTime))
    return 'Hora de inicio inválida (formato esperado HH:MM)';
  const [h, m] = opts.startTime.split(':').map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59)
    return 'Hora de inicio fuera de rango (00:00–23:59)';
  if (opts.budget < 0)
    return 'El presupuesto no puede ser negativo';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.selectedDate) || isNaN(Date.parse(opts.selectedDate)))
    return 'Fecha inválida (formato esperado YYYY-MM-DD)';
  if (!['tranquilo', 'normal', 'activo'].includes(opts.ritmo))
    return 'Ritmo inválido (valores: tranquilo, normal, activo)';
  return null;
}

// ── generateItinerary ────────────────────────────────────────────────────────
export function generateItinerary(places: Place[], opts: GenerateOptions): Place[] {
  const error = validateGenerateOptions(opts);
  if (error) throw new Error(error);

  const { interests, ritmo, startTime, budget, selectedDate, seed = dailySeed() } = opts;
  const selectedDayOfWeek = getDayOfWeek(selectedDate);
  const isMatchDay = selectedDate in MATCH_DAYS;
  const startHour = parseInt(startTime.split(':')[0]);
  const hasCafeterias = interests.includes('cafeterias');
  const hasGastro = interests.includes('gastronomia');
  const hasNocturna = interests.includes('vida-nocturna');

  // ── Pre-filters ──────────────────────────────────────────────────────────────
  let filtered = places.filter(p =>
    !BLACKLIST.some(bl => norm(p.nombre).includes(bl)) &&
    interests.some(interest => matchesInterest(p.categoria, interest)) &&
    (parseCostMin(p.costo) === 0 || parseCostMin(p.costo) <= budget)
  );

  // Salvavidas presupuesto: si filtros estrictos dejan <3, relaja presupuesto
  if (filtered.length < 3 && budget > 0) {
    const sinPresupuesto = places.filter(p =>
      !BLACKLIST.some(bl => norm(p.nombre).includes(bl)) &&
      interests.some(interest => matchesInterest(p.categoria, interest))
    );
    if (sinPresupuesto.length > filtered.length) filtered = sinPresupuesto;
  }

  if (opts.walkRadius !== undefined && opts.userLat !== undefined && opts.userLng !== undefined) {
    const withCoords = filtered.filter(p =>
      p.lat != null && p.lng != null &&
      haversine(opts.userLat!, opts.userLng!, p.lat, p.lng) <= opts.walkRadius!
    );
    if (withCoords.length >= 3) filtered = withCoords;
  }

  if (opts.foodPreference === 'vegetariano') {
    filtered = filtered.filter(p => {
      if (matchesInterest(p.categoria, 'gastronomia')) {
        const cat = norm(p.categoria);
        return cat.includes('vegana') || cat.includes('vegetaria') || cat.includes('sano');
      }
      return true;
    });
  }

  if (opts.foodPreference === 'nocturna') {
    filtered = filtered.filter(p => {
      if (matchesInterest(p.categoria, 'gastronomia')) {
        return matchesInterest(p.categoria, 'vida-nocturna');
      }
      return true;
    });
  }

  if (filtered.length === 0) return [];

  // ── Capacity planning ────────────────────────────────────────────────────────
  const ritmoMult = ritmo === 'tranquilo' ? 1.3 : ritmo === 'activo' ? 0.8 : 1;
  const adjusted = filtered.map(p => ({ ...p, tiempoEstancia: Math.round(p.tiempoEstancia * ritmoMult) }));

  let maxPlaces: number;
  let targetMins: number | null;

  if (opts.duration) {
    const reservedMins = opts.reservedMins ?? 0;
    targetMins = DURATION_MINS[opts.duration] - reservedMins;
    const basePlaces = opts.duration === 'rapido' ? 3 : opts.duration === 'medio-dia' ? 6 : 10;
    maxPlaces = ritmo === 'activo' ? basePlaces + 2 : ritmo === 'tranquilo' ? Math.max(2, basePlaces - 1) : basePlaces;
  } else {
    targetMins = null;
    maxPlaces = ritmo === 'tranquilo' ? 3 : ritmo === 'normal' ? 4 : 5;
  }

  const maxGastro = opts.duration
    ? (opts.duration === 'rapido' ? 1 : opts.duration === 'medio-dia' ? 2 : startHour < 11 ? 3 : 2)
    : (ritmo === 'tranquilo' ? 1 : 2);

  const mealCtx = getMealContext(startTime);

  // ── Pool building ────────────────────────────────────────────────────────────
  const postrePool: Place[] = (opts.duration && interests.includes('gastronomia'))
    ? seededShuffle(
        adjusted.filter(p =>
          norm(p.categoria).includes('postre') &&
          isPlaceOpen(p, '14:00', selectedDayOfWeek)
        ), seed + 2)
    : [];

  const isGastroForPool = (p: Place) => hasGastro && matchesInterest(p.categoria, 'gastronomia');
  const isNocturnaForPool = (p: Place) => isPureNocturna(p) && !isGastroForPool(p);

  const gastroPool = hasGastro
    ? adjusted.filter(p => matchesInterest(p.categoria, 'gastronomia'))
              .sort((a, b) => mealScore(b, mealCtx) - mealScore(a, mealCtx))
    : [];

  const nocturnaPool = seededShuffle(
    adjusted.filter(p => isNocturnaForPool(p)),
    seed
  );

  const othersPool = seededShuffle(
    adjusted.filter(p => !isGastroForPool(p) && !isNocturnaForPool(p)),
    seed + 1
  );

  const mainPool: Place[] = (() => {
    const others = hasNocturna ? othersPool : [...othersPool, ...nocturnaPool];
    if (!hasGastro || gastroPool.length === 0) return others;
    if (others.length === 0) return gastroPool;
    const gap = Math.max(2, Math.floor(others.length / Math.max(1, maxGastro)));
    const result: Place[] = [];
    let gi = 0, oi = 0;
    while (gi < gastroPool.length || oi < others.length) {
      for (let j = 0; j < gap && oi < others.length; j++) result.push(others[oi++]);
      if (gi < gastroPool.length) result.push(gastroPool[gi++]);
    }
    return result;
  })();

  // ── Selection loop ───────────────────────────────────────────────────────────
  const selected: Place[] = [];
  let totalTime = 0;
  let gastroCount = 0;
  let lastGastroEndMins = -MIN_GASTRO_GAP_MINS;
  let lastFoodArrivalMins = -1; // gastro O cafetería
  const usedFoodTypes = new Set<string>();
  const usedNames = new Set<string>();

  // tryAdd con opción de relajar restricciones (FIX C: para fallback)
  const tryAdd = (place: Place, relaxed = false): boolean => {
    if (selected.length >= maxPlaces) return false;
    if (usedNames.has(place.nombre)) return false;
    const isGastro = hasGastro && matchesInterest(place.categoria, 'gastronomia');
    const isCafe = matchesInterest(place.categoria, 'cafeterias');
    const isFood = isGastro || isCafe;
    const isNocturna = isPureNocturna(place);
    const estArrival = addMinutes(startTime, totalTime + (selected.length > 0 ? TRANSIT_MINS : 0));
    const arrHour = parseInt(estArrival.split(':')[0]);
    const arrMins = toMins(estArrival);

    if (!isPlaceOpen(place, estArrival, selectedDayOfWeek)) return false;

    if (!relaxed) {
      if (isGastro && hasNocturna && arrHour >= 20) return false;
      if (isNocturna && hasNocturna && arrHour < NOCTURNA_OPEN_HOUR) return false;

      if (isCafe && hasCafeterias && startHour < CAFE_MORNING_CUTOFF_HOUR) {
        if (arrHour >= CAFE_MORNING_CUTOFF_HOUR) return false;
      }

      if (norm(place.categoria).includes('compras') && arrHour < COMPRAS_OPEN_HOUR) return false;

      // Un lugar de comida (gastro o café) antes de las 12:00 bloquea el
      // siguiente hasta las 14:00 — las personas no comen tan seguido.
      if (isFood && lastFoodArrivalMins >= 0 && lastFoodArrivalMins < 12 * 60 && arrMins < 14 * 60) return false;

      if (isGastro) {
        if (gastroCount >= maxGastro) return false;
        if (arrMins - lastGastroEndMins < MIN_GASTRO_GAP_MINS) return false;
        const foodType = getFoodType(place);
        if (usedFoodTypes.has(foodType)) return false;
      }
    }

    const timeNeeded = place.tiempoEstancia + (selected.length > 0 ? TRANSIT_MINS : 0);
    if (targetMins !== null && totalTime + timeNeeded > targetMins) return false;

    selected.push(place);
    usedNames.add(place.nombre);
    totalTime += timeNeeded;
    if (isGastro) {
      usedFoodTypes.add(getFoodType(place));
      gastroCount++;
      lastGastroEndMins = arrMins + place.tiempoEstancia;
    }
    if (isFood) lastFoodArrivalMins = arrMins;
    return true;
  };

  // Pre-selección: cafeterías mañaneras primero para que caigan dentro de la
  // ventana horaria antes de que otros lugares consuman tiempo.
  if (hasCafeterias && startHour < CAFE_MORNING_CUTOFF_HOUR) {
    for (const cafe of mainPool) {
      if (!matchesInterest(cafe.categoria, 'cafeterias')) continue;
      if (tryAdd(cafe)) break;
    }
  }

  for (const place of mainPool) {
    if (selected.length >= maxPlaces) break;
    tryAdd(place);
  }

  // Segunda pasada: llenar tiempo restante (solo con duration)
  if (targetMins !== null && totalTime < targetMins - 30 && selected.length < maxPlaces) {
    for (const place of [...othersPool, ...gastroPool]) {
      if (selected.length >= maxPlaces) break;
      tryAdd(place);
    }
  }

  // Nocturna al final si aplica
  if (hasNocturna && !selected.find(p => matchesInterest(p.categoria, 'vida-nocturna'))) {
    for (const place of nocturnaPool) {
      if (selected.length >= maxPlaces) break;
      if (usedNames.has(place.nombre)) continue;
      const estArrival = addMinutes(startTime, totalTime + TRANSIT_MINS);
      if (parseInt(estArrival.split(':')[0]) < NOCTURNA_OPEN_HOUR) continue;
      if (!isPlaceOpen(place, estArrival, selectedDayOfWeek)) continue;
      selected.push(place);
      break;
    }
  }

  // Garantizar al menos 1 parada por interés (excepto nocturna y fútbol)
  for (const interest of interests) {
    if (interest === 'vida-nocturna' || interest === 'futbol') continue;
    if (selected.some(p => matchesInterest(p.categoria, interest))) continue;
    const fallback = [...othersPool, ...gastroPool].find(p =>
      !usedNames.has(p.nombre) &&
      !BLACKLIST.some(bl => norm(p.nombre).includes(bl)) &&
      matchesInterest(p.categoria, interest)
    );
    if (fallback) tryAdd(fallback);
  }

  // Parada nocturna post-partido
  if ((opts.reservedMins ?? 0) > 0 && hasNocturna) {
    for (const place of nocturnaPool) {
      if (usedNames.has(place.nombre)) continue;
      const estArrival = addMinutes(startTime, totalTime + TRANSIT_MINS);
      if (!isPlaceOpen(place, estArrival, selectedDayOfWeek)) continue;
      selected.push(place);
      break;
    }
  }

  // FIX C: salvavidas anti-itinerario-vacío.
  // En vez de hacer un push directo sin validar (que rompía reglas de horario),
  // intentamos agregar con restricciones relajadas: ignora gap de gastro,
  // ventanas de cafeterías, etc. Solo respeta isPlaceOpen y targetMins.
  if (selected.length === 0) {
    for (const place of mainPool) {
      if (tryAdd(place, /* relaxed */ true)) break;
    }
    // Último recurso: probar todo el universo filtrado relajando todo.
    if (selected.length === 0) {
      for (const place of adjusted) {
        if (tryAdd(place, /* relaxed */ true)) break;
      }
    }
  }

  // ── Ordenar por proximidad + reparar gastro consecutiva ──────────────────────
  const nocturnaFinal = selected.filter(p => isPureNocturna(p));
  const dayStops = selected.filter(p => !nocturnaFinal.includes(p));
  // Cafeterías mañaneras deben quedar al frente antes del reordenamiento
  const morningCafes = (hasCafeterias && startHour < CAFE_MORNING_CUTOFF_HOUR)
    ? dayStops.filter(p => matchesInterest(p.categoria, 'cafeterias'))
    : [];
  const unpinned = dayStops.filter(p => !morningCafes.includes(p));
  const sortedDay = repairConsecutiveGastro([...morningCafes, ...sortByProximity(unpinned)]);

  // Revalidar reglas tras reordenamiento
  const revalidated = revalidateSlots(sortedDay, startTime, {
    hasCafeterias,
    isMatchDay,
    startHour,
    dayOfWeek: selectedDayOfWeek,
  });

  // Inyección de postre
  if (postrePool.length > 0) {
    let simMins = 0;
    let lastComidaIdx = -1;
    for (let i = 0; i < revalidated.length; i++) {
      const arrivalTime = addMinutes(startTime, simMins);
      if (matchesInterest(revalidated[i].categoria, 'gastronomia') && getMealContext(arrivalTime) === 'comida') {
        lastComidaIdx = i;
      }
      simMins += revalidated[i].tiempoEstancia + (i < revalidated.length - 1 ? TRANSIT_MINS : 0);
    }
    if (lastComidaIdx >= 0) {
      const refPlace = revalidated[lastComidaIdx];
      let bestPostre: Place | null = null;
      let bestDist = Infinity;
      for (const p of postrePool) {
        if (usedNames.has(p.nombre)) continue;
        if (refPlace.lat != null && refPlace.lng != null && p.lat != null && p.lng != null) {
          const d = haversine(refPlace.lat, refPlace.lng, p.lat, p.lng);
          if (d < bestDist) { bestDist = d; bestPostre = p; }
        } else if (!bestPostre) bestPostre = p;
      }
      if (bestPostre && revalidated.length < maxPlaces) {
        revalidated.splice(lastComidaIdx + 1, 0, bestPostre);
        const repaired = repairConsecutiveGastro(revalidated);
        revalidated.splice(0, revalidated.length, ...repaired);
      }
    }
  }

  return [...revalidated, ...nocturnaFinal];
}

// ── Lógica pura para agregar/reemplazar paradas ───────────────────────────────

export interface ActionOptions {
  interests: string[];
  budget: number;
  selectedDate: string;
  startTime: string;
  seed?: number;
  maxPlaces?: number;       // FIX B: tope opcional para evitar crecimiento sin fin
  ritmo?: Ritmo;            // FIX A: para escalar tiempoEstancia consistentemente
  foodPreference?: string;  // FIX A: mismas restricciones que generateItinerary
}

// FIX A + FIX B: pickAddStop ahora:
//   1. Calcula la hora real considerando isMatch/isCamino (vía buildSchedule).
//   2. Respeta maxPlaces si se provee.
//   3. Valida ventanas horarias (cafeterías, compras, nocturna).
//   4. Devuelve el lugar con forcedArrival fijado para que el horario sea
//      coherente al insertarlo al final.
//   5. Aplica el multiplicador de ritmo al tiempoEstancia si se provee.
export function pickAddStop(
  allPlaces: Place[],
  currentPlaces: Place[],
  opts: ActionOptions
): Place | null {
  const { interests, budget, selectedDate, startTime, seed = dailySeed() } = opts;
  const dayOfWeek = getDayOfWeek(selectedDate);
  const startHour = parseInt(startTime.split(':')[0]);
  const hasCafeterias = interests.includes('cafeterias');
  const hasGastro = interests.includes('gastronomia');
  const hasNocturna = interests.includes('vida-nocturna');

  // Tope: si el itinerario actual ya alcanzó maxPlaces, no agregamos más.
  if (opts.maxPlaces !== undefined && currentPlaces.length >= opts.maxPlaces) {
    return null;
  }

  const usedNames = new Set(currentPlaces.map(p => p.nombre));
  const usedFoodTypes = new Set<string>();
  currentPlaces.forEach(p => {
    if (matchesInterest(p.categoria, 'gastronomia')) usedFoodTypes.add(getFoodType(p));
  });

  // FIX A: calcular hora real considerando TODAS las paradas (incluyendo
  // partidos y caminos), no solo las "regulares".
  const estArrival = estimateArrivalAt(currentPlaces, currentPlaces.length, startTime);
  const arrMins = toMins(estArrival);
  const arrHour = parseInt(estArrival.split(':')[0]);

  // Si la llegada ya cae fuera del horario operativo razonable, no insertar.
  if (arrHour >= LAST_REASONABLE_ARRIVAL_HOUR) return null;

  // Calcular fin del último gastro y último food arrival entre las paradas actuales.
  const schedule = buildSchedule(currentPlaces, startTime);
  let lastGastroEndMins = -(MIN_GASTRO_GAP_MINS + 1);
  let gastroCount = 0;
  let lastFoodArrivalMins = -1;
  for (let i = 0; i < currentPlaces.length; i++) {
    const isG = matchesInterest(currentPlaces[i].categoria, 'gastronomia');
    const isC = matchesInterest(currentPlaces[i].categoria, 'cafeterias');
    if (isG) {
      lastGastroEndMins = toMins(schedule[i].horaSalida);
      gastroCount++;
    }
    if (isG || isC) lastFoodArrivalMins = toMins(schedule[i].horaLlegada);
  }
  const lastRegular = currentPlaces.filter(p => !p.isMatch && !p.isCamino).pop() ?? null;

  // Ritmo: aplicar multiplicador como hace generateItinerary
  const ritmoMult = opts.ritmo === 'tranquilo' ? 1.3 : opts.ritmo === 'activo' ? 0.8 : 1;

  const candidates = seededShuffle(
    allPlaces
      .filter(p => {
        if (usedNames.has(p.nombre)) return false;
        if (BLACKLIST.some(bl => norm(p.nombre).includes(bl))) return false;
        // Respeta los intereses originales del usuario
        if (!interests.some(int => matchesInterest(p.categoria, int))) return false;
        if (parseCostMin(p.costo) > 0 && parseCostMin(p.costo) > budget) return false;
        if (!isPlaceOpen(p, estArrival, dayOfWeek)) return false;

        const isGastro = matchesInterest(p.categoria, 'gastronomia');
        const isNocturna = isPureNocturna(p);
        const isCafe = matchesInterest(p.categoria, 'cafeterias');
        const isFood = isGastro || isCafe;

        // FIX A: aplicar mismas reglas que tryAdd
        if (isGastro && hasNocturna && arrHour >= 20) return false;
        if (isNocturna && hasNocturna && arrHour < NOCTURNA_OPEN_HOUR) return false;

        if (isCafe && hasCafeterias && startHour < CAFE_MORNING_CUTOFF_HOUR) {
          if (arrHour >= CAFE_MORNING_CUTOFF_HOUR) return false;
        }

        if (norm(p.categoria).includes('compras') && arrHour < COMPRAS_OPEN_HOUR) return false;

        if (isFood && lastFoodArrivalMins >= 0 && lastFoodArrivalMins < 12 * 60 && arrMins < 14 * 60) return false;

        if (isGastro) {
          if (hasGastro && gastroCount >= 3) return false; // cap suave al agregar manualmente
          if (arrMins - lastGastroEndMins < MIN_GASTRO_GAP_MINS) return false;
          if (lastRegular && matchesInterest(lastRegular.categoria, 'gastronomia')) return false;
          if (usedFoodTypes.has(getFoodType(p))) return false;
        }
        // Aplica filtros de foodPreference de forma consistente
        if (opts.foodPreference === 'vegetariano' && isGastro) {
          const cat = norm(p.categoria);
          if (!(cat.includes('vegana') || cat.includes('vegetaria') || cat.includes('sano'))) return false;
        }
        if (opts.foodPreference === 'nocturna' && isGastro) {
          if (!matchesInterest(p.categoria, 'vida-nocturna')) return false;
        }
        return true;
      }),
    seed + arrMins // varía el orden según el momento del día
  );

  const pick = candidates[0];
  if (!pick) return null;

  // FIX A: devolver el lugar con tiempoEstancia ajustado por ritmo y
  // forcedArrival fijado, para que el horario quede coherente al insertarse
  // al final. La UI puede confiar en buildSchedule para renderizar.
  return {
    ...pick,
    tiempoEstancia: Math.round(pick.tiempoEstancia * ritmoMult),
    forcedArrival: estArrival,
  };
}

// FIX A: pickReplaceStop ahora:
//   1. Considera spacing con TODOS los gastro previos y posteriores, no solo
//      con el inmediatamente vecino.
//   2. Conserva el forcedArrival del slot original para preservar el horario.
//   3. Aplica multiplicador de ritmo al tiempoEstancia.
export function pickReplaceStop(
  allPlaces: Place[],
  currentPlaces: Place[],
  stopIndex: number,
  opts: ActionOptions
): Place | null {
  const { interests, budget, selectedDate, startTime, seed = dailySeed() } = opts;
  const dayOfWeek = getDayOfWeek(selectedDate);
  const startHour = parseInt(startTime.split(':')[0]);
  const hasCafeterias = interests.includes('cafeterias');
  const hasNocturna = interests.includes('vida-nocturna');

  const current = currentPlaces[stopIndex];
  if (!current) return null;

  const usedNames = new Set(currentPlaces.map(p => p.nombre));
  usedNames.delete(current.nombre);

  const schedule = buildSchedule(currentPlaces, startTime);
  const estArrival = schedule[stopIndex]?.horaLlegada ?? startTime;
  const arrMins = toMins(estArrival);
  const arrHour = parseInt(estArrival.split(':')[0]);

  // El reemplazo debe matchear AL MENOS un interés que ya cubría el lugar
  // original — así respeta lo que el usuario pidió originalmente.
  const matchingInterest = interests.find(int => matchesInterest(current.categoria, int)) ?? interests[0];

  const prevPlace = stopIndex > 0 ? currentPlaces[stopIndex - 1] : null;
  const nextPlace = stopIndex < currentPlaces.length - 1 ? currentPlaces[stopIndex + 1] : null;

  // Spacing con TODOS los gastros previos y posteriores (no solo vecinos)
  let lastGastroEndMins = -(MIN_GASTRO_GAP_MINS + 1);
  for (let i = 0; i < stopIndex; i++) {
    if (matchesInterest(currentPlaces[i].categoria, 'gastronomia')) {
      lastGastroEndMins = toMins(schedule[i].horaSalida);
    }
  }
  let nextGastroStartMins = Infinity;
  for (let i = stopIndex + 1; i < currentPlaces.length; i++) {
    if (matchesInterest(currentPlaces[i].categoria, 'gastronomia')) {
      nextGastroStartMins = toMins(schedule[i].horaLlegada);
      break;
    }
  }

  // Tipos de comida ya usados (excluyendo el que se reemplaza)
  const usedFoodTypes = new Set<string>();
  currentPlaces.forEach((p, i) => {
    if (i !== stopIndex && matchesInterest(p.categoria, 'gastronomia')) {
      usedFoodTypes.add(getFoodType(p));
    }
  });

  const ritmoMult = opts.ritmo === 'tranquilo' ? 1.3 : opts.ritmo === 'activo' ? 0.8 : 1;

  const candidates = seededShuffle(
    allPlaces.filter(p => {
      if (usedNames.has(p.nombre)) return false;
      if (BLACKLIST.some(bl => norm(p.nombre).includes(bl))) return false;
      if (!matchesInterest(p.categoria, matchingInterest)) return false;
      if (parseCostMin(p.costo) > 0 && parseCostMin(p.costo) > budget) return false;
      if (!isPlaceOpen(p, estArrival, dayOfWeek)) return false;

      const isGastro = matchesInterest(p.categoria, 'gastronomia');
      const isNocturna = isPureNocturna(p);
      const isCafe = matchesInterest(p.categoria, 'cafeterias');

      if (isGastro && hasNocturna && arrHour >= 20) return false;
      if (isNocturna && hasNocturna && arrHour < NOCTURNA_OPEN_HOUR) return false;

      if (isCafe && hasCafeterias && startHour < CAFE_MORNING_CUTOFF_HOUR) {
        if (arrHour >= CAFE_MORNING_CUTOFF_HOUR) return false;
      }

      if (norm(p.categoria).includes('compras') && arrHour < COMPRAS_OPEN_HOUR) return false;

      if (isGastro) {
        if (arrMins - lastGastroEndMins < MIN_GASTRO_GAP_MINS) return false;
        const endMins = arrMins + Math.round(p.tiempoEstancia * ritmoMult);
        if (nextGastroStartMins - endMins < MIN_GASTRO_GAP_MINS) return false;
        if (prevPlace && matchesInterest(prevPlace.categoria, 'gastronomia')) return false;
        if (nextPlace && matchesInterest(nextPlace.categoria, 'gastronomia')) return false;
        if (usedFoodTypes.has(getFoodType(p))) return false;
      }

      if (opts.foodPreference === 'vegetariano' && isGastro) {
        const cat = norm(p.categoria);
        if (!(cat.includes('vegana') || cat.includes('vegetaria') || cat.includes('sano'))) return false;
      }
      if (opts.foodPreference === 'nocturna' && isGastro) {
        if (!matchesInterest(p.categoria, 'vida-nocturna')) return false;
      }
      return true;
    }),
    seed + arrMins
  );

  const pick = candidates[0];
  if (!pick) return null;

  // FIX A: conservar forcedArrival del slot original para mantener el horario.
  // Si el original tenía forcedArrival (p.ej. un partido), no lo sobreescribimos
  // — pero los partidos no se reemplazan vía esta función. Para paradas
  // regulares, fijar forcedArrival = horaLlegada original asegura que el resto
  // del schedule no se desplace.
  return {
    ...pick,
    tiempoEstancia: Math.round(pick.tiempoEstancia * ritmoMult),
    forcedArrival: estArrival,
  };
}

// ── Conversión de datos raw → Place ──────────────────────────────────────────
// /api/places devuelve claves en formato CSV ('Nombre del Lugar', 'Categoria',
// etc.). Esta función es la única fuente de verdad para ese mapeo.
// Úsala en page.tsx, route.ts o cualquier cliente que consuma /api/places.

function parseCoord(s: unknown): number | undefined {
  if (!s) return undefined;
  const v = parseFloat(String(s).replace(',', '.'));
  return isNaN(v) ? undefined : v;
}

export function rawToPlace(p: Record<string, any>): Place | null {
  const nombre = String(p['Nombre del Lugar'] || '').trim();
  if (!nombre) return null;
  return {
    nombre,
    categoria:      p['Categoria']        || '',
    direccion:      p['Dirección']        || '',
    tiempoEstancia: parseInt(p['Tiempo de Estancia']) || 60,
    costo:          p['Costo Estimado']   || 'No disponible',
    calificacion:   p['Calificacion']     || '',
    fotos:          Array.isArray(p['fotos']) ? p['fotos'] : [],
    lat:            parseCoord(p['Latitud']),
    lng:            parseCoord(p['Longitud']),
    horaApertura:   p['horaApertura']     || undefined,
    horaCierre:     p['horaCierre']       || undefined,
    diasCerrado:    p['diasCerrado']      || 'ninguno',
  };
}