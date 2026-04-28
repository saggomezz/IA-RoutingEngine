import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, appendFileSync } from 'fs';
import { join } from 'path';

const BACKEND = process.env.BACKEND_INTERNAL_URL || 'https://api.pitzbol.me:8443';

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

async function fetchFotosMap(): Promise<Record<string, string[]>> {
  try {
    const res = await fetch(`${BACKEND}/api/lugares`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return {};
    const data = await res.json();
    const map: Record<string, string[]> = {};
    for (const lugar of (data.lugares || [])) {
      if (lugar.nombre && Array.isArray(lugar.fotos) && lugar.fotos.length > 0) {
        const key = normName(lugar.nombre);
        map[key] = lugar.fotos;
      }
    }
    return map;
  } catch {
    return {};
  }
}

// Strip city suffix ", guadalajara" (or similar) added in CSV names
function stripCity(name: string): string {
  return name.replace(/,\s*(guadalajara|zapopan|tlaquepaque|tonala)[^,]*$/i, '').trim();
}

export async function GET() {
  try {
    const csvPath = join(process.cwd(), 'datosLugares.csv');
    const csvText = readFileSync(csvPath, 'utf-8');
    const lines = csvText.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]);

    const fotosMap = await fetchFotosMap();

    const places = lines.slice(1).map(line => {
      const values = parseCSVLine(line);
      const place: Record<string, any> = {};
      headers.forEach((h, i) => { place[h] = values[i] || ''; });

      const nombre = place['Nombre del Lugar'] || '';
      // Try full name first, then without city suffix (e.g. "Estadio Akron, Guadalajara" → "Estadio Akron")
      const fotosBackend =
        fotosMap[normName(nombre)] ||
        fotosMap[normName(stripCity(nombre))] ||
        [];
      const fotoCsv = place['Imagen']?.trim();
      place['fotos'] = fotosBackend.length > 0 ? fotosBackend : (fotoCsv ? [fotoCsv] : []);

      return place;
    }).filter(p => p['Nombre del Lugar']);

    return NextResponse.json(places);
  } catch (error) {
    console.error('Error reading CSV:', error);
    return NextResponse.json([], { status: 500 });
  }
}

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
