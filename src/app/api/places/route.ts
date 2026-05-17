import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { adminDb } from '@/lib/firebaseAdmin';

const BACKEND = process.env.BACKEND_INTERNAL_URL || 'https://api.pitzbol.me:8443';

// ── CSV helpers ──────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function normName(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Carga los lugares eliminados desde Firebase (persiste en Vercel, a diferencia del filesystem)
async function loadDeletedPlaces(): Promise<Set<string>> {
  try {
    const snap = await adminDb.collection('lugares_eliminados').get();
    return new Set(snap.docs.map(d => normName(String(d.data().nombre || d.id))));
  } catch {
    return new Set();
  }
}

function stripCity(name: string): string {
  return name.replace(/,\s*(guadalajara|zapopan|tlaquepaque|tonala)[^,]*$/i, '').trim();
}

function parseCsvPlaces(): Record<string, any>[] {
  try {
    const csvPath = join(process.cwd(), 'datosLugares.csv');
    const csvText = readFileSync(csvPath, 'utf-8');
    const lines = csvText.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]);
    return lines.slice(1).map(line => {
      const values = parseCSVLine(line);
      const place: Record<string, any> = {};
      headers.forEach((h, i) => { place[h] = values[i] || ''; });
      return place;
    }).filter(p => p['Nombre del Lugar']);
  } catch {
    return [];
  }
}

// ── horariosJson ↔ horaApertura / horaCierre / diasCerrado ───────────────────

const DIAS_ORDER = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

// CSV flat hours → horariosJson (formato que entiende Firebase y el Frontend)
function csvHoursToHorariosJson(horaApertura: string, horaCierre: string, diasCerrado: string): string {
  const cerrados = diasCerrado === 'ninguno' || !diasCerrado
    ? []
    : diasCerrado.split(',').map(d => d.trim().toLowerCase());
  const h: Record<string, any> = {};
  for (const dia of DIAS_ORDER) {
    h[dia] = cerrados.includes(dia) ? 'cerrado' : { apertura: horaApertura, cierre: horaCierre };
  }
  return JSON.stringify(h);
}

// Persiste horarios en Firebase via backend (fire-and-forget: no bloquea la respuesta)
function writeHorariosToFirebase(nombre: string, horariosJson: string): void {
  fetch(`${BACKEND}/api/lugares/${encodeURIComponent(nombre)}/info`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ horariosJson }),
    signal: AbortSignal.timeout(4000),
  }).catch(() => {}); // intencionalmente sin await
}

function horariosToFields(horariosJson?: string): { horaApertura: string; horaCierre: string; diasCerrado: string } {
  if (!horariosJson) return { horaApertura: '', horaCierre: '', diasCerrado: 'ninguno' };
  try {
    const h = JSON.parse(horariosJson);
    const cerrados: string[] = [];
    let horaApertura = '';
    let horaCierre = '';

    for (const dia of DIAS_ORDER) {
      const val = h[dia];
      if (!val || val === 'cerrado') {
        cerrados.push(dia);
      } else {
        if (!horaApertura) horaApertura = val.apertura || '';
        // Keep the latest closing hour
        const c = val.cierre || '';
        if (!horaCierre || c > horaCierre) horaCierre = c;
      }
    }

    return {
      horaApertura,
      horaCierre,
      diasCerrado: cerrados.length === 7 ? 'ninguno' : (cerrados.length === 0 ? 'ninguno' : cerrados.join(',')),
    };
  } catch {
    return { horaApertura: '', horaCierre: '', diasCerrado: 'ninguno' };
  }
}

// ── Firebase fetch ────────────────────────────────────────────────────────────

async function fetchFirebasePlaces(): Promise<Map<string, Record<string, any>>> {
  try {
    const res = await fetch(`${BACKEND}/api/lugares`, { signal: AbortSignal.timeout(7000) });

    if (!res.ok) {
      console.warn(`[/api/places] Backend /api/lugares respondió ${res.status} — usando solo CSV`);
      return new Map();
    }

    const data = await res.json();

    // Acepta { lugares: [...] } (formato actual) y [...] (formato directo),
    // por si el backend cambia su estructura en el futuro.
    const lugares: unknown[] = Array.isArray(data?.lugares)
      ? data.lugares
      : Array.isArray(data)
      ? data
      : [];

    if (lugares.length === 0) {
      console.warn('[/api/places] Firebase devolvió 0 lugares — usando solo CSV');
    }

    const map = new Map<string, Record<string, any>>();

    for (const lugar of lugares) {
      if (!lugar || typeof lugar !== 'object') continue;
      const l = lugar as Record<string, any>;
      const nombre = String(l.nombre || '').trim();
      if (!nombre) continue;

      const { horaApertura, horaCierre, diasCerrado } = horariosToFields(l.horariosJson);

      const hasAdminCats = Array.isArray(l.categorias) && l.categorias.length > 0;
      const categoria = hasAdminCats
        ? l.categorias.join(', ')
        : (l.categoria || '');

      map.set(normName(nombre), {
        'Nombre del Lugar': nombre,
        'Categoria': categoria,
        '_adminCats': hasAdminCats,   // si true, el admin editó: no mezclar con CSV
        'Dirección': l.ubicacion || '',
        'Latitud': l.latitud || '',
        'Longitud': l.longitud || '',
        'Tiempo de Estancia': l.tiempoEstancia ? String(l.tiempoEstancia) : '60',
        'Costo Estimado': l.costoEstimado || '',
        'Imagen': '',
        'horaApertura': horaApertura,
        'horaCierre': horaCierre,
        'diasCerrado': diasCerrado,
        'fotos': Array.isArray(l.fotos) ? l.fotos : [],
      });
    }

    return map;
  } catch (err) {
    console.warn(
      '[/api/places] No se pudo obtener datos de Firebase — usando solo CSV.',
      err instanceof Error ? err.message : err
    );
    return new Map();
  }
}

