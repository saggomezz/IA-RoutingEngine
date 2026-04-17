"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FaBookmark, FaRegBookmark } from 'react-icons/fa';
import AuthModal from '@/components/AuthModal';

const MXN_TO_USD = 17.50; // Tipo de cambio MXN → USD

// ---- Calendar helpers ----
function getLocalDateStr(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// ---- Types ----
interface Place {
  nombre: string;
  categoria: string;
  direccion: string;
  tiempoEstancia: number;
  costo: string;
  calificacion: string;
  nota: string;
  fotos: string[];
  lat?: number;
  lng?: number;
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
  fotos: [],
  isMatch: true,
};

// ---- Geo helpers ----
function parseCoord(s: string): number | null {
  if (!s) return null;
  // European decimal comma: "20,6817764" → 20.6817764
  const cleaned = s.replace(',', '.');
  // Reject clearly malformed values (more than one dot after cleanup)
  if ((cleaned.match(/\./g) || []).length > 1) return null;
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Nearest-neighbour sort so the route stays geographically compact
function sortByProximity(places: Place[]): Place[] {
  if (places.length <= 2) return places;
  const withCoords = places.filter(p => p.lat != null && p.lng != null);
  if (withCoords.length < 2) return places;
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

// Reparar dos gastros consecutivos tras el sort geográfico
function repairConsecutiveGastro(places: Place[]): Place[] {
  const arr = [...places];
  for (let i = 0; i < arr.length - 1; i++) {
    if (matchesInterest(arr[i].categoria, 'gastronomia') && matchesInterest(arr[i + 1].categoria, 'gastronomia')) {
      // Buscar el no-gastro más cercano para intercalar
      let swapIdx = -1;
      for (let j = i + 2; j < arr.length; j++) {
        if (!matchesInterest(arr[j].categoria, 'gastronomia')) { swapIdx = j; break; }
      }
      if (swapIdx >= 0) {
        const tmp = arr[swapIdx];
        arr.splice(swapIdx, 1);
        arr.splice(i + 1, 0, tmp);
        i = Math.max(0, i - 1); // re-check from previous position
      }
    }
  }
  return arr;
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
    futbol: ['futbol'],
    gastronomia: ['gastronomia', 'mexicana', 'postre', 'vegana', 'comida calle', 'cafeteria'],
    'vida-nocturna': ['nocturna', 'bar', 'cantina'],
    cultura: ['cultura', 'museos', 'arte e historia', 'arquitectura'],
    compras: ['compras'],
    naturaleza: ['naturaleza', 'parque', 'verde'],
    aventura: ['aventura'],
    fotografia: ['fotografia', 'mirador', 'vista'],
    arquitectura: ['arquitectura', 'historico', 'patrimonio'],
    musica: ['musica', 'concierto'],
    arte: ['arte e historia', 'arte'],
    mercados: ['mercados locales', 'mercado', 'tianguis'],
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

function getFoodType(place: Place): string {
  const text = norm(`${place.nombre} ${place.nota}`);
  if (text.includes('taco')) return 'tacos';
  if (text.includes('birria')) return 'birria';
  if (text.includes('torta')) return 'tortas';
  if (text.includes('pozole')) return 'pozole';
  if (text.includes('tamal')) return 'tamales';
  if (text.includes('mariscos') || text.includes('ceviche')) return 'mariscos';
  if (text.includes('cafe') || text.includes('cafeteria') || text.includes('brunch')) return 'cafe';
  if (text.includes('lonche')) return 'lonches';
  if (text.includes('sushi')) return 'sushi';
  return `unique_${norm(place.nombre)}`;
}

function buildSchedule(places: Place[], startTime: string, defaultTransit = 15): Stop[] {
  let current = startTime;
  return places.map((place, i) => {
    const horaLlegada = current;
    const mins = place.tiempoEstancia || 60;
    const horaSalida = addMinutes(current, mins);
    const nextIsMatch = i < places.length - 1 && places[i + 1]?.isMatch;
    const transitMins = nextIsMatch ? 45 : defaultTransit;
    current = addMinutes(horaSalida, transitMins);
    const trasladoLabel = i < places.length - 1
      ? nextIsMatch
        ? '~45 min en tráfico hasta el estadio (se recomienda salir con tiempo extra)'
        : `~${defaultTransit} min en tráfico`
      : '';
    return { place, horaLlegada, horaSalida, traslado: trasladoLabel };
  });
}

// ---- Component ----
export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fafafa] flex items-center justify-center text-[#1A4D2E] font-bold">Cargando...</div>}>
      <HomePageInner />
    </Suspense>
  );
}

const TRANSLATIONS = {
  es: {
    title: 'Generador de Itinerarios',
    subtitle: 'Planea tu día perfecto en Guadalajara',
    date: 'Fecha',
    startTime: 'Hora de inicio',
    duration: 'Duración del tour',
    fullDay: 'Día completo (~8 h)',
    halfDay: 'Medio día (~4 h)',
    budget: 'Presupuesto',
    group: 'Tamaño del grupo',
    interests: 'Intereses',
    matchDay: '⚽ Día de partido',
    matchQuestion: '¿Asistirás al partido?',
    yes: 'Sí, tengo boleto',
    no: 'No, solo explorar',
    generate: 'Generar itinerario',
    generating: 'Generando...',
    save: 'Guardar itinerario',
    saved: 'Guardado',
    download: 'Descargar PDF',
    addCalendar: 'Agregar al calendario',
    restart: 'Nuevo itinerario',
    people: 'personas',
    minInterests: 'Selecciona al menos 2 intereses',
    matchNote: '⚽ Llega al menos 90 min antes del partido. Ten en cuenta el tráfico intenso — considera transporte público.',
    worldCupMatch: '⚽ ¡Hay partido del Mundial este día!',
    arrival: 'Llegada',
    departure: 'Salida',
    transit: 'Traslado',
    cost: 'Costo',
    rating: 'Rating',
    stayTime: 'Estancia',
    minutes: 'min',
    hours: 'h',
    saveRequiresAccount: 'Guardar (requiere cuenta)',
  },
  en: {
    title: 'Itinerary Generator',
    subtitle: 'Plan your perfect day in Guadalajara',
    date: 'Date',
    startTime: 'Start time',
    duration: 'Tour duration',
    fullDay: 'Full day (~8 h)',
    halfDay: 'Half day (~4 h)',
    budget: 'Budget',
    group: 'Group size',
    interests: 'Interests',
    matchDay: '⚽ Match day',
    matchQuestion: 'Will you attend the match?',
    yes: 'Yes, I have a ticket',
    no: 'No, just exploring',
    generate: 'Generate itinerary',
    generating: 'Generating...',
    save: 'Save itinerary',
    saved: 'Saved',
    download: 'Download PDF',
    addCalendar: 'Add to calendar',
    restart: 'New itinerary',
    people: 'people',
    minInterests: 'Select at least 2 interests',
    matchNote: '⚽ Arrive at least 90 min before the match. Heavy traffic expected — consider public transport.',
    worldCupMatch: '⚽ There\'s a World Cup match today!',
    arrival: 'Arrival',
    departure: 'Departure',
    transit: 'Transit',
    cost: 'Cost',
    rating: 'Rating',
    stayTime: 'Stay',
    minutes: 'min',
    hours: 'h',
    saveRequiresAccount: 'Save (requires account)',
  },
};

function HomePageInner() {
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateStr());
  const [lang, setLang] = useState<'es' | 'en'>('es');
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
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [transitTime, setTransitTime] = useState(15);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('turista');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTrigger, setAuthTrigger] = useState<'save' | 'limit' | 'profile' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [savedItineraryId, setSavedItineraryId] = useState<string | null>(null);
  const [calAddedOk, setCalAddedOk] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarView, setCalendarView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const calendarRef = useRef<HTMLDivElement>(null);

  const searchParams = useSearchParams();

  const t = TRANSLATIONS[lang];

  useEffect(() => {
    const uid = searchParams.get('uid');
    const pendingSave = searchParams.get('pendingSave');
    const langParam = searchParams.get('lang');
    if (langParam === 'en' || langParam === 'es') setLang(langParam);

    const readRoleFromStorage = (uid: string) => {
      try {
        const stored = JSON.parse(localStorage.getItem('pitzbol_user') || '{}');
        if (stored.uid === uid) setUserRole(stored.role || 'turista');
      } catch {}
    };

    if (uid) {
      setUserId(uid);
      sessionStorage.setItem('pitzbol_uid', uid);
      readRoleFromStorage(uid);
      // Sincronizar localStorage en este dominio para que el navbar sepa que hay sesión
      try {
        const stored = JSON.parse(localStorage.getItem('pitzbol_user') || '{}');
        if (stored.uid !== uid) {
          localStorage.setItem('pitzbol_user', JSON.stringify({ uid, role: stored.role || 'turista' }));
          window.dispatchEvent(new Event('authStateChanged'));
        }
      } catch {}
      if (pendingSave === '1') {
        const raw = localStorage.getItem('pitzbol_pending_itinerary');
        if (raw) {
          const pending = JSON.parse(raw);
          fetch('/api/save-itinerary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, ...pending }),
          }).then(res => {
            if (res.ok) {
              localStorage.removeItem('pitzbol_pending_itinerary');
              const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
              window.location.replace(`${frontendUrl}/perfil`);
            }
          }).catch(console.error);
        }
      }
    } else {
      // Primero intentar sessionStorage (debe coincidir con localStorage)
      const savedUid = sessionStorage.getItem('pitzbol_uid');
      if (savedUid) {
        try {
          const stored = JSON.parse(localStorage.getItem('pitzbol_user') || '{}');
          if (stored.uid === savedUid) {
            setUserId(savedUid);
            setUserRole(stored.role || 'turista');
          } else {
            sessionStorage.removeItem('pitzbol_uid'); // uid obsoleto, limpiar
          }
        } catch {}
      } else {
        // Sin sessionStorage: leer localStorage directamente (registrado en este dominio)
        try {
          const stored = JSON.parse(localStorage.getItem('pitzbol_user') || '{}');
          if (stored.uid) {
            setUserId(stored.uid);
            setUserRole(stored.role || 'turista');
            sessionStorage.setItem('pitzbol_uid', stored.uid);
          }
        } catch {}
      }
    }
  }, [searchParams]);

  // Mostrar AuthModal desde el navbar (icono de perfil sin sesión)
  useEffect(() => {
    const handler = () => { setAuthTrigger('profile'); setShowAuthModal(true); };
    window.addEventListener('openAuthModal', handler);
    return () => window.removeEventListener('openAuthModal', handler);
  }, []);

  // Cerrar calendario al hacer click fuera
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

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
    { id: 'vegetariano', name: 'Vegana', desc: 'Opciones veganas' },
    { id: 'nocturna', name: 'Vida Nocturna', desc: 'Bares y restaurantes con ambiente' },
  ];

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev => {
      const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
      if (!next.includes('gastronomia')) setFoodPreference('');
      return next;
    });
  };

  const getEffectiveRole = (uid: string): string => {
    try {
      const stored = JSON.parse(localStorage.getItem('pitzbol_user') || '{}');
      if (stored.uid === uid) return stored.role || 'turista';
    } catch {}
    return userRole || 'turista';
  };

  const saveItinerary = async (overrideUid?: string) => {
    const uid = overrideUid || userId;
    if (!uid) return;
    const role = getEffectiveRole(uid);
    setIsSaving(true);
    try {
      const res = await fetch('/api/save-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          role,
          titulo: meta.title,
          fecha: selectedDate,
          meta: { budget, groupSize, duration: meta.duration },
          stops: stops.map(s => ({
            nombre: s.place.nombre,
            categoria: s.place.categoria,
            direccion: s.place.direccion,
            horaLlegada: s.horaLlegada,
            horaSalida: s.horaSalida,
            costo: s.place.costo,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 404 && !userId) {
          // Solo mostrar AuthModal si NO hay usuario logueado
          setAuthTrigger('save');
          setShowAuthModal(true);
          return;
        }
        throw new Error(data.error || 'Respuesta no exitosa');
      }
      const data = await res.json();
      setSavedItineraryId(data.id || null);
      setSavedOk(true);
      // También preparar URL del calendario
      prepareCalendarUrl();
    } catch (err: any) {
      console.error('Error al guardar:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const prepareCalendarUrl = () => {
    try {
      const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://pitzbol.me';
      const entry = {
        id: Date.now().toString(),
        fecha: selectedDate,
        meta,
        stops: stops.map(s => ({
          n: s.place.nombre,
          d: s.place.direccion,
          c: s.place.costo,
          m: s.place.isMatch || false,
          a: s.horaLlegada,
          z: s.horaSalida,
        })),
      };
      const hash = encodeURIComponent(JSON.stringify(entry));
      setCalendarUrl(`${frontendUrl}/calendario#${hash}`);
    } catch (err) {
      console.error('Error preparando calendario:', err);
    }
  };

  const unsaveItinerary = async () => {
    const uid = userId;
    if (!uid || !savedItineraryId) return;
    const role = getEffectiveRole(uid);
    try {
      const res = await fetch('/api/delete-itinerary', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, role, id: savedItineraryId }),
      });
      if (res.ok) {
        setSavedOk(false);
        setSavedItineraryId(null);
      }
    } catch (err) {
      console.error('Error al eliminar itinerario:', err);
    }
  };

  const addToCalendar = () => {
    prepareCalendarUrl();
    setCalAddedOk(true);
  };

  const handleAuthSuccess = (uid: string, _nombre: string) => {
    setUserId(uid);
    sessionStorage.setItem('pitzbol_uid', uid);
    try {
      const stored = JSON.parse(localStorage.getItem('pitzbol_user') || '{}');
      if (stored.uid === uid) setUserRole(stored.role || 'turista');
    } catch {}
    setShowAuthModal(false);
    if (authTrigger === 'save' && stops.length > 0) {
      saveItinerary(uid);
    }
    setAuthTrigger(null);
  };

  const generateItinerary = async () => {
    if (!selectedDate || selectedInterests.length < 2) {
      alert('Por favor selecciona una fecha y al menos 2 intereses para un itinerario más variado');
      return;
    }
    // Límite para invitados: 1 itinerario sin cuenta
    const guestCount = parseInt(sessionStorage.getItem('pitzbol_guest_count') || '0');
    if (!userId && guestCount >= 1) {
      setAuthTrigger('limit');
      setShowAuthModal(true);
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/places');
      const raw: Record<string, any>[] = await res.json();

      const places: Place[] = raw.map(p => ({
        nombre: p['Nombre del Lugar'] || '',
        categoria: p['Categoria'] || '',
        direccion: p['Dirección'] || '',
        tiempoEstancia: parseInt(p['Tiempo de Estancia']) || 60,
        costo: p['Costo Estimado'] || 'No disponible',
        calificacion: p['Calificacion'] || '',
        nota: p['Nota para IA'] || '',
        fotos: Array.isArray(p['fotos']) ? p['fotos'] : [],
        lat: parseCoord(p['Latitud']) ?? undefined,
        lng: parseCoord(p['Longitud']) ?? undefined,
      })).filter(p => p.nombre);

      // Excluir Estadio Akron del pool regular — se agrega solo si asiste al partido
      const AKRON_KEY = 'akron';
      let filtered = places.filter(p =>
        !norm(p.nombre).includes(AKRON_KEY) &&
        selectedInterests.some(interest => matchesInterest(p.categoria, interest))
      );

      filtered = filtered.filter(p => {
        const min = parseCostMin(p.costo);
        return min === 0 || min <= budget;
      });

      if (foodPreference === 'vegetariano') {
        filtered = filtered.filter(p => {
          if (matchesInterest(p.categoria, 'gastronomia')) {
            return norm(p.categoria).includes('vegana') ||
              norm(p.nota).includes('vegeta') || norm(p.nota).includes('sano');
          }
          return true;
        });
      }

      if (foodPreference === 'nocturna') {
        filtered = filtered.filter(p => {
          if (matchesInterest(p.categoria, 'gastronomia')) {
            return matchesInterest(p.categoria, 'vida-nocturna');
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

      // Priorizar gastronomía según horario; balancear con otros intereses
      const mealContext = getMealContext(startTime);
      const hasGastro = selectedInterests.includes('gastronomia');
      const hasNocturna = selectedInterests.includes('vida-nocturna');

      // Límite de lugares por duración: calidad > cantidad
      // rapido=2, medio-dia=3, dia-completo=4
      const maxPlaces = duration === 'rapido' ? 2 : duration === 'medio-dia' ? 3 : 4;

      const startHour = parseInt(startTime.split(':')[0]);

      // Max restaurantes según duración y hora de inicio
      const maxGastro = duration === 'rapido' ? 1
        : duration === 'medio-dia' ? 1
        : startHour < 11 ? 2 : 1;

      // Pool de postres (nieves / helados / dulces) — solo si usuario eligió gastronomía
      // Solo lugares cuya categoría PRINCIPAL es postre y no son restaurantes completos
      const postrePool = hasGastro
        ? places.filter(p =>
            !norm(p.nombre).includes(AKRON_KEY) &&
            norm(p.categoria).includes('postre') &&
            !matchesInterest(p.categoria, 'gastronomia')
          ).sort(() => Math.random() - 0.5)
        : [];

      const gastroPool = filtered
        .filter(p => matchesInterest(p.categoria, 'gastronomia'))
        .sort((a, b) => mealScore(b, mealContext) - mealScore(a, mealContext));

      const nocturnaPool = filtered
        .filter(p => matchesInterest(p.categoria, 'vida-nocturna') && !matchesInterest(p.categoria, 'gastronomia'))
        .sort(() => Math.random() - 0.5);

      const othersPool = filtered
        .filter(p => !matchesInterest(p.categoria, 'gastronomia') && !matchesInterest(p.categoria, 'vida-nocturna'))
        .sort(() => Math.random() - 0.5);

      const afterMatchPool = attendsMatch && hasNocturna ? nocturnaPool : [];

      // Intercalar gastro con otros para evitar dos restaurantes seguidos
      const buildInterleavedPool = (): Place[] => {
        const others = (attendsMatch && hasNocturna) ? othersPool : [...othersPool, ...nocturnaPool];
        if (gastroPool.length === 0) return others;
        const gap = others.length > 0 && maxGastro > 0 ? Math.max(2, Math.floor(others.length / maxGastro)) : 2;
        const result: Place[] = [];
        let gi = 0, oi = 0;
        while (gi < gastroPool.length || oi < others.length) {
          for (let j = 0; j < gap && oi < others.length; j++) result.push(others[oi++]);
          if (gi < gastroPool.length) result.push(gastroPool[gi++]);
        }
        return result;
      };

      const mainPool = buildInterleavedPool();

      const selected: Place[] = [];
      let totalTime = 0;
      let gastroCount = 0;
      let lastWasGastro = false;
      const usedFoodTypes = new Set<string>();

      for (const place of mainPool) {
        if (selected.length >= maxPlaces) break;
        const isGastro = matchesInterest(place.categoria, 'gastronomia');
        const isNocturna = matchesInterest(place.categoria, 'vida-nocturna');

        // Calcular hora estimada de llegada a este lugar
        const estimatedArrival = addMinutes(startTime, totalTime + (selected.length > 0 ? 15 : 0));
        const arrivalHour = parseInt(estimatedArrival.split(':')[0]);

        // Si hay vida nocturna: gastro solo antes de las 19:00; después solo nocturna
        if (isGastro && hasNocturna && arrivalHour >= 19) continue;
        // Si hay vida nocturna: no agregar nocturna antes de las 19:00 (reservar para la noche)
        if (isNocturna && hasNocturna && !attendsMatch && arrivalHour < 19) continue;

        // No dos gastro seguidos
        if (isGastro && lastWasGastro) continue;
        if (isGastro) {
          if (gastroCount >= maxGastro) continue;
          const foodType = getFoodType(place);
          if (usedFoodTypes.has(foodType)) continue;
          usedFoodTypes.add(foodType);
          gastroCount++;
        }
        const timeNeeded = place.tiempoEstancia + (selected.length > 0 ? 15 : 0);
        if (totalTime + timeNeeded <= targetMins) {
          selected.push(place);
          totalTime += timeNeeded;
          lastWasGastro = isGastro;
        }
      }

      if (selected.length === 0) selected.push(mainPool[0] ?? filtered[0]);

      // Estadio y 1 lugar nocturno post-partido máximo
      if (attendsMatch) selected.push(ESTADIO_AKRON);
      if (afterMatchPool.length > 0) selected.push(afterMatchPool[0]);

      // Ordenar por proximidad geográfica para una ruta compacta
      // (excluir el estadio del sorting si está al final)
      const matchStop = selected.find(p => p.isMatch);
      const afterMatchStops = selected.filter(p => !p.isMatch && attendsMatch && afterMatchPool.includes(p));
      const regularStops = selected.filter(p => !p.isMatch && !afterMatchStops.includes(p));

      // Separar nocturna para que SIEMPRE quede al final del itinerario diurno.
      // Si se mezcla con el sort geográfico, puede aparecer a las 11am siendo un bar.
      const nocturnaRegularStops = hasNocturna
        ? regularStops.filter(p =>
            matchesInterest(p.categoria, 'vida-nocturna') &&
            !matchesInterest(p.categoria, 'gastronomia')
          )
        : [];
      const dayRegularStops = regularStops.filter(p => !nocturnaRegularStops.includes(p));
      const sortedRegular = [
        ...repairConsecutiveGastro(sortByProximity(dayRegularStops)),
        ...nocturnaRegularStops,
      ];

      // Insertar postre DESPUÉS del sorting para respetar el orden final de la ruta
      // Busca el último gastro en horario de almuerzo (comida) en el array ya ordenado
      if (hasGastro && postrePool.length > 0) {
        let simMins = 0;
        let sortedLastGastroComidaIdx = -1;
        for (let i = 0; i < sortedRegular.length; i++) {
          const arrivalTime = addMinutes(startTime, simMins);
          if (matchesInterest(sortedRegular[i].categoria, 'gastronomia') && getMealContext(arrivalTime) === 'comida') {
            sortedLastGastroComidaIdx = i;
          }
          simMins += sortedRegular[i].tiempoEstancia + (i < sortedRegular.length - 1 ? 15 : 0);
        }
        if (sortedLastGastroComidaIdx >= 0) {
          const refPlace = sortedRegular[sortedLastGastroComidaIdx];
          let bestPostre: Place | null = null;
          let bestDist = Infinity;
          for (const p of postrePool) {
            if (refPlace.lat != null && refPlace.lng != null && p.lat != null && p.lng != null) {
              const d = haversine(refPlace.lat, refPlace.lng, p.lat, p.lng);
              if (d < bestDist) { bestDist = d; bestPostre = p; }
            } else if (!bestPostre) {
              bestPostre = p;
            }
          }
          // Postre se permite como stop extra solo si el total no supera maxPlaces + 1
          // (es una parada rápida de 15 min, no cuenta como lugar completo)
          if (bestPostre && sortedRegular.length <= maxPlaces) {
            sortedRegular.splice(sortedLastGastroComidaIdx + 1, 0, bestPostre);
          }
        }
      }

      const finalSelected = matchStop
        ? [...sortedRegular, matchStop, ...afterMatchStops]
        : sortedRegular;

      const transit = 15;
      setTransitTime(transit);
      setAllPlaces(filtered);

      const schedule = buildSchedule(finalSelected, startTime, transit);
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
      setSavedOk(false);
      setCalAddedOk(false);
      // Incrementar contador de invitado si no tiene cuenta
      if (!userId) {
        const prev = parseInt(sessionStorage.getItem('pitzbol_guest_count') || '0');
        sessionStorage.setItem('pitzbol_guest_count', String(prev + 1));
      }
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
    setStops(buildSchedule(arr.map(s => s.place), startTime, transitTime));
  };

  const moveDown = (i: number) => {
    if (i === stops.length - 1) return;
    const arr = [...stops];
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    setStops(buildSchedule(arr.map(s => s.place), startTime, transitTime));
  };

  const removeStop = (i: number) => {
    const newPlaces = stops.filter((_, idx) => idx !== i).map(s => s.place);
    setStops(buildSchedule(newPlaces, startTime, transitTime));
  };

  const replaceStop = (i: number) => {
    const current = stops[i].place;
    const usedNames = new Set(stops.map(s => s.place.nombre));
    const matchingInterest = selectedInterests.find(int => matchesInterest(current.categoria, int))
      || selectedInterests[0];
    const candidates = allPlaces.filter(p =>
      !usedNames.has(p.nombre) &&
      matchesInterest(p.categoria, matchingInterest)
    );
    if (candidates.length === 0) return;
    const newPlace = candidates[Math.floor(Math.random() * candidates.length)];
    const newPlaces = stops.map((s, idx) => idx === i ? newPlace : s.place);
    setStops(buildSchedule(newPlaces, startTime, transitTime));
  };

  // Clases reutilizables
  const labelClass = "block text-sm font-semibold text-[#1A4D2E] mb-2";
  const sectionTitleClass = "text-sm font-semibold text-[#1A4D2E] mb-4";
  const inputClass = "w-full p-3 border border-[#E0F2F1] rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#0D601E]/20 focus:border-[#0D601E] transition-all bg-white";

  // ---- FORM ----
  if (!showResults) {
    return (
      <div className="min-h-screen bg-[#fafafa]">

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />

        <div className="max-w-4xl mx-auto p-4 md:p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-black text-[#1A4D2E] tracking-tight mb-1">
              IA de Itinerarios
            </h1>
            <p className="text-[#769C7B] text-xs">
              Powered by <span className="font-semibold text-[#1A4D2E]">PitzBot</span>
              <span className="mx-2">·</span>Mundial 2026 · Guadalajara
            </p>
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
                  <div className="relative" ref={calendarRef}>
                    {/* Trigger */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!calendarOpen) {
                          const parts = selectedDate.split('-').map(Number);
                          if (parts[0]) setCalendarView({ year: parts[0], month: parts[1] - 1 });
                        }
                        setCalendarOpen(o => !o);
                      }}
                      className="w-full flex items-center gap-3 p-3 border-2 border-[#E0F2F1] rounded-xl text-sm bg-white hover:border-[#1A4D2E] transition-all cursor-pointer text-left"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#1A4D2E] shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                      <span className={selectedDate ? 'text-gray-900 capitalize' : 'text-gray-400'}>
                        {selectedDate
                          ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                          : 'Selecciona una fecha'}
                      </span>
                      {MATCH_DAYS[selectedDate] && <span className="ml-auto text-base">⚽</span>}
                    </button>

                    {/* Calendario desplegable */}
                    {calendarOpen && (
                      <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-[#E0F2F1] overflow-hidden w-full">
                        {/* Header verde */}
                        <div className="bg-[#1A4D2E] px-4 py-3 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setCalendarView(v => {
                              const d = new Date(v.year, v.month - 1);
                              return { year: d.getFullYear(), month: d.getMonth() };
                            })}
                            className="text-white/70 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
                          >◀</button>
                          <span className="text-white font-bold text-sm capitalize">
                            {new Date(calendarView.year, calendarView.month).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCalendarView(v => {
                              const d = new Date(v.year, v.month + 1);
                              return { year: d.getFullYear(), month: d.getMonth() };
                            })}
                            className="text-white/70 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
                          >▶</button>
                        </div>

                        {/* Días de la semana */}
                        <div className="grid grid-cols-7 bg-[#E0F2F1]">
                          {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'].map(d => (
                            <div key={d} className="text-center text-[10px] font-bold text-[#1A4D2E] py-2">{d}</div>
                          ))}
                        </div>

                        {/* Grid de días */}
                        <div className="grid grid-cols-7 p-2 gap-0.5">
                          {(() => {
                            const todayStr = getLocalDateStr();
                            const total = getDaysInMonth(calendarView.year, calendarView.month);
                            const first = getFirstDayOfWeek(calendarView.year, calendarView.month);
                            const cells = [];

                            for (let i = 0; i < first; i++) {
                              cells.push(<div key={`e${i}`} />);
                            }

                            for (let d = 1; d <= total; d++) {
                              const dateStr = `${calendarView.year}-${String(calendarView.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                              const past = dateStr < todayStr;
                              const sel = dateStr === selectedDate;
                              const today = dateStr === todayStr;
                              const match = dateStr in MATCH_DAYS;

                              cells.push(
                                <button
                                  key={d}
                                  type="button"
                                  disabled={past}
                                  onClick={() => {
                                    setSelectedDate(dateStr);
                                    setAttendsMatch(null);
                                    setCalendarOpen(false);
                                  }}
                                  className={[
                                    'relative flex flex-col items-center justify-end pb-1 rounded-xl text-xs font-medium h-11 transition-all',
                                    past ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer',
                                    sel ? 'bg-[#1A4D2E] text-white' : '',
                                    !sel && today ? 'border-2 border-[#81C784] text-[#1A4D2E] font-bold' : '',
                                    !sel && !today && !past ? 'hover:bg-[#E0F2F1] text-gray-700' : '',
                                    match && !sel ? 'text-[#1A4D2E] font-bold' : '',
                                  ].join(' ')}
                                >
                                  {match && (
                                    <span className="text-[10px] leading-none mb-0.5">{sel ? '⚽' : '⚽'}</span>
                                  )}
                                  <span>{d}</span>
                                </button>
                              );
                            }
                            return cells;
                          })()}
                        </div>

                        {/* Leyenda */}
                        <div className="px-4 pb-3 pt-1 flex items-center gap-4 text-[10px] text-gray-400 border-t border-[#E0F2F1]">
                          <span className="flex items-center gap-1">{t.matchDay}</span>
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full border-2 border-[#81C784] inline-block" />
                            Hoy
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>{t.startTime}</label>
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
                  <label className={labelClass}>{t.duration}</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className={inputClass}
                  >
                    <option value="rapido">{lang === 'en' ? 'Quick (2–3 hrs)' : 'Rápido (2–3 hrs)'}</option>
                    <option value="medio-dia">{lang === 'en' ? 'Half day (4–6 hrs)' : 'Medio día (4–6 hrs)'}</option>
                    <option value="dia-completo">{lang === 'en' ? 'Full day (8–10 hrs)' : 'Día completo (8–10 hrs)'}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 mt-4">
                <div>
                  <label className={labelClass}>
                    {t.budget}:{" "}
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
                    {t.group}: <span className="font-bold">{groupSize} {t.people}</span>
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
              <p className={sectionTitleClass}>{t.interests}</p>
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
              <p className={`mt-2 text-xs ${selectedInterests.length < 2 ? 'text-amber-600' : 'text-gray-400'}`}>
                {selectedInterests.length < 2
                  ? `Selecciona al menos 2 intereses (${selectedInterests.length}/2)`
                  : `${selectedInterests.length} interés${selectedInterests.length > 1 ? 'es' : ''} seleccionado${selectedInterests.length > 1 ? 's' : ''}`
                }
              </p>
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
                  {t.worldCupMatch}
                </p>
                <p className="text-sm text-amber-700 font-semibold">{matchInfo.equipos}</p>
                <p className="text-xs text-amber-600 mb-4">{matchInfo.partido} · Estadio Akron</p>

                <p className={`text-sm font-semibold text-[#1A4D2E] mb-3`}>{t.matchQuestion}</p>
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
                    {t.yes}
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
                    {t.no}
                  </button>
                </div>
                {attendsMatch === true && (
                  <p className="text-xs text-amber-700 mt-3">
                    {lang === 'en' ? 'Estadio Akron will be included in your itinerary with estimated transit time.' : 'El Estadio Akron se incluirá en tu itinerario con tiempo de traslado estimado.'}
                  </p>
                )}
              </div>
            )}

            {/* Botón generar */}
            <button
              type="submit"
              disabled={isGenerating || selectedInterests.length < 2}
              className="w-full bg-gradient-to-r from-[#0D601E] to-[#1A4D2E] text-white py-4 px-8 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md transition-all duration-200"
            >
              {isGenerating ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>{t.generating}</span>
                </div>
              ) : t.generate}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ---- RESULTS ----
  return (
    <div className="min-h-screen bg-[#fafafa]">

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />

      <div className="max-w-3xl mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6 print:hidden">
          <button
            onClick={() => setShowResults(false)}
            className="text-[#1A4D2E] text-sm font-medium hover:underline"
          >
            ← {lang === 'en' ? 'Modify search' : 'Modificar búsqueda'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (savedOk && savedItineraryId) unsaveItinerary();
                else if (!userId) { setAuthTrigger('save'); setShowAuthModal(true); }
                else saveItinerary();
              }}
              disabled={isSaving}
              title={savedOk ? (lang === 'en' ? 'Remove saved itinerary' : 'Quitar itinerario guardado') : userId ? t.save : t.saveRequiresAccount}
              className="p-2.5 rounded-xl border border-[#1A4D2E] bg-white hover:bg-[#E0F2F1] transition-colors disabled:opacity-50"
            >
              {isSaving
                ? <div className="w-5 h-5 border-2 border-[#1A4D2E] border-t-transparent rounded-full animate-spin" />
                : savedOk
                  ? <FaBookmark className="text-[#1A4D2E] w-5 h-5" />
                  : <FaRegBookmark className="text-[#1A4D2E] w-5 h-5" />
              }
            </button>
            {calendarUrl && (
              <a
                href={calendarUrl}
                className="px-5 py-2 rounded-xl text-sm font-bold transition-colors bg-[#81C784] text-white hover:bg-[#66bb6a]"
              >
                📅 {lang === 'en' ? 'View calendar' : 'Ver calendario'}
              </a>
            )}
            <button
              onClick={() => window.print()}
              className="bg-[#1A4D2E] text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-[#0D601E] transition-colors"
            >
              {lang === 'en' ? 'Print' : 'Imprimir'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-[#E0F2F1] shadow-sm p-6 md:p-8">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#1A4D2E] mb-3">{meta.title}</h2>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="bg-[#E0F2F1] text-[#1A4D2E] px-3 py-1 rounded-full">💰 {meta.budget}</span>
              <span className="bg-[#E0F2F1] text-[#1A4D2E] px-3 py-1 rounded-full">👥 {meta.groupSize}</span>
              <span className="bg-[#E0F2F1] text-[#1A4D2E] px-3 py-1 rounded-full">⏱ {meta.duration}</span>
              <span className="bg-[#E0F2F1] text-[#1A4D2E] px-3 py-1 rounded-full">{stops.length} {lang === 'en' ? 'places' : 'lugares'}</span>
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
                          {/* Etiquetas de intereses del usuario */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {interestOptions
                              .filter(opt => selectedInterests.includes(opt.id) && matchesInterest(stop.place.categoria, opt.id))
                              .map(opt => (
                                <span key={opt.id} className="text-[10px] font-semibold bg-[#E0F2F1] text-[#1A4D2E] px-1.5 py-0.5 rounded-md">
                                  {opt.name}
                                </span>
                              ))
                            }
                            {norm(stop.place.categoria).includes('postre') && (
                              <span className="text-[10px] font-semibold bg-pink-50 text-pink-700 border border-pink-100 px-1.5 py-0.5 rounded-md">🍦 Postre</span>
                            )}
                            {norm(stop.place.categoria).includes('calle') && (
                              <span className="text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-md">🌮 Callejero</span>
                            )}
                            {norm(stop.place.categoria).includes('vegana') && (
                              <span className="text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-md">🌱 Vegano</span>
                            )}
                          </div>
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
                          {!stop.place.isMatch && (
                            <button
                              onClick={() => {
                                const base = window.location.origin.replace(/:\d+$/, ':3000');
                                const back = encodeURIComponent(window.location.href);
                                const url = `${base}/informacion/${encodeURIComponent(stop.place.nombre)}?from=itinerario&back=${back}`;
                                window.open(url, '_blank', 'noopener,noreferrer');
                              }}
                              className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-[#0D601E] border border-[#81C784] rounded-lg px-2.5 py-1 hover:bg-[#E0F2F1] transition-colors print:hidden"
                            >
                              Ver lugar →
                            </button>
                          )}
                        </div>

                        {stop.place.fotos[0] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={stop.place.fotos[0]}
                            alt={stop.place.nombre}
                            className="w-16 h-16 rounded-xl object-cover shrink-0 print:hidden"
                            referrerPolicy="no-referrer"
                          />
                        )}

                        <div className="flex flex-col gap-1 print:hidden shrink-0">
                          <button onClick={() => moveUp(i)} disabled={i === 0} title="Subir"
                            className="w-7 h-7 rounded-lg bg-white border border-[#E0F2F1] text-[#1A4D2E] text-xs font-bold disabled:opacity-25 hover:bg-[#E0F2F1] transition-colors flex items-center justify-center">
                            ↑
                          </button>
                          <button onClick={() => moveDown(i)} disabled={i === stops.length - 1} title="Bajar"
                            className="w-7 h-7 rounded-lg bg-white border border-[#E0F2F1] text-[#1A4D2E] text-xs font-bold disabled:opacity-25 hover:bg-[#E0F2F1] transition-colors flex items-center justify-center">
                            ↓
                          </button>
                          {!stop.place.isMatch && (
                            <button onClick={() => replaceStop(i)} title="Sugerir otro lugar"
                              className="w-7 h-7 rounded-lg bg-white border border-[#81C784] text-[#0D601E] text-xs font-bold hover:bg-[#E0F2F1] transition-colors flex items-center justify-center">
                              ↺
                            </button>
                          )}
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

          <div className="mt-8 pt-6 border-t border-[#E0F2F1] flex justify-center gap-3 print:hidden">
            {calendarUrl && (
              <a
                href={calendarUrl}
                className="bg-[#81C784] text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-[#66bb6a] transition-all"
              >
                📅 Ver mi calendario
              </a>
            )}
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
