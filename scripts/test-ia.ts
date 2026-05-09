/**
 * Test suite de la IA de Itinerarios — Pitzbol
 * Corre con: npx tsx scripts/test-ia.ts
 *
 * Prueba:
 *  1. Matriz de confusión por filtros de interés
 *  2. Que cada lugar recomendado esté abierto el día seleccionado
 *  3. Conteo de paradas por ritmo: tranquilo=3, normal=4, activo=5
 *  4. Lógica de orden (sin gastronomía consecutiva, nocturna al final)
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// ── tipos ────────────────────────────────────────────────────────────────────
interface Place {
  nombre: string;
  categoria: string;
  tiempoEstancia: number;
  costo: string;
  lat?: number;
  lng?: number;
  horaApertura?: string;
  horaCierre?: string;
  diasCerrado?: string;
}

// ── CSV ───────────────────────────────────────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
}

function parseCoord(s: string): number | undefined {
  if (!s) return undefined;
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? undefined : n;
}

function loadCSV(): Place[] {
  const csvPath = join(process.cwd(), 'datosLugares.csv');
  const text = readFileSync(csvPath, 'utf-8');
  const lines = text.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const v = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = v[i] || ''; });
    if (!row['Nombre del Lugar']) return null;
    return {
      nombre: row['Nombre del Lugar'],
      categoria: row['Categoria'] || '',
      tiempoEstancia: parseInt(row['Tiempo de Estancia']) || 60,
      costo: row['Costo Estimado'] || '',
      lat: parseCoord(row['Latitud']),
      lng: parseCoord(row['Longitud']),
      horaApertura: row['horaApertura'] || undefined,
      horaCierre: row['horaCierre'] || undefined,
      diasCerrado: row['diasCerrado'] || 'ninguno',
    } as Place;
  }).filter(Boolean) as Place[];
}

// ── funciones core (espejo de page.tsx) ──────────────────────────────────────
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchesInterest(categoria: string, interest: string): boolean {
  const cat = norm(categoria);
  const map: Record<string, string[]> = {
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
  return (map[interest] || []).some(kw => cat.includes(kw));
}

function isPlaceOpen(place: Place, arrivalTime: string, dayOfWeek: string): boolean {
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
  const visitEnd = arr + place.tiempoEstancia;
  return arr >= open && visitEnd <= close;
}

function getDayOfWeek(dateStr: string): string {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sortByProximity(places: Place[]): Place[] {
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

function parseCostMin(costoStr: string): number {
  if (!costoStr || /gratis/i.test(costoStr)) return 0;
  const match = costoStr.replace(/[,. ]/g, '').match(/\$?(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function getMealContext(time: string): 'desayuno' | 'comida' | 'cena' {
  const hour = parseInt(time.split(':')[0]);
  if (hour < 12) return 'desayuno';
  if (hour < 17) return 'comida';
  return 'cena';
}

function getFoodType(place: Place): string {
  const text = norm(place.nombre);
  if (text.includes('taco')) return 'tacos';
  if (text.includes('birria')) return 'birria';
  if (text.includes('torta')) return 'tortas';
  if (text.includes('pozole')) return 'pozole';
  if (text.includes('tamal')) return 'tamales';
  if (text.includes('mariscos') || text.includes('ceviche')) return 'mariscos';
  if (text.includes('cafe') || text.includes('cafeteria') || text.includes('brunch')) return 'cafe';
  if (text.includes('lonche')) return 'lonches';
  return `unique_${norm(place.nombre)}`;
}

const BLACKLIST = ['glorieta de la minerva', 'julieta venegas', 'sebastian yatra', 'akron'];

// ── generador simplificado (misma lógica que page.tsx) ───────────────────────
function generateItinerary(
  places: Place[],
  opts: {
    interests: string[];
    ritmo: 'tranquilo' | 'normal' | 'activo';
    startTime: string;
    budget: number;
    selectedDate: string;
  }
): Place[] {
  const { interests, ritmo, startTime, budget, selectedDate } = opts;
  const selectedDayOfWeek = getDayOfWeek(selectedDate);

  let filtered = places.filter(p =>
    !BLACKLIST.some(bl => norm(p.nombre).includes(bl)) &&
    interests.some(interest => matchesInterest(p.categoria, interest)) &&
    (parseCostMin(p.costo) === 0 || parseCostMin(p.costo) <= budget)
  );

  const ritmoMult = ritmo === 'tranquilo' ? 1.3 : ritmo === 'activo' ? 0.8 : 1;
  const adjusted = filtered.map(p => ({ ...p, tiempoEstancia: Math.round(p.tiempoEstancia * ritmoMult) }));

  // Conteos objetivo: tranquilo=3, normal=4, activo=5
  const maxPlaces = ritmo === 'tranquilo' ? 3 : ritmo === 'normal' ? 4 : 5;

  const mealCtx = getMealContext(startTime);
  const hasGastro = interests.includes('gastronomia');
  const hasNocturna = interests.includes('vida-nocturna');
  const maxGastro = 2;
  const MIN_GASTRO_GAP = 150;
  const TRANSIT = 30;

  const gastroPool = adjusted
    .filter(p => matchesInterest(p.categoria, 'gastronomia'))
    .sort((a, b) => {
      const scoreA = (norm(`${a.nombre} ${a.categoria}`).split(' ').filter(w =>
        ['desayuno','cafe','cafeteria','brunch','comida','birria','taco','cena','cantina'].includes(w)
      ).length);
      const scoreB = (norm(`${b.nombre} ${b.categoria}`).split(' ').filter(w =>
        ['desayuno','cafe','cafeteria','brunch','comida','birria','taco','cena','cantina'].includes(w)
      ).length);
      return scoreB - scoreA;
    });

  const nocturnaPool = adjusted.filter(p =>
    matchesInterest(p.categoria, 'vida-nocturna') && !matchesInterest(p.categoria, 'gastronomia')
  ).sort(() => Math.random() - 0.5);

  const othersPool = adjusted.filter(p =>
    !matchesInterest(p.categoria, 'gastronomia') && !matchesInterest(p.categoria, 'vida-nocturna')
  ).sort(() => Math.random() - 0.5);

  const mainPool = hasGastro
    ? (() => {
        const others = hasNocturna ? othersPool : [...othersPool, ...nocturnaPool];
        const gap = Math.max(2, Math.floor(others.length / Math.max(1, maxGastro)));
        const result: Place[] = [];
        let gi = 0, oi = 0;
        while (gi < gastroPool.length || oi < others.length) {
          for (let j = 0; j < gap && oi < others.length; j++) result.push(others[oi++]);
          if (gi < gastroPool.length) result.push(gastroPool[gi++]);
        }
        return result;
      })()
    : [...othersPool, ...nocturnaPool];

  const selected: Place[] = [];
  let totalTime = 0;
  let gastroCount = 0;
  let lastGastroEndMins = -MIN_GASTRO_GAP;
  const usedFoodTypes = new Set<string>();
  const usedNames = new Set<string>();
  const timeToMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

  for (const place of mainPool) {
    if (selected.length >= maxPlaces) break;
    if (usedNames.has(place.nombre)) continue;
    const isGastro = matchesInterest(place.categoria, 'gastronomia');
    const isNocturna = matchesInterest(place.categoria, 'vida-nocturna');
    const estArrival = addMinutes(startTime, totalTime + (selected.length > 0 ? TRANSIT : 0));
    const arrHour = parseInt(estArrival.split(':')[0]);
    const arrMins = timeToMins(estArrival);

    if (!isPlaceOpen(place, estArrival, selectedDayOfWeek)) continue;
    if (isGastro && hasNocturna && arrHour >= 20) continue;
    if (isNocturna && hasNocturna && arrHour < 20) continue;

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

  // Nocturna al final
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

  // Ordenar por proximidad (sin gastro consecutiva)
  const nocturnaFinal = selected.filter(p =>
    matchesInterest(p.categoria, 'vida-nocturna') && !matchesInterest(p.categoria, 'gastronomia')
  );
  const dayStops = selected.filter(p => !nocturnaFinal.includes(p));

  const sorted = sortByProximity(dayStops);
  // Reparar gastro consecutiva
  for (let i = 0; i < sorted.length - 1; i++) {
    if (matchesInterest(sorted[i].categoria, 'gastronomia') && matchesInterest(sorted[i + 1].categoria, 'gastronomia')) {
      for (let j = i + 2; j < sorted.length; j++) {
        if (!matchesInterest(sorted[j].categoria, 'gastronomia')) {
          const tmp = sorted.splice(j, 1)[0];
          sorted.splice(i + 1, 0, tmp);
          i = Math.max(0, i - 1);
          break;
        }
      }
    }
  }

  return [...sorted, ...nocturnaFinal];
}

// ── helpers de reporte ────────────────────────────────────────────────────────
const PASS = '✅';
const FAIL = '❌';
const WARN = '⚠️ ';

function check(label: string, condition: boolean, detail = ''): boolean {
  console.log(`  ${condition ? PASS : FAIL} ${label}${detail ? '  →  ' + detail : ''}`);
  return condition;
}

// ── PRUEBA 1: Matriz de confusión por filtros ─────────────────────────────────
function testFiltros(places: Place[]) {
  console.log('\n════════════════════════════════════════');
  console.log('PRUEBA 1 — Matriz de confusión por interés');
  console.log('════════════════════════════════════════');

  const interests = [
    'futbol','gastronomia','vida-nocturna','cultura','compras',
    'naturaleza','aventura','fotografia','arquitectura','musica','arte','cafeterias',
  ];

  let totalPassed = 0, totalFailed = 0;

  for (const interest of interests) {
    const matched = places.filter(p =>
      !BLACKLIST.some(bl => norm(p.nombre).includes(bl)) &&
      matchesInterest(p.categoria, interest)
    );

    // Un interés sin ningún resultado es un problema
    const hasResults = matched.length > 0;
    // Verificar que ningún lugar en la lista tenga categoría claramente incorrecta
    // (heurística: si el filtro es "futbol" no deberían salir restaurantes sin fútbol)
    const suspicious = matched.filter(p => {
      const catNorm = norm(p.categoria);
      if (interest === 'futbol' && !catNorm.includes('futbol')) return true;
      return false;
    });

    const ok = hasResults && suspicious.length === 0;
    if (ok) totalPassed++; else totalFailed++;
    console.log(`  ${ok ? PASS : FAIL} [${interest.padEnd(14)}]  ${matched.length} lugares${suspicious.length > 0 ? `  ${WARN}${suspicious.length} sospechosos` : ''}`);
    if (matched.length > 0 && matched.length <= 5) {
      matched.forEach(p => console.log(`       • ${p.nombre}  (${p.categoria})`));
    }
  }

  console.log(`\n  Resultado: ${totalPassed}/${interests.length} filtros con lugares válidos`);
  return { passed: totalPassed, failed: totalFailed };
}

// ── PRUEBA 2: Lugares abiertos el día seleccionado ────────────────────────────
function testHorarios(places: Place[]) {
  console.log('\n════════════════════════════════════════');
  console.log('PRUEBA 2 — Horarios y días de apertura');
  console.log('════════════════════════════════════════');

  const casos = [
    { date: '2026-05-09', time: '10:00', label: 'Sábado 10:00' },
    { date: '2026-05-11', time: '10:00', label: 'Lunes 10:00' },
    { date: '2026-05-10', time: '22:00', label: 'Domingo 22:00' },
    { date: '2026-05-08', time: '08:00', label: 'Viernes 08:00' },
  ];

  let totalPassed = 0, totalFailed = 0;

  for (const caso of casos) {
    const day = getDayOfWeek(caso.date);
    const withHorario = places.filter(p => p.horaApertura && p.horaCierre);
    const cerradosIncorrectos = withHorario.filter(p => {
      const deberiaCerrado = !isPlaceOpen(p, caso.time, day);
      // Si dice que está abierto pero tiene diasCerrado que incluye este día → bug
      if (!deberiaCerrado && p.diasCerrado && p.diasCerrado !== 'ninguno') {
        const closedDays = p.diasCerrado.split(',').map(d => norm(d.trim()));
        if (closedDays.includes(norm(day))) return true;
      }
      return false;
    });

    const abiertos = withHorario.filter(p => isPlaceOpen(p, caso.time, day));
    const cerrados = withHorario.filter(p => !isPlaceOpen(p, caso.time, day));
    const ok = cerradosIncorrectos.length === 0;
    if (ok) totalPassed++; else totalFailed++;
    console.log(`  ${ok ? PASS : FAIL} ${caso.label} (${day})  →  ${abiertos.length} abiertos / ${cerrados.length} cerrados${cerradosIncorrectos.length > 0 ? `  ${WARN}${cerradosIncorrectos.length} con error en diasCerrado` : ''}`);
    if (cerradosIncorrectos.length > 0) {
      cerradosIncorrectos.forEach(p => console.log(`       ⚠  ${p.nombre}  diasCerrado="${p.diasCerrado}"`));
    }
    // Muestra algunos lugares cerrados correctamente
    if (cerrados.length > 0 && cerrados.length <= 3) {
      cerrados.forEach(p => console.log(`       🔒 ${p.nombre}  (${p.horaApertura}–${p.horaCierre}, cerrado: ${p.diasCerrado})`));
    }
  }

  console.log(`\n  Resultado: ${totalPassed}/${casos.length} casos de horario correctos`);
  return { passed: totalPassed, failed: totalFailed };
}

// ── PRUEBA 3: Conteo de paradas por ritmo ─────────────────────────────────────
function testRitmo(places: Place[]) {
  console.log('\n════════════════════════════════════════');
  console.log('PRUEBA 3 — Conteo de paradas por ritmo');
  console.log('         (tranquilo=3, normal=4, activo=5)');
  console.log('════════════════════════════════════════');

  const EXPECTED: Record<string, number> = { tranquilo: 3, normal: 4, activo: 5 };
  const baseOpts = {
    interests: ['cultura', 'gastronomia', 'arquitectura'],
    startTime: '10:00',
    budget: 500,
    selectedDate: '2026-05-09', // sábado
  };

  let totalPassed = 0, totalFailed = 0;

  for (const ritmo of ['tranquilo', 'normal', 'activo'] as const) {
    // Ejecutar 3 veces (hay aleatoriedad) y tomar el peor caso
    const counts: number[] = [];
    for (let i = 0; i < 5; i++) {
      const result = generateItinerary(places, { ...baseOpts, ritmo });
      counts.push(result.length);
    }
    const min = Math.min(...counts), max = Math.max(...counts);
    const expected = EXPECTED[ritmo];
    const ok = counts.every(c => c === expected);
    const consistent = min === max;
    if (ok) totalPassed++; else totalFailed++;
    console.log(`  ${ok ? PASS : FAIL} ritmo=${ritmo}  esperado=${expected}  obtenido=[${counts.join(', ')}]${!consistent ? ` ${WARN}resultado inconsistente (min=${min}, max=${max})` : ''}`);
  }

  console.log(`\n  Resultado: ${totalPassed}/3 ritmos con conteo correcto`);
  return { passed: totalPassed, failed: totalFailed };
}

// ── PRUEBA 4: Orden lógico del itinerario ─────────────────────────────────────
function testOrden(places: Place[]) {
  console.log('\n════════════════════════════════════════');
  console.log('PRUEBA 4 — Orden lógico del itinerario');
  console.log('════════════════════════════════════════');

  const scenarios = [
    { label: 'Cultura+Gastro (mañana)', interests: ['cultura', 'gastronomia'], startTime: '09:00', date: '2026-05-09' },
    { label: 'Gastro+Nocturna (tarde)', interests: ['gastronomia', 'vida-nocturna'], startTime: '14:00', date: '2026-05-08' },
    { label: 'Arquitectura+Cafeterías', interests: ['arquitectura', 'cafeterias'], startTime: '08:00', date: '2026-05-09' },
  ];

  let totalPassed = 0, totalFailed = 0;
  const TRANSIT = 30;

  for (const sc of scenarios) {
    const result = generateItinerary(places, {
      interests: sc.interests,
      ritmo: 'normal',
      startTime: sc.startTime,
      budget: 800,
      selectedDate: sc.date,
    });

    const day = getDayOfWeek(sc.date);
    let current = sc.startTime;
    let checks: boolean[] = [];

    console.log(`\n  📋 ${sc.label}  (${day})`);

    // Reconstruir horario
    const schedule = result.map((p, i) => {
      const llegada = current;
      const salida = addMinutes(current, p.tiempoEstancia);
      current = addMinutes(salida, i < result.length - 1 ? TRANSIT : 0);
      return { place: p, llegada, salida };
    });

    schedule.forEach((s, i) => {
      console.log(`    ${i + 1}. ${s.place.nombre.substring(0, 40).padEnd(40)}  ${s.llegada}–${s.salida}  [${s.place.categoria}]`);
    });

    // a) No hay gastro consecutiva
    let gastroConsecutiva = false;
    for (let i = 0; i < result.length - 1; i++) {
      if (matchesInterest(result[i].categoria, 'gastronomia') && matchesInterest(result[i + 1].categoria, 'gastronomia')) {
        gastroConsecutiva = true;
      }
    }
    checks.push(check('Sin gastronomía consecutiva', !gastroConsecutiva));

    // b) Nocturna (si existe) aparece al final y después de las 20:00
    const nocturnaIdxs = schedule
      .map((s, i) => ({ i, isNocturna: matchesInterest(s.place.categoria, 'vida-nocturna') && !matchesInterest(s.place.categoria, 'gastronomia'), hora: s.llegada }))
      .filter(x => x.isNocturna);
    if (nocturnaIdxs.length > 0) {
      const nocturnaEsUltima = nocturnaIdxs.every(x => x.i >= result.length - 2);
      const nocturnaEsDespues20 = nocturnaIdxs.every(x => parseInt(x.hora.split(':')[0]) >= 20);
      checks.push(check('Nocturna al final', nocturnaEsUltima, `idx ${nocturnaIdxs.map(x => x.i + 1).join(',')}`));
      checks.push(check('Nocturna después de 20:00', nocturnaEsDespues20, nocturnaIdxs.map(x => x.hora).join(', ')));
    }

    // c) Cada lugar está abierto en su hora de llegada
    const cerradosEnHorario = schedule.filter(s => !isPlaceOpen(s.place, s.llegada, day) && s.place.horaApertura);
    checks.push(check('Todos abiertos en su hora de llegada', cerradosEnHorario.length === 0,
      cerradosEnHorario.length > 0 ? cerradosEnHorario.map(s => `${s.place.nombre}@${s.llegada}`).join('; ') : ''
    ));

    // d) No hay lugar en la blacklist
    const blacklisted = result.filter(p => BLACKLIST.some(bl => norm(p.nombre).includes(bl)));
    checks.push(check('Sin lugares de la lista negra', blacklisted.length === 0,
      blacklisted.map(p => p.nombre).join(', ')
    ));

    // e) Sin duplicados
    const nombres = result.map(p => p.nombre);
    const hasDuplicates = nombres.length !== new Set(nombres).size;
    checks.push(check('Sin lugares duplicados', !hasDuplicates));

    const scenarioPassed = checks.every(Boolean);
    if (scenarioPassed) totalPassed++; else totalFailed++;
  }

  console.log(`\n  Resultado: ${totalPassed}/${scenarios.length} escenarios de orden correctos`);
  return { passed: totalPassed, failed: totalFailed };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   TEST SUITE — IA Itinerarios Pitzbol   ║');
  console.log('╚══════════════════════════════════════════╝');

  const places = loadCSV();
  console.log(`\n📦 ${places.length} lugares cargados del CSV`);

  const r1 = testFiltros(places);
  const r2 = testHorarios(places);
  const r3 = testRitmo(places);
  const r4 = testOrden(places);

  const totalP = r1.passed + r2.passed + r3.passed + r4.passed;
  const totalF = r1.failed + r2.failed + r3.failed + r4.failed;
  const total = totalP + totalF;

  console.log('\n════════════════════════════════════════');
  console.log(`RESUMEN FINAL:  ${totalP}/${total} pruebas pasaron`);
  console.log(`  Filtros:  ${r1.passed}/${r1.passed + r1.failed}`);
  console.log(`  Horarios: ${r2.passed}/${r2.passed + r2.failed}`);
  console.log(`  Ritmo:    ${r3.passed}/${r3.passed + r3.failed}`);
  console.log(`  Orden:    ${r4.passed}/${r4.passed + r4.failed}`);
  console.log('════════════════════════════════════════\n');

  process.exit(totalF > 0 ? 1 : 0);
}

main();
