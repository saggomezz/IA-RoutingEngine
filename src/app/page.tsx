"use client";
import { useState } from "react";

const MXN_TO_USD = 17.50; // Tipo de cambio MXN → USD

// ---- Types ----
interface Place {
  nombre: string;
  categoria: string;
  direccion: string;
  tiempoEstancia: number;
  costo: string;
  calificacion: string;
  nota: string;
  isMatch?: boolean;
}

interface Stop {
  place: Place;
  horaLlegada: string;
  horaSalida: string;
  traslado: string;
}

interface ItineraryMeta {
  title: string;
  budget: string;
  groupSize: string;
  duration: string;
}

// ---- Partidos en Guadalajara ----
const MATCH_DAYS: Record<string, { partido: string; equipos: string }> = {
  '2026-06-11': { partido: 'Partido 2 — Grupo A', equipos: 'Corea del Sur vs. Ganador Repechaje' },
  '2026-06-18': { partido: 'Partido 28 — Grupo A', equipos: 'México vs. Corea del Sur' },
  '2026-06-23': { partido: 'Partido 48 — Grupo K', equipos: 'Colombia vs. Ganador Repechaje' },
  '2026-06-26': { partido: 'Partido 66 — Grupo H', equipos: 'Uruguay vs. España' },
};

const ESTADIO_AKRON: Place = {
  nombre: 'Estadio Akron — Partido del Mundial',
  categoria: 'Fútbol',
  direccion: 'Cto. J.V.C. 2800, Zapopan, Jalisco',
  tiempoEstancia: 180,
  costo: '$400 – $2,500',
  calificacion: '5',
  nota: '⚽ Llega al menos 90 min antes del partido. Ten en cuenta el tráfico intenso en la zona y alrededores del estadio — considera transporte público o salir con mucha anticipación.',
  isMatch: true,
};

// ---- Helpers ----
function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchesInterest(categoria: string, interest: string): boolean {
  const cat = norm(categoria);
  const map: Record<string, string[]> = {
    futbol: ['futbol', 'deportes'],
    gastronomia: ['gastronomia', 'mexicana', 'comida', 'restaurante'],
    'vida-nocturna': ['nocturna', 'bar', 'cantina'],
    cultura: ['cultura', 'museo', 'teatro', 'historia'],
    compras: ['compras', 'comercial', 'eventos', 'tienda'],
    naturaleza: ['parque', 'naturaleza', 'verde', 'jardin'],
    aventura: ['aventura', 'deporte', 'extremo'],
    fotografia: ['mirador', 'vista', 'fotografia'],
    arquitectura: ['arquitectura', 'historico', 'patrimonio'],
    musica: ['musica', 'concierto', 'entretenimiento'],
    arte: ['arte', 'galeria'],
    mercados: ['mercado', 'tianguis', 'artesania'],
  };
  return (map[interest] || []).some(kw => cat.includes(kw));
}

