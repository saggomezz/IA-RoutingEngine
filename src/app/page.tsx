"use client";
import { useState } from "react";

// ---- Types ----
interface Place {
  nombre: string;
  categoria: string;
  direccion: string;
  tiempoEstancia: number;
  costo: string;
  calificacion: string;
  nota: string;
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

function buildSchedule(places: Place[], startTime: string): Stop[] {
  let current = startTime;
  return places.map((place, i) => {
    const horaLlegada = current;
    const mins = place.tiempoEstancia || 60;
    const horaSalida = addMinutes(current, mins);
    current = addMinutes(horaSalida, 15);
    return {
      place,
      horaLlegada,
      horaSalida,
      traslado: i < places.length - 1 ? '~15 min en tráfico' : '',
    };
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
  const [isGenerating, setGenerating] = useState(false);
  const [stops, setStops] = useState<Stop[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [meta, setMeta] = useState<ItineraryMeta>({ title: '', budget: '', groupSize: '', duration: '' });

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

      // Filtrar por intereses
      let filtered = places.filter(p =>
        selectedInterests.some(interest => matchesInterest(p.categoria, interest))
      );

      // Filtrar por presupuesto por persona
      filtered = filtered.filter(p => {
        const min = parseCostMin(p.costo);
        return min === 0 || min <= budget;
      });

      // Filtro de comida vegetariana
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

      // Tiempo máximo según duración seleccionada
      const targetMins = duration === 'rapido' ? 180 : duration === 'medio-dia' ? 360 : 600;

      // Mezclar aleatoriamente y seleccionar lugares que quepan en el tiempo
      const shuffled = [...filtered].sort(() => Math.random() - 0.5);
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

  // ---- FORM ----
  if (!showResults) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <nav className="bg-[#1A4D2E] shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
            <a href="http://69.30.204.56:3000" className="text-xl font-bold text-white hover:text-[#81C784] transition-colors">
              Pitzbol
            </a>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto p-4 md:p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black text-[#1A4D2E] tracking-tighter mb-2">
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
              <p className="text-[10px] font-bold text-[#1A4D2E] tracking-[0.2em] mb-4">
                Información básica
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#1A4D2E] tracking-[0.2em] mb-2">
                    Fecha de tu visita
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full p-3 border border-[#E0F2F1] rounded-xl text-sm focus:ring-2 focus:ring-[#0D601E]/20 focus:border-[#0D601E] transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#1A4D2E] tracking-[0.2em] mb-2">
                    Hora de inicio
                  </label>
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full p-3 border border-[#E0F2F1] rounded-xl text-sm focus:ring-2 focus:ring-[#0D601E]/20 focus:border-[#0D601E] transition-all"
                  >
                    {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'].map(t => (
                      <option key={t} value={t}>{formatTime12(t)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#1A4D2E] tracking-[0.2em] mb-2">
                    Duración del tour
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full p-3 border border-[#E0F2F1] rounded-xl text-sm focus:ring-2 focus:ring-[#0D601E]/20 focus:border-[#0D601E] transition-all"
                  >
                    <option value="rapido">Rápido (2–3 hrs)</option>
                    <option value="medio-dia">Medio día (4–6 hrs)</option>
                    <option value="dia-completo">Día completo (8–10 hrs)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#1A4D2E] tracking-[0.2em] mb-2">
                    Presupuesto: <span className="text-sm font-semibold">${budget} MXN</span>
                  </label>
                  <input
                    type="range" min="200" max="3000" step="100" value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#E0F2F1] rounded-lg appearance-none cursor-pointer accent-[#0D601E]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#1A4D2E] tracking-[0.2em] mb-2">
                    Tamaño del grupo: <span className="text-sm font-semibold">{groupSize} persona{groupSize > 1 ? 's' : ''}</span>
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
              <p className="text-[10px] font-bold text-[#1A4D2E] tracking-[0.2em] mb-4">
                Intereses
              </p>
              <div className="grid grid-cols-2 gap-3">
                {interestOptions.map((opt) => {
                  const isSelected = selectedInterests.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedInterests(prev =>
                        isSelected ? prev.filter(i => i !== opt.id) : [...prev, opt.id]
                      )}
                      className={`rounded-xl border transition-all duration-200 p-3 text-left text-xs font-medium
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

            {/* Tipo de comida */}
            <div>
              <p className="text-[10px] font-bold text-[#1A4D2E] tracking-[0.2em] mb-4">
                Tipo de comida
              </p>
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
                    <div className="font-medium text-xs mb-1">{pref.name}</div>
                    <div className="text-[10px] opacity-70">{pref.desc}</div>
                  </button>
                ))}
              </div>
            </div>

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
      <nav className="bg-[#1A4D2E] shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <a href="http://69.30.204.56:3000" className="text-xl font-bold text-white hover:text-[#81C784] transition-colors">
            Pitzbol
          </a>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto p-4 md:p-8">
        {/* Header de resultados */}
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
          {/* Cabecera del itinerario */}
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
              {/* Línea vertical del timeline */}
              <div className="absolute left-3 top-3 bottom-3 w-px bg-[#E0F2F1]" />

              <div className="space-y-4">
                {stops.map((stop, i) => (
                  <div key={i} className="relative pl-10">
                    {/* Número en el timeline */}
                    <div className="absolute left-0 top-2 w-6 h-6 rounded-full bg-[#1A4D2E] flex items-center justify-center shrink-0">
                      <span className="text-white text-[10px] font-bold">{i + 1}</span>
                    </div>

                    {/* Tarjeta del lugar */}
                    <div className="bg-[#fafafa] rounded-2xl p-4 border border-[#E0F2F1]">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Horario */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[#0D601E] font-bold text-sm">
                              {formatTime12(stop.horaLlegada)}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              → {formatTime12(stop.horaSalida)}
                            </span>
                          </div>

                          {/* Nombre */}
                          <h3 className="font-bold text-[#1A4D2E] text-sm leading-snug">
                            {stop.place.nombre}
                          </h3>

                          {/* Dirección */}
                          <p className="text-xs text-gray-500 mt-0.5">
                            📍 {stop.place.direccion}
                          </p>

                          {/* Datos */}
                          <div className="flex flex-wrap gap-3 mt-2">
                            <span className="text-[11px] text-gray-500">
                              ⏱ {stop.place.tiempoEstancia} min de estancia
                            </span>
                            <span className="text-[11px] text-gray-500">
                              💰 {stop.place.costo}
                            </span>
                            {stop.place.calificacion && (
                              <span className="text-[11px] text-gray-500">
                                ⭐ {stop.place.calificacion}/5
                              </span>
                            )}
                          </div>

                          {/* Nota */}
                          {stop.place.nota && (
                            <p className="text-[11px] text-gray-400 mt-1.5 italic leading-snug">
                              {stop.place.nota}
                            </p>
                          )}
                        </div>

                        {/* Controles: subir / bajar / eliminar */}
                        <div className="flex flex-col gap-1 print:hidden shrink-0">
                          <button
                            onClick={() => moveUp(i)}
                            disabled={i === 0}
                            title="Subir"
                            className="w-7 h-7 rounded-lg bg-white border border-[#E0F2F1] text-[#1A4D2E] text-xs font-bold disabled:opacity-25 hover:bg-[#E0F2F1] transition-colors flex items-center justify-center"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveDown(i)}
                            disabled={i === stops.length - 1}
                            title="Bajar"
                            className="w-7 h-7 rounded-lg bg-white border border-[#E0F2F1] text-[#1A4D2E] text-xs font-bold disabled:opacity-25 hover:bg-[#E0F2F1] transition-colors flex items-center justify-center"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => removeStop(i)}
                            title="Eliminar"
                            className="w-7 h-7 rounded-lg bg-white border border-red-200 text-red-400 text-xs font-bold hover:bg-red-50 transition-colors flex items-center justify-center"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Tráfico al siguiente */}
                      {stop.traslado && (
                        <div className="mt-2 pt-2 border-t border-[#E0F2F1]">
                          <span className="text-[11px] text-[#0D601E] font-medium">
                            🚗 {stop.traslado} al siguiente lugar
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botón imprimir al final */}
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
