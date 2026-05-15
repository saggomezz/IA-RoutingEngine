import { NextResponse } from 'next/server';
import {
  generateItinerary,
  buildSchedule,
  validateGenerateOptions,
  dailySeed,
  rawToPlace,
  type Place,
  type GenerateOptions,
} from '@/lib/ia-engine';

// GET — documentación del endpoint
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/itinerary',
    motor: 'hybrid-constraint-knn',
    descripcion: 'Genera un itinerario usando ia-engine.ts (constraint-based scheduling + KNN geográfico).',
    body: {
      interests:      'string[]  — categorías: cultura, gastronomia, cafeterias, etc.',
      budget:         'number    — presupuesto en MXN',
      selectedDate:   'string    — YYYY-MM-DD',
      startTime:      'string?   — HH:MM (default: "09:00")',
      ritmo:          'string?   — tranquilo | normal | activo (default: "normal")',
      duration:       'string?   — rapido | medio-dia | dia-completo (default: "dia-completo")',
      foodPreference: 'string?   — tradicional | vegetariano | nocturna',
      userLat:        'number?   — latitud del usuario (para modo a pie)',
      userLng:        'number?   — longitud del usuario',
      walkRadius:     'number?   — radio en km para modo a pie',
      reservedMins:   'number?   — minutos reservados (ej. partido: 240)',
    },
  });
}

// POST — genera el itinerario con el motor híbrido
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Cuerpo de petición inválido o vacío' }, { status: 400 });
    }

    // Construir GenerateOptions con defaults para campos opcionales
    const opts: GenerateOptions = {
      interests:      body.interests     ?? [],
      ritmo:          body.ritmo         ?? 'normal',
      startTime:      body.startTime     ?? '09:00',
      budget:         Number(body.budget ?? 500),
      selectedDate:   body.selectedDate  ?? new Date().toISOString().slice(0, 10),
      seed:           body.seed          ?? dailySeed(),
      duration:       body.duration      ?? 'dia-completo',
      foodPreference: body.foodPreference,
      userLat:        body.userLat       != null ? Number(body.userLat) : undefined,
      userLng:        body.userLng       != null ? Number(body.userLng) : undefined,
      walkRadius:     body.walkRadius    != null ? Number(body.walkRadius) : undefined,
      reservedMins:   Number(body.reservedMins ?? 0),
    };

    const validationError = validateGenerateOptions(opts);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Cargar lugares desde /api/places (fusión Firebase + CSV)
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3003';

    const placesRes = await fetch(`${base}/api/places`, { cache: 'no-store' });
    if (!placesRes.ok) {
      return NextResponse.json(
        { error: 'No se pudo cargar el catálogo de lugares' },
        { status: 503 }
      );
    }

    const rawPlaces: Record<string, any>[] = await placesRes.json();
    const places: Place[] = rawPlaces
      .map(rawToPlace)
      .filter((p): p is Place => p !== null);

    if (places.length === 0) {
      return NextResponse.json({ error: 'Catálogo de lugares vacío' }, { status: 503 });
    }

    // Motor híbrido: constraint-based scheduling + KNN geográfico
    const result = generateItinerary(places, opts);

    if (result.length === 0) {
      return NextResponse.json({
        error: 'No encontramos lugares que coincidan con tu selección.',
        sugerencias: [
          'Amplía tu presupuesto',
          'Agrega más categorías de interés',
          'Cambia la hora de inicio',
        ],
      }, { status: 422 });
    }

    // Construir horario con llegadas y salidas reales
    const stops = buildSchedule(result, opts.startTime);

    return NextResponse.json({
      success: true,
      motor: 'hybrid-constraint-knn',
      generatedAt: new Date().toISOString(),
      opts: {
        interests:    opts.interests,
        ritmo:        opts.ritmo,
        startTime:    opts.startTime,
        budget:       opts.budget,
        selectedDate: opts.selectedDate,
        duration:     opts.duration,
      },
      totalParadas: result.length,
      stops,
    });

  } catch (error: any) {
    console.error('[/api/itinerary] Error en motor híbrido:', error?.message ?? error);
    return NextResponse.json(
      { error: 'Error interno del motor de itinerarios' },
      { status: 500 }
    );
  }
}