function parseCostMin(costoStr: string): number {
  if (!costoStr || /gratis/i.test(costoStr)) return 0;
  const match = costoStr.replace(/[,. ]/g, '').match(/\$?(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

type MealContext = 'desayuno' | 'comida' | 'cena';

function getMealContext(time: string): MealContext {
  const hour = parseInt(time.split(':')[0]);
  if (hour < 12) return 'desayuno';
  if (hour < 17) return 'comida';
  return 'cena';
}

function mealScore(place: Place, meal: MealContext): number {
  const text = norm(`${place.nombre} ${place.nota} ${place.categoria}`);
  const keywords: Record<MealContext, string[]> = {
    desayuno: ['desayuno', 'cafe', 'cafeteria', 'brunch', 'pan', 'jugo', 'breakfast', 'torta'],
    comida: ['comida', 'birria', 'torta ahogada', 'pozole', 'taco', 'tacos', 'fonda', 'ahogada', 'mexicana', 'lonche'],
    cena: ['cena', 'cantina', 'nocturna', 'mariscos', 'coctel', 'restaurant'],
  };
  const penalize: Record<MealContext, string[]> = {
    desayuno: ['cena', 'nocturna', 'bar', 'cantina'],
    comida: [],
    cena: ['desayuno', 'cafe', 'brunch'],
  };
  let score = 0;
  for (const kw of keywords[meal]) if (text.includes(norm(kw))) score++;
  for (const kw of penalize[meal]) if (text.includes(norm(kw))) score--;
  return score;
}

function buildSchedule(places: Place[], startTime: string): Stop[] {
  let current = startTime;
  return places.map((place, i) => {
    const horaLlegada = current;
    const mins = place.tiempoEstancia || 60;
    const horaSalida = addMinutes(current, mins);
    const nextIsMatch = i < places.length - 1 && places[i + 1]?.isMatch;
    const transitMins = nextIsMatch ? 45 : 15;
    current = addMinutes(horaSalida, transitMins);
    const trasladoLabel = i < places.length - 1
      ? nextIsMatch
        ? '~45 min en tráfico hasta el estadio (se recomienda salir con tiempo extra)'
        : '~15 min en tráfico'
      : '';
    return { place, horaLlegada, horaSalida, traslado: trasladoLabel };
  });
}

// ---- Component ----
export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState('dia-completo');
  const [budget, setBudget] = useState(1500);
  const [groupSize, setGroupSize] = useState(2);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [foodPreference, setFoodPreference] = useState('');
  const [attendsMatch, setAttendsMatch] = useState<boolean | null>(null);
  const [isGenerating, setGenerating] = useState(false);
  const [stops, setStops] = useState<Stop[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [meta, setMeta] = useState<ItineraryMeta>({ title: '', budget: '', groupSize: '', duration: '' });

  const matchInfo = MATCH_DAYS[selectedDate] ?? null;

  const interestOptions = [
    { id: 'futbol', name: 'Fútbol' },
    { id: 'gastronomia', name: 'Gastronomía' },
    { id: 'vida-nocturna', name: 'Vida nocturna' },
    { id: 'cultura', name: 'Cultura' },
    { id: 'compras', name: 'Compras' },
    { id: 'naturaleza', name: 'Naturaleza' },
    { id: 'aventura', name: 'Aventura' },
    { id: 'fotografia', name: 'Fotografía' },
    { id: 'arquitectura', name: 'Arquitectura' },
    { id: 'musica', name: 'Música' },
    { id: 'arte', name: 'Arte e historia' },
    { id: 'mercados', name: 'Mercados locales' },
  ];

  const foodPreferences = [
    { id: 'tradicional', name: '100% tradicional', desc: 'Solo comida típica tapatía' },
    { id: 'mix', name: 'Variado', desc: 'Tradicional + internacional' },
    { id: 'internacional', name: 'Internacional', desc: 'Comida familiar/internacional' },
    { id: 'vegetariano', name: 'Vegetariano', desc: 'Opciones sin carne' },
  ];

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev => {
      const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
      if (!next.includes('gastronomia')) setFoodPreference('');
      return next;
    });
  };

  const generateItinerary = async () => {
    if (!selectedDate || selectedInterests.length === 0) {
      alert('Por favor selecciona una fecha e intereses');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/places');
      const raw: Record<string, string>[] = await res.json();

      const places: Place[] = raw.map(p => ({
        nombre: p['Nombre del Lugar'] || '',
        categoria: p['Categoria'] || '',
        direccion: p['Dirección'] || '',
        tiempoEstancia: parseInt(p['Tiempo de Estancia']) || 60,
        costo: p['Costo Estimado'] || 'No disponible',
        calificacion: p['Calificacion'] || '',
        nota: p['Nota para IA'] || '',
      })).filter(p => p.nombre);

      let filtered = places.filter(p =>
        selectedInterests.some(interest => matchesInterest(p.categoria, interest))
      );

      filtered = filtered.filter(p => {
        const min = parseCostMin(p.costo);
        return min === 0 || min <= budget;
      });

      if (foodPreference === 'vegetariano') {
        filtered = filtered.filter(p => {
          if (matchesInterest(p.categoria, 'gastronomia')) {
            return norm(p.nota).includes('vegeta') || norm(p.nota).includes('sano');
          }
          return true;
        });
      }

      if (filtered.length === 0) {
        alert('No encontramos lugares que coincidan con tu selección. Intenta con otras categorías o aumenta el presupuesto.');
        return;
      }

      // Si va al partido, reservar tiempo para el estadio (180 min + 45 transit)
      const matchReservedMins = attendsMatch ? 180 + 45 : 0;
      const targetMins = (duration === 'rapido' ? 180 : duration === 'medio-dia' ? 360 : 600) - matchReservedMins;

      // Priorizar lugares de gastronomía según el horario de inicio
      const mealContext = getMealContext(startTime);
      const gastro = filtered
        .filter(p => matchesInterest(p.categoria, 'gastronomia'))
        .sort((a, b) => mealScore(b, mealContext) - mealScore(a, mealContext));
      const others = filtered
        .filter(p => !matchesInterest(p.categoria, 'gastronomia'))
        .sort(() => Math.random() - 0.5);
      // Gastronomy best matches first, then shuffled other interests
      const shuffled = [...gastro, ...others];
      const selected: Place[] = [];
      let totalTime = 0;

      for (const place of shuffled) {
        const timeNeeded = place.tiempoEstancia + (selected.length > 0 ? 15 : 0);
        if (totalTime + timeNeeded <= targetMins) {
          selected.push(place);
          totalTime += timeNeeded;
        }
        if (selected.length >= 8) break;
      }

      if (selected.length === 0) selected.push(shuffled[0]);

      // Agregar estadio al final si asiste al partido
      if (attendsMatch) selected.push(ESTADIO_AKRON);

      const schedule = buildSchedule(selected, startTime);
      setStops(schedule);

      const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-MX', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });

      setMeta({
        title: `Itinerario ${dateLabel}`,
        budget: `$${budget} MXN por persona`,
        groupSize: `${groupSize} persona${groupSize > 1 ? 's' : ''}`,
        duration: duration === 'rapido' ? '2–3 hrs' : duration === 'medio-dia' ? '4–6 hrs' : '8–10 hrs',
      });
      setShowResults(true);
    } catch (error) {
      console.error(error);
      alert('Error al generar el itinerario. Inténtalo de nuevo.');
    } finally {
      setGenerating(false);
    }
  };

  const moveUp = (i: number) => {
    if (i === 0) return;
    const arr = [...stops];
    [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    setStops(buildSchedule(arr.map(s => s.place), startTime));
  };

  const moveDown = (i: number) => {
    if (i === stops.length - 1) return;
    const arr = [...stops];
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    setStops(buildSchedule(arr.map(s => s.place), startTime));
  };

  const removeStop = (i: number) => {
    const newPlaces = stops.filter((_, idx) => idx !== i).map(s => s.place);
    setStops(buildSchedule(newPlaces, startTime));
  };

  // Clases reutilizables
  const labelClass = "block text-sm font-semibold text-[#1A4D2E] mb-2";
  const sectionTitleClass = "text-sm font-semibold text-[#1A4D2E] mb-4";
  const inputClass = "w-full p-3 border border-[#E0F2F1] rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#0D601E]/20 focus:border-[#0D601E] transition-all bg-white";

  // ---- FORM ----
  if (!showResults) {
    return (
      <div className="min-h-screen bg-[#fafafa]">

        <div className="max-w-4xl mx-auto p-4 md:p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black text-[#1A4D2E] tracking-tighter mb-1">
              PitzBot<span className="text-[#E53935]">.</span>
            </h1>
            <p className="text-[#81C784] text-sm italic">IA de itinerarios Mundial 2026</p>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); generateItinerary(); }}
            className="max-w-md mx-auto bg-white p-8 rounded-3xl border border-[#E0F2F1] shadow-sm space-y-6"
          >
            {/* Información básica */}
            <div>
              <p className={sectionTitleClass}>Información básica</p>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Fecha de tu visita</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setAttendsMatch(null);
                    }}
                    min={new Date().toISOString().split('T')[0]}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Hora de inicio</label>
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={inputClass}
                  >
                    {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'].map(t => (
                      <option key={t} value={t}>{formatTime12(t)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Duración del tour</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className={inputClass}
                  >
                    <option value="rapido">Rápido (2–3 hrs)</option>
                    <option value="medio-dia">Medio día (4–6 hrs)</option>
                    <option value="dia-completo">Día completo (8–10 hrs)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 mt-4">
                <div>
                  <label className={labelClass}>
                    Presupuesto:{" "}
                    <span className="font-bold">${budget.toLocaleString('es-MX')} MXN</span>
                    <span className="text-gray-400 font-normal ml-2">
                      (~${Math.round(budget / MXN_TO_USD).toLocaleString('en-US')} USD)
                    </span>
                  </label>
                  <input
                    type="range" min="200" max="15000" step="100" value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#E0F2F1] rounded-lg appearance-none cursor-pointer accent-[#0D601E]"
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Tamaño del grupo: <span className="font-bold">{groupSize} persona{groupSize > 1 ? 's' : ''}</span>
                  </label>
                  <input
                    type="range" min="1" max="10" value={groupSize}
                    onChange={(e) => setGroupSize(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#E0F2F1] rounded-lg appearance-none cursor-pointer accent-[#0D601E]"
                  />
                </div>
              </div>
            </div>

            {/* Intereses */}
            <div>
              <p className={sectionTitleClass}>Intereses</p>
              <div className="grid grid-cols-2 gap-3">
                {interestOptions.map((opt) => {
                  const isSelected = selectedInterests.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleInterest(opt.id)}
                      className={`rounded-xl border transition-all duration-200 p-3 text-left text-sm font-medium
                        ${isSelected
                          ? 'border-transparent bg-[#1A4D2E] text-white shadow-md'
                          : 'border-[#E0F2F1] bg-white text-[#1A4D2E] hover:border-[#81C784] hover:shadow-sm'
                        }`}
                    >
                      {opt.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tipo de comida — solo si gastronomia está seleccionada */}
            {selectedInterests.includes('gastronomia') && (
              <div>
                <p className={sectionTitleClass}>Tipo de comida</p>
                <div className="grid grid-cols-2 gap-3">
                  {foodPreferences.map((pref) => (
                    <button
                      key={pref.id}
                      type="button"
                      onClick={() => setFoodPreference(foodPreference === pref.id ? '' : pref.id)}
                      className={`p-3 rounded-xl border transition-all duration-200 text-left
                        ${foodPreference === pref.id
                          ? 'border-[#0D601E] bg-[#0D601E] text-white'
                          : 'border-[#E0F2F1] bg-white text-[#1A4D2E] hover:border-[#81C784]'
                        }`}
                    >
                      <div className="font-medium text-sm mb-1">{pref.name}</div>
                      <div className="text-xs opacity-70">{pref.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sección partido — solo en días de partido */}
            {matchInfo && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-sm font-bold text-amber-800 mb-1">
                  ⚽ ¡Hay partido del Mundial este día!
                </p>
                <p className="text-sm text-amber-700 font-semibold">{matchInfo.equipos}</p>
                <p className="text-xs text-amber-600 mb-4">{matchInfo.partido} · Estadio Akron</p>

                <p className={`text-sm font-semibold text-[#1A4D2E] mb-3`}>¿Asistirás al partido?</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setAttendsMatch(true)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all
                      ${attendsMatch === true
                        ? 'bg-[#1A4D2E] text-white border-transparent'
                        : 'bg-white text-[#1A4D2E] border-[#E0F2F1] hover:border-[#81C784]'
                      }`}
                  >
                    Sí, asistiré
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendsMatch(false)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all
                      ${attendsMatch === false
                        ? 'bg-[#1A4D2E] text-white border-transparent'
                        : 'bg-white text-[#1A4D2E] border-[#E0F2F1] hover:border-[#81C784]'
                      }`}
                  >
                    No, solo turismo
                  </button>
                </div>
                {attendsMatch === true && (
                  <p className="text-xs text-amber-700 mt-3">
                    El Estadio Akron se incluirá en tu itinerario con tiempo de traslado estimado.
                  </p>
                )}
              </div>
            )}

            {/* Botón generar */}
            <button
              type="submit"
              disabled={isGenerating || selectedInterests.length === 0}
              className="w-full bg-gradient-to-r from-[#0D601E] to-[#1A4D2E] text-white py-4 px-8 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md transition-all duration-200"
            >
              {isGenerating ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Creando tu itinerario...</span>
                </div>
              ) : 'Generar itinerario'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ---- RESULTS ----
  return (
    <div className="min-h-screen bg-[#fafafa]">

      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6 print:hidden">
          <button
            onClick={() => setShowResults(false)}
            className="text-[#1A4D2E] text-sm font-medium hover:underline"
          >
            ← Modificar búsqueda
          </button>
          <button
            onClick={() => window.print()}
            className="bg-[#1A4D2E] text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-[#0D601E] transition-colors"
          >
            Imprimir
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-[#E0F2F1] shadow-sm p-6 md:p-8">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#1A4D2E] mb-3">{meta.title}</h2>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="bg-[#E0F2F1] text-[#1A4D2E] px-3 py-1 rounded-full">💰 {meta.budget}</span>
              <span className="bg-[#E0F2F1] text-[#1A4D2E] px-3 py-1 rounded-full">👥 {meta.groupSize}</span>
              <span className="bg-[#E0F2F1] text-[#1A4D2E] px-3 py-1 rounded-full">⏱ {meta.duration}</span>
              <span className="bg-[#E0F2F1] text-[#1A4D2E] px-3 py-1 rounded-full">{stops.length} lugares</span>
            </div>
          </div>

          {stops.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No hay paradas en el itinerario.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-3 bottom-3 w-px bg-[#E0F2F1]" />
              <div className="space-y-4">
                {stops.map((stop, i) => (
                  <div key={i} className="relative pl-10">
                    <div className={`absolute left-0 top-2 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${stop.place.isMatch ? 'bg-amber-500' : 'bg-[#1A4D2E]'}`}>
                      <span className="text-white text-[10px] font-bold">{i + 1}</span>
                    </div>

                    <div className={`rounded-2xl p-4 border ${stop.place.isMatch ? 'bg-amber-50 border-amber-200' : 'bg-[#fafafa] border-[#E0F2F1]'}`}>
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[#0D601E] font-bold text-sm">
                              {formatTime12(stop.horaLlegada)}
                            </span>
                            <span className="text-xs text-gray-400">
                              → {formatTime12(stop.horaSalida)}
                            </span>
                          </div>
                          <h3 className="font-bold text-[#1A4D2E] text-sm leading-snug">
                            {stop.place.nombre}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            📍 {stop.place.direccion}
                          </p>
                          <div className="flex flex-wrap gap-3 mt-2">
                            <span className="text-xs text-gray-500">⏱ {stop.place.tiempoEstancia} min</span>
                            <span className="text-xs text-gray-500">💰 {stop.place.costo}</span>
                            {stop.place.calificacion && (
                              <span className="text-xs text-gray-500">⭐ {stop.place.calificacion}/5</span>
                            )}
                          </div>
                          {stop.place.nota && (
                            <p className="text-xs text-gray-400 mt-1.5 italic leading-snug">
                              {stop.place.nota}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col gap-1 print:hidden shrink-0">
                          <button onClick={() => moveUp(i)} disabled={i === 0} title="Subir"
                            className="w-7 h-7 rounded-lg bg-white border border-[#E0F2F1] text-[#1A4D2E] text-xs font-bold disabled:opacity-25 hover:bg-[#E0F2F1] transition-colors flex items-center justify-center">
                            ↑
                          </button>
                          <button onClick={() => moveDown(i)} disabled={i === stops.length - 1} title="Bajar"
                            className="w-7 h-7 rounded-lg bg-white border border-[#E0F2F1] text-[#1A4D2E] text-xs font-bold disabled:opacity-25 hover:bg-[#E0F2F1] transition-colors flex items-center justify-center">
                            ↓
                          </button>
                          <button onClick={() => removeStop(i)} title="Eliminar"
                            className="w-7 h-7 rounded-lg bg-white border border-red-200 text-red-400 text-xs font-bold hover:bg-red-50 transition-colors flex items-center justify-center">
                            ✕
                          </button>
                        </div>
                      </div>

                      {stop.traslado && (
                        <div className="mt-2 pt-2 border-t border-[#E0F2F1]">
                          <span className={`text-xs font-medium ${stop.traslado.includes('estadio') ? 'text-amber-700' : 'text-[#0D601E]'}`}>
                            🚗 {stop.traslado}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-[#E0F2F1] flex justify-center print:hidden">
            <button
              onClick={() => window.print()}
              className="bg-gradient-to-r from-[#0D601E] to-[#1A4D2E] text-white px-8 py-3 rounded-xl font-bold text-sm hover:shadow-md transition-all"
            >
              Imprimir itinerario
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
