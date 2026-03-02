import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

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

export async function GET() {
  try {
    const csvPath = join(process.cwd(), 'datosLugares.csv');
    const csvText = readFileSync(csvPath, 'utf-8');
    const lines = csvText.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0]);
    const places = lines.slice(1).map(line => {
      const values = parseCSVLine(line);
      const place: Record<string, string> = {};
      headers.forEach((h, i) => { place[h] = values[i] || ''; });
      return place;
    }).filter(p => p['Nombre del Lugar']);
    return NextResponse.json(places);
  } catch (error) {
    console.error('Error reading CSV:', error);
    return NextResponse.json([], { status: 500 });
  }
}
