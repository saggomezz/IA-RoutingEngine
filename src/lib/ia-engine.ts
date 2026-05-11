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

export const BLACKLIST = ['glorieta de la minerva', 'julieta venegas', 'sebastian yatra', 'akron'];

export const MATCH_DAYS: Record<string, { partido: string; equipos: string; hora: string }> = {
  '2026-06-11': { partido: 'Grupo A · Estadio Akron', equipos: 'Corea del Sur vs. Chequia',    hora: '20:00' },
  '2026-06-18': { partido: 'Grupo A · Estadio Akron', equipos: 'México vs. Corea del Sur',      hora: '19:00' },
  '2026-06-23': { partido: 'Grupo K · Estadio Akron', equipos: 'Colombia vs. RD Congo',         hora: '20:00' },
  '2026-06-26': { partido: 'Grupo H · Estadio Akron', equipos: 'Uruguay vs. España',            hora: '18:00' },
};

export const INTEREST_MAP: Record<string, string[]> = {
  futbol:          ['futbol'],
  gastronomia:     ['gastronomia', 'mexicana', 'postre', 'vegana', 'comida calle', 'cafeteria'],
  'vida-nocturna': ['nocturna', 'bar', 'cantina'],
  cultura:         ['cultura', 'museos', 'arte e historia', 'arquitectura'],
  compras:         ['compras'],
  naturaleza:      ['naturaleza', 'parque', 'verde'],
  aventura:        ['aventura'],
  fotografia:      ['fotografia', 'mirador', 'vista'],
  arquitectura:    ['arquitectura', 'historico', 'patrimonio'],
  musica:          ['musica', 'concierto'],
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

export function sortByProximity(places: Place[]): Place[] {
  if (places.length <= 2) return places;
  const remaining = [...places];
  const result: Place[] = [remaining.splice(0, 1)[0]];
  while (remaining.length > 0) {
    const last = result[result.length - 1];
    if (last.lat == null || last.lng == null) { result.push(remaining.splice(0, 1)[0]); continue; }
    let minDist = Infinity, minIdx = 0;
    remaining.forEach((p, i) => {
      if (p.lat != null && p.lng != null) {
        const d = haversine(last.lat!, last.lng!, p.lat, p.lng);
        if (d < minDist) { minDist = d; minIdx = i; }
      }
    });
    result.push(remaining.splice(minIdx, 1)[0]);
  }
  return result;
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

export interface GenerateOptions {
  interests: string[];
  ritmo: Ritmo;
  startTime: string;
  budget: number;
  selectedDate: string;
  seed?: number;
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

  let filtered = places.filter(p =>
    !BLACKLIST.some(bl => norm(p.nombre).includes(bl)) &&
    interests.some(interest => matchesInterest(p.categoria, interest)) &&
    (parseCostMin(p.costo) === 0 || parseCostMin(p.costo) <= budget)
  );

  // Fallback: si hay muy pocos lugares (<3) y el usuario no eligió explícitamente budget=0, relajar filtro
  if (filtered.length < 3 && budget > 0) {
    const sinPresupuesto = places.filter(p =>
      !BLACKLIST.some(bl => norm(p.nombre).includes(bl)) &&
      interests.some(interest => matchesInterest(p.categoria, interest))
    );
    if (sinPresupuesto.length > filtered.length) filtered = sinPresupuesto;
  }

  if (filtered.length === 0) return [];

  const ritmoMult = ritmo === 'tranquilo' ? 1.3 : ritmo === 'activo' ? 0.8 : 1;
  const adjusted = filtered.map(p => ({ ...p, tiempoEstancia: Math.round(p.tiempoEstancia * ritmoMult) }));

  const maxPlaces = ritmo === 'tranquilo' ? 3 : ritmo === 'normal' ? 4 : 5;
  // maxGastro escala con el ritmo: tranquilo=1, normal=2, activo=2
  const maxGastro = ritmo === 'tranquilo' ? 1 : 2;
  const mealCtx = getMealContext(startTime);
  const hasGastro = interests.some(int => ['gastronomia', 'cafeterias'].includes(int));
  const hasNocturna = interests.includes('vida-nocturna');

  const gastroPool = adjusted
    .filter(p => matchesInterest(p.categoria, 'gastronomia'))
    .sort((a, b) => mealScore(b, mealCtx) - mealScore(a, mealCtx));

  const nocturnaPool = seededShuffle(
    adjusted.filter(p => matchesInterest(p.categoria, 'vida-nocturna') && !matchesInterest(p.categoria, 'gastronomia')),
    seed
  );

  const othersPool = seededShuffle(
    adjusted.filter(p => !matchesInterest(p.categoria, 'gastronomia') && !matchesInterest(p.categoria, 'vida-nocturna')),
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

  const selected: Place[] = [];
  let totalTime = 0;
  let gastroCount = 0;
  let lastGastroEndMins = -MIN_GASTRO_GAP;
  const usedFoodTypes = new Set<string>();
  const usedNames = new Set<string>();
  const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

  for (const place of mainPool) {
    if (selected.length >= maxPlaces) break;
    if (usedNames.has(place.nombre)) continue;
    const isGastro = matchesInterest(place.categoria, 'gastronomia');
    const isNocturna = matchesInterest(place.categoria, 'vida-nocturna');
    const estArrival = addMinutes(startTime, totalTime + (selected.length > 0 ? TRANSIT : 0));
    const arrHour = parseInt(estArrival.split(':')[0]);
    const arrMins = toMins(estArrival);

    if (!isPlaceOpen(place, estArrival, selectedDayOfWeek)) continue;
    if (isGastro && hasNocturna && arrHour >= 20) continue;
    if (isNocturna && hasNocturna && arrHour < 20) continue;

    // Cafeterías: slot forzado según hora de inicio del itinerario
    const isCafe = matchesInterest(place.categoria, 'cafeterias');
    if (isCafe && hasCafeterias) {
      if (startHour < 13) {
        // Itinerario matutino → cafetería estrictamente en la mañana
        if (arrHour >= 13) continue;
      } else {
        // Itinerario vespertino → sin cafetería en días de partido; después de 18:00 en días normales
        if (isMatchDay) continue;
        if (arrHour < 18) continue;
      }
    }

    // Plazas comerciales (Compras) → nunca antes de las 11:00
    const isCompras = norm(place.categoria).includes('compras');
    if (isCompras && arrHour < 11) continue;

    if (isGastro) {
      if (gastroCount >= maxGastro) continue;
      if (arrMins - lastGastroEndMins < MIN_GASTRO_GAP) continue;
      const foodType = getFoodType(place);
      if (usedFoodTypes.has(foodType)) continue;
      usedFoodTypes.add(foodType);
      gastroCount++;
    }

    selected.push(place);
    usedNames.add(place.nombre);
    totalTime += place.tiempoEstancia + (selected.length > 1 ? TRANSIT : 0);
    if (isGastro) lastGastroEndMins = arrMins + place.tiempoEstancia;
  }

  // Nocturna al final si aplica
  if (hasNocturna && !selected.find(p => matchesInterest(p.categoria, 'vida-nocturna') && !matchesInterest(p.categoria, 'gastronomia'))) {
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

  // Ordenar por proximidad y reparar gastro consecutiva
  const nocturnaFinal = selected.filter(p =>
    matchesInterest(p.categoria, 'vida-nocturna') && !matchesInterest(p.categoria, 'gastronomia')
  );
  const dayStops = selected.filter(p => !nocturnaFinal.includes(p));
  return [...repairConsecutiveGastro(sortByProximity(dayStops)), ...nocturnaFinal];
}
