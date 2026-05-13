// Funciones puras del motor de itinerarios — importables sin React

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

export function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function matchesInterest(categoria: string, interest: string): boolean {
  const cat = norm(categoria);
  return (INTEREST_MAP[interest] || []).some(kw => cat.includes(kw));
}

export function isPlaceOpen(place: Place, arrivalTime: string, dayOfWeek: string): boolean {
  if (!place.horaApertura || !place.horaCierre) return true;
  if (place.horaApertura === '00:00' && place.horaCierre === '23:59') return true;
  if (place.diasCerrado && place.diasCerrado !== 'ninguno') {
    const closed = place.diasCerrado.split(',').map(d => norm(d.trim()));
    if (closed.includes(norm(dayOfWeek))) return false;
  }
  const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const arr = toMins(arrivalTime);
  const open = toMins(place.horaApertura);
  let close = toMins(place.horaCierre);
  if (close <= open) close += 24 * 60;
  return arr >= open && (arr + place.tiempoEstancia) <= close;
}

export function getDayOfWeek(dateStr: string): string {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

export function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
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

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  const arr = [...places];
  for (let i = 0; i < arr.length - 1; i++) {
    if (matchesInterest(arr[i].categoria, 'gastronomia') && matchesInterest(arr[i + 1].categoria, 'gastronomia')) {
      let swapIdx = -1;
      for (let j = i + 2; j < arr.length; j++) {
        if (!matchesInterest(arr[j].categoria, 'gastronomia')) { swapIdx = j; break; }
      }
      if (swapIdx >= 0) {
        const tmp = arr[swapIdx];
        arr.splice(swapIdx, 1);
        arr.splice(i + 1, 0, tmp);
        i = Math.max(0, i - 1);
      }
    }
  }
  return arr;
}

export function buildSchedule(places: Place[], startTime: string): Stop[] {
  const TRANSIT = 30;
  let current = startTime;
  return places.map((place, i) => {
    if (place.forcedArrival) current = place.forcedArrival;
    const horaLlegada = current;
    const horaSalida = addMinutes(current, place.tiempoEstancia || 60);
    current = addMinutes(horaSalida, i < places.length - 1 ? TRANSIT : 0);
    return { place, horaLlegada, horaSalida, traslado: '' };
  });
}

// Revalida reglas de horario tras el reordenamiento geográfico.
// Avanza el reloj solo para los lugares que se mantienen.
function revalidateSlots(
  places: Place[],
  startTime: string,
  params: { hasCafeterias: boolean; isMatchDay: boolean; startHour: number; dayOfWeek: string }
): Place[] {
  const TRANSIT = 30;
  const valid: Place[] = [];
  let time = startTime;
  for (const place of places) {
    const arrHour = parseInt(time.split(':')[0]);
    const isCafe = matchesInterest(place.categoria, 'cafeterias');
    let ok = true;

    if (!isPlaceOpen(place, time, params.dayOfWeek)) ok = false;
    if (isCafe && params.hasCafeterias) {
      if (params.startHour < 13 && arrHour >= 13) ok = false;
      if (params.startHour >= 13 && !params.isMatchDay && arrHour < 18) ok = false;
    }
    if (norm(place.categoria).includes('compras') && arrHour < 11) ok = false;

    if (ok) {
      valid.push(place);
      time = addMinutes(addMinutes(time, place.tiempoEstancia), TRANSIT);
    }
  }
  return valid;
}

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

// ── Validación de inputs ──────────────────────────────────────────────────────
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