// ── Cache en memoria para /api/places ────────────────────────────────────────
const PLACES_TTL = 5 * 60 * 1000; // 5 minutos
let placesCache: { data: any[] | null; expiresAt: number } = { data: null, expiresAt: 0 };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Servir desde caché si está vigente
    if (placesCache.data && placesCache.expiresAt > Date.now()) {
      return NextResponse.json(placesCache.data, {
        headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' },
      });
    }

    const deleted = await loadDeletedPlaces();

    // Firebase is primary source
    const firebaseMap = await fetchFirebasePlaces();

    // Remove deleted places from Firebase results
    for (const key of firebaseMap.keys()) {
      if (deleted.has(key)) firebaseMap.delete(key);
    }

    // CSV as fallback for places not yet in Firebase
    const csvPlaces = parseCsvPlaces();
    for (const csvPlace of csvPlaces) {
      const nombre = String(csvPlace['Nombre del Lugar'] || '').trim();
      const key = normName(nombre);
      const keyShort = normName(stripCity(nombre));

      // Skip deleted places from CSV too
      if (deleted.has(key) || deleted.has(keyShort)) continue;

      if (firebaseMap.has(key) || firebaseMap.has(keyShort)) {
        // Firebase has this place — enrich with CSV data
        const fbPlace = firebaseMap.get(key) || firebaseMap.get(keyShort)!;
        // Si el admin editó categorías en Firebase (_adminCats=true), son autoritativas.
        // Solo mezclar categorías del CSV cuando Firebase no tiene categorias[] explícitas.
        const csvCat = csvPlace['Categoria'] || '';
        if (csvCat && !fbPlace['_adminCats']) {
          const fbCat = fbPlace['Categoria'] || '';
          const parts = [...new Set([fbCat, csvCat].filter(Boolean))];
          fbPlace['Categoria'] = parts.join(', ');
        }
        if (!fbPlace['fotos']?.length && csvPlace['Imagen']) {
          fbPlace['fotos'] = [csvPlace['Imagen']];
        }
        // Enrich tiempoEstancia from CSV when Firebase has the default value
        if ((!fbPlace['Tiempo de Estancia'] || fbPlace['Tiempo de Estancia'] === '60') &&
            csvPlace['Tiempo de Estancia'] && csvPlace['Tiempo de Estancia'] !== '60') {
          fbPlace['Tiempo de Estancia'] = csvPlace['Tiempo de Estancia'];
        }
        // Fill missing coords from CSV
        if (!fbPlace['Latitud'] && csvPlace['Latitud']) fbPlace['Latitud'] = csvPlace['Latitud'];
        if (!fbPlace['Longitud'] && csvPlace['Longitud']) fbPlace['Longitud'] = csvPlace['Longitud'];
        if (!fbPlace['horaApertura'] && csvPlace['horaApertura'] && csvPlace['horaCierre']) {
          fbPlace['horaApertura'] = csvPlace['horaApertura'];
          fbPlace['horaCierre'] = csvPlace['horaCierre'];
          fbPlace['diasCerrado'] = csvPlace['diasCerrado'] || 'ninguno';
          // Write-through: persiste en Firebase para que el Frontend también lo vea
          writeHorariosToFirebase(
            fbPlace['Nombre del Lugar'],
            csvHoursToHorariosJson(csvPlace['horaApertura'], csvPlace['horaCierre'], csvPlace['diasCerrado'] || 'ninguno')
          );
        } else if (!fbPlace['diasCerrado'] || fbPlace['diasCerrado'] === 'ninguno') {
          fbPlace['diasCerrado'] = csvPlace['diasCerrado'] || 'ninguno';
        }
        continue;
      }

      // CSV-only place — use CSV image as foto array
      const fotoCsv = csvPlace['Imagen']?.trim();
      firebaseMap.set(key, {
        ...csvPlace,
        fotos: fotoCsv ? [fotoCsv] : [],
      });
    }

    // Limpiar campos internos antes de devolver
    const result = Array.from(firebaseMap.values()).map(p => {
      const { _adminCats, ...rest } = p as any;
      return rest;
    });

    // Guardar en caché
    placesCache = { data: result, expiresAt: Date.now() + PLACES_TTL };

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('Error building places list:', error);
    return NextResponse.json([], { status: 500 });
  }
}

// ── POST (append to CSV for new places created via datos-lugares) ─────────────

function escapeCsv(val: string): string {
  if (!val) return '';
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, categoria, latitud, longitud, horaApertura, horaCierre, diasCerrado, imagen, tiempoEstancia } = body;

    if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 });

    const diasArr: string[] = Array.isArray(diasCerrado) ? diasCerrado : [];
    const diasStr = diasArr.length > 0 ? diasArr.join(',') : 'ninguno';

    const row = [
      escapeCsv(nombre),
      escapeCsv(categoria || ''),
      '',
      latitud || '',
      longitud || '',
      tiempoEstancia || '60',
      '',
      escapeCsv(imagen || ''),
      horaApertura || '',
      horaCierre || '',
      escapeCsv(diasStr),
    ].join(',');

    const csvPath = join(process.cwd(), 'datosLugares.csv');
    appendFileSync(csvPath, '\n' + row, 'utf-8');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error writing CSV:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE ya no es necesario aquí — el Backend guarda en Firebase lugares_eliminados
// y el GET de arriba carga esa colección directamente vía adminDb