export function generateItinerary(places: Place[], opts: GenerateOptions): Place[] {
  const error = validateGenerateOptions(opts);
  if (error) throw new Error(error);

  const { interests, ritmo, startTime, budget, selectedDate, seed = dailySeed() } = opts;
  const selectedDayOfWeek = getDayOfWeek(selectedDate);
  const TRANSIT = 30;
  const MIN_GASTRO_GAP = 150;
  const isMatchDay = selectedDate in MATCH_DAYS;
  const startHour = parseInt(startTime.split(':')[0]);
  const hasCafeterias = interests.includes('cafeterias');
  const hasGastro = interests.includes('gastronomia');
  const hasNocturna = interests.includes('vida-nocturna');
  const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

  // ── Pre-filters ──────────────────────────────────────────────────────────────
  let filtered = places.filter(p =>
    !BLACKLIST.some(bl => norm(p.nombre).includes(bl)) &&
    interests.some(interest => matchesInterest(p.categoria, interest)) &&
    (parseCostMin(p.costo) === 0 || parseCostMin(p.costo) <= budget)
  );

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
    const rawTarget = opts.duration === 'rapido' ? 180 : opts.duration === 'medio-dia' ? 360 : 540;
    targetMins = rawTarget - reservedMins;
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

  // Pool membership based on user intent: a place is "gastro" only if the user selected gastronomia
  const isGastroForPool = (p: Place) => hasGastro && matchesInterest(p.categoria, 'gastronomia');
  const isNocturnaForPool = (p: Place) => matchesInterest(p.categoria, 'vida-nocturna') && !isGastroForPool(p);

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
  let lastGastroEndMins = -MIN_GASTRO_GAP;
  let lastGastroArrivalMins = -1;
  const usedFoodTypes = new Set<string>();
  const usedNames = new Set<string>();

  const tryAdd = (place: Place): boolean => {
    if (selected.length >= maxPlaces) return false;
    if (usedNames.has(place.nombre)) return false;
    const isGastro = hasGastro && matchesInterest(place.categoria, 'gastronomia');
    const isNocturna = matchesInterest(place.categoria, 'vida-nocturna');
    const estArrival = addMinutes(startTime, totalTime + (selected.length > 0 ? TRANSIT : 0));
    const arrHour = parseInt(estArrival.split(':')[0]);
    const arrMins = toMins(estArrival);

    if (!isPlaceOpen(place, estArrival, selectedDayOfWeek)) return false;
    if (isGastro && hasNocturna && arrHour >= 20) return false;
    if (isNocturna && hasNocturna && arrHour < 20) return false;

    const isCafe = matchesInterest(place.categoria, 'cafeterias');
    if (isCafe && hasCafeterias) {
      if (startHour < 13) {
        if (arrHour >= 13) return false;
      } else {
        if (isMatchDay) return false;
        if (arrHour < 18) return false;
      }
    }

    if (norm(place.categoria).includes('compras') && arrHour < 11) return false;

    if (isGastro) {
      if (gastroCount >= maxGastro) return false;
      if (arrMins - lastGastroEndMins < MIN_GASTRO_GAP) return false;
      if (lastGastroArrivalMins >= 0 && lastGastroArrivalMins < 13 * 60 && arrMins < 14 * 60) return false;
      const foodType = getFoodType(place);
      if (usedFoodTypes.has(foodType)) return false;
    }

    const timeNeeded = place.tiempoEstancia + (selected.length > 0 ? TRANSIT : 0);
    if (targetMins !== null && totalTime + timeNeeded > targetMins) return false;

    selected.push(place);
    usedNames.add(place.nombre);
    totalTime += timeNeeded;
    if (isGastro) {
      usedFoodTypes.add(getFoodType(place));
      gastroCount++;
      lastGastroEndMins = arrMins + place.tiempoEstancia;
      lastGastroArrivalMins = arrMins;
    }
    return true;
  };

  for (const place of mainPool) {
    if (selected.length >= maxPlaces) break;
    tryAdd(place);
  }

  // Segunda pasada para llenar tiempo restante (solo con duration)
  if (targetMins !== null && totalTime < targetMins - 30 && selected.length < maxPlaces) {
    for (const place of [...othersPool, ...gastroPool]) {
      if (selected.length >= maxPlaces) break;
      tryAdd(place);
    }
  }

  // Nocturna al final si aplica
  if (hasNocturna && !selected.find(p => isNocturnaForPool(p))) {
    for (const place of nocturnaPool) {
      if (selected.length >= maxPlaces) break;
      if (usedNames.has(place.nombre)) continue;
      const estArrival = addMinutes(startTime, totalTime + TRANSIT);
      if (parseInt(estArrival.split(':')[0]) < 20) continue;
      if (!isPlaceOpen(place, estArrival, selectedDayOfWeek)) continue;
      selected.push(place);
      break;
    }
  }

  // FIX 3 — Garantizar al menos 1 parada por interés seleccionado (excepto nocturna y fútbol)
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

  // FIX 4 — Parada nocturna post-partido con validación de horario y apertura
  if ((opts.reservedMins ?? 0) > 0 && hasNocturna) {
    for (const place of nocturnaPool) {
      if (usedNames.has(place.nombre)) continue;
      const estArrival = addMinutes(startTime, totalTime + TRANSIT);
      if (!isPlaceOpen(place, estArrival, selectedDayOfWeek)) continue;
      selected.push(place);
      break;
    }
  }

  if (selected.length === 0 && mainPool.length > 0) selected.push(mainPool[0]);

  // ── Ordenar por proximidad + reparar gastro consecutiva ──────────────────────
  const nocturnaFinal = selected.filter(p => isNocturnaForPool(p));
  const dayStops = selected.filter(p => !nocturnaFinal.includes(p));
  // Cafeterías mañaneras deben llegar antes de las 13:00 — fijarlas al frente
  // antes del reordenamiento geográfico para que revalidateSlots no las descarte.
  const morningCafes = (hasCafeterias && startHour < 13)
    ? dayStops.filter(p => matchesInterest(p.categoria, 'cafeterias'))
    : [];
  const unpinned = dayStops.filter(p => !morningCafes.includes(p));
  const sortedDay = repairConsecutiveGastro([...morningCafes, ...sortByProximity(unpinned)]);

  // FIX 2 — Revalidar reglas de slot tras el reordenamiento geográfico
  const revalidated = revalidateSlots(sortedDay, startTime, {
    hasCafeterias,
    isMatchDay,
    startHour,
    dayOfWeek: selectedDayOfWeek,
  });

  // ── Inyección de postre (solo con duration + gastronomia) ────────────────────
  if (postrePool.length > 0) {
    let simMins = 0;
    let lastComidaIdx = -1;
    for (let i = 0; i < revalidated.length; i++) {
      const arrivalTime = addMinutes(startTime, simMins);
      if (matchesInterest(revalidated[i].categoria, 'gastronomia') && getMealContext(arrivalTime) === 'comida') {
        lastComidaIdx = i;
      }
      simMins += revalidated[i].tiempoEstancia + (i < revalidated.length - 1 ? TRANSIT : 0);
    }
    if (lastComidaIdx >= 0) {
      const refPlace = revalidated[lastComidaIdx];
      let bestPostre: Place | null = null;
      let bestDist = Infinity;
      for (const p of postrePool) {
        if (usedNames.has(p.nombre)) continue; // FIX 5 — no duplicar postre ya seleccionado
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
}

export function pickAddStop(
  allPlaces: Place[],
  currentPlaces: Place[],
  opts: ActionOptions
): Place | null {
  const { interests, budget, selectedDate, startTime, seed = dailySeed() } = opts;
  const dayOfWeek = getDayOfWeek(selectedDate);
  const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

  const regular = currentPlaces.filter(p => !p.isMatch && !p.isCamino);
  const usedNames = new Set(currentPlaces.map(p => p.nombre));

  // Estimar hora de llegada para la nueva parada (al final de las regulares)
  const totalTime = regular.reduce((sum, p, i) => sum + p.tiempoEstancia + (i > 0 ? 30 : 0), 0);
  const estArrival = addMinutes(startTime, totalTime + (regular.length > 0 ? 30 : 0));
  const arrMins = toMins(estArrival);

  // Calcular fin del último gastro entre las paradas actuales
  const schedule = buildSchedule(regular, startTime);
  let lastGastroEndMins = -(150 + 1);
  for (let i = 0; i < regular.length; i++) {
    if (matchesInterest(regular[i].categoria, 'gastronomia')) {
      lastGastroEndMins = toMins(schedule[i].horaSalida);
    }
  }
  const lastRegular = regular[regular.length - 1];

  const candidates = seededShuffle(
    allPlaces.filter(p => {
      if (usedNames.has(p.nombre)) return false;
      if (BLACKLIST.some(bl => norm(p.nombre).includes(bl))) return false;
      if (!interests.some(int => matchesInterest(p.categoria, int))) return false;
      if (parseCostMin(p.costo) > 0 && parseCostMin(p.costo) > budget) return false;
      if (!isPlaceOpen(p, estArrival, dayOfWeek)) return false;
      if (matchesInterest(p.categoria, 'gastronomia')) {
        if (arrMins - lastGastroEndMins < 150) return false;
        if (lastRegular && matchesInterest(lastRegular.categoria, 'gastronomia')) return false;
      }
      return true;
    }),
    seed
  );

  return candidates[0] ?? null;
}

export function pickReplaceStop(
  allPlaces: Place[],
  currentPlaces: Place[],
  stopIndex: number,
  opts: ActionOptions
): Place | null {
  const { interests, budget, selectedDate, startTime, seed = dailySeed() } = opts;
  const dayOfWeek = getDayOfWeek(selectedDate);
  const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

  const current = currentPlaces[stopIndex];
  if (!current) return null;

  const usedNames = new Set(currentPlaces.map(p => p.nombre));
  usedNames.delete(current.nombre);

  const schedule = buildSchedule(currentPlaces, startTime);
  const estArrival = schedule[stopIndex]?.horaLlegada ?? startTime;
  const arrMins = toMins(estArrival);

  const matchingInterest = interests.find(int => matchesInterest(current.categoria, int)) ?? interests[0];
  const prevPlace = stopIndex > 0 ? currentPlaces[stopIndex - 1] : null;
  const nextPlace = stopIndex < currentPlaces.length - 1 ? currentPlaces[stopIndex + 1] : null;

  let lastGastroEndMins = -(150 + 1);
  for (let i = 0; i < stopIndex; i++) {
    if (matchesInterest(currentPlaces[i].categoria, 'gastronomia')) {
      lastGastroEndMins = toMins(schedule[i].horaSalida);
    }
  }

  const candidates = seededShuffle(
    allPlaces.filter(p => {
      if (usedNames.has(p.nombre)) return false;
      if (BLACKLIST.some(bl => norm(p.nombre).includes(bl))) return false;
      if (!matchesInterest(p.categoria, matchingInterest)) return false;
      if (parseCostMin(p.costo) > 0 && parseCostMin(p.costo) > budget) return false;
      if (!isPlaceOpen(p, estArrival, dayOfWeek)) return false;
      if (matchesInterest(p.categoria, 'gastronomia')) {
        if (arrMins - lastGastroEndMins < 150) return false;
        if (prevPlace && matchesInterest(prevPlace.categoria, 'gastronomia')) return false;
        if (nextPlace && matchesInterest(nextPlace.categoria, 'gastronomia')) return false;
      }
      return true;
    }),
    seed
  );

  return candidates[0] ?? null;
}
