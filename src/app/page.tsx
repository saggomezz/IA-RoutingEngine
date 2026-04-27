"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaBookmark, FaRegBookmark } from 'react-icons/fa';
import {
  FiCalendar, FiClock, FiDollarSign, FiUsers, FiMapPin,
  FiZap, FiPrinter, FiRefreshCw,
} from 'react-icons/fi';
import AuthModal from '@/components/AuthModal';

const MXN_TO_USD = 17.50;

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
  fotos: string[];
  lat?: number;
  lng?: number;
  isMatch?: boolean;
  horaApertura?: string;
  horaCierre?: string;
  diasCerrado?: string;
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
  fotos: [],
  isMatch: true,
};

// ---- Geo helpers ----
function parseCoord(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(',', '.');
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

function getDayOfWeek(dateStr: string): string {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

function isPlaceOpen(place: Place, arrivalTime: string, dayOfWeek: string): boolean {
  if (!place.horaApertura || !place.horaCierre) return true;
  if (place.horaApertura === '00:00' && place.horaCierre === '23:59') return true;
  if (place.diasCerrado && place.diasCerrado !== 'ninguno') {
    const closed = place.diasCerrado.split(',').map(d => norm(d));
    if (closed.includes(norm(dayOfWeek))) return false;
  }
  const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const arr = toMins(arrivalTime);
  const open = toMins(place.horaApertura);
  let close = toMins(place.horaCierre);
  if (close <= open) close += 24 * 60;
  return arr >= open && arr < close - 20;
}

function repairConsecutiveGastro(places: Place[]): Place[] {
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
  const text = norm(`${place.nombre} ${place.categoria}`);
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
  const text = norm(`${place.nombre}`);
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
        ? '~45 min en tráfico hasta el estadio'
        : `~${defaultTransit} min en tráfico`
      : '';
    return { place, horaLlegada, horaSalida, traslado: trasladoLabel };
  });
}

// ---- Interest options ----
const INTEREST_OPTIONS = [
  { id: 'cultura', name: 'Cultura', emoji: '🏛️' },
  { id: 'gastronomia', name: 'Gastronomía', emoji: '🍽️' },
  { id: 'arquitectura', name: 'Arquitectura', emoji: '🏗️' },
  { id: 'arte', name: 'Arte e historia', emoji: '🎨' },
  { id: 'mercados', name: 'Mercados', emoji: '🏪' },
  { id: 'naturaleza', name: 'Naturaleza', emoji: '🌿' },
  { id: 'fotografia', name: 'Fotografía', emoji: '📷' },
  { id: 'compras', name: 'Compras', emoji: '🛍️' },
  { id: 'musica', name: 'Música', emoji: '🎵' },
  { id: 'aventura', name: 'Aventura', emoji: '🧗' },
  { id: 'vida-nocturna', name: 'Vida nocturna', emoji: '🌙' },
  { id: 'futbol', name: 'Fútbol', emoji: '⚽' },
];

const FOOD_PREFS = [
  { id: 'tradicional', name: 'Tapatío tradicional', emoji: '🌮', desc: 'Birria, torta ahogada, pozole' },
  { id: 'mix', name: 'Variado', emoji: '🍴', desc: 'Tradicional + internacional' },
  { id: 'vegetariano', name: 'Vegano / saludable', emoji: '🌱', desc: 'Opciones plant-based' },
  { id: 'nocturna', name: 'Ambiente nocturno', emoji: '🍸', desc: 'Bares y cantinas con estilo' },
];

// ---- Stagger variants ----
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } },
};
const stopVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.07, type: 'spring', stiffness: 240, damping: 20 },
  }),
};

// ---- Print styles ----
const printStyles = `
@media print {
  @page { margin: 1.5cm; size: A4; }
  body { background: white !important; }
  .print\\:hidden { display: none !important; }
  .print-card {
    break-inside: avoid;
    border: 1.5px solid #1A4D2E !important;
    border-radius: 12px !important;
    margin-bottom: 14px !important;
    page-break-inside: avoid;
  }
  .print-header {
    background: #1A4D2E !important;
    color: white !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    border-radius: 12px !important;
    padding: 18px !important;
    margin-bottom: 20px !important;
  }
  .print-stop-num {
    background: #1A4D2E !important;
    color: white !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    border-radius: 50% !important;
    width: 32px !important;
    height: 32px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-weight: 900 !important;
    font-size: 13px !important;
  }
  .print-logo {
    display: block !important;
    font-size: 24px;
    font-weight: 900;
    color: #1A4D2E !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;

// ---- Component ----
export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0D1F14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <HomePageInner />
    </Suspense>
  );
}

function HomePageInner() {
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateStr());
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState('dia-completo');
  const [budget, setBudget] = useState(1500);
  const [groupSize, setGroupSize] = useState(2);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [foodPreference, setFoodPreference] = useState('');
  const [attendsMatch, setAttendsMatch] = useState<boolean | null>(null);
  const [ritmo, setRitmo] = useState<'tranquilo' | 'normal' | 'activo'>('normal');
  const [transporte, setTransporte] = useState<'a-pie' | 'taxi' | 'auto'>('taxi');
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
  const [calendarUrl, setCalendarUrl] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarView, setCalendarView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const calendarRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const uid = searchParams.get('uid');
    const pendingSave = searchParams.get('pendingSave');

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
      const savedUid = sessionStorage.getItem('pitzbol_uid');
      if (savedUid) {
        try {
          const stored = JSON.parse(localStorage.getItem('pitzbol_user') || '{}');
          if (stored.uid === savedUid) {
            setUserId(savedUid);
            setUserRole(stored.role || 'turista');
          } else {
            sessionStorage.removeItem('pitzbol_uid');
          }
        } catch {}
      } else {
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

  useEffect(() => {
    const handler = () => { setAuthTrigger('profile'); setShowAuthModal(true); };
    window.addEventListener('openAuthModal', handler);
    return () => window.removeEventListener('openAuthModal', handler);
  }, []);

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
          uid, role,
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
          setAuthTrigger('save');
          setShowAuthModal(true);
          return;
        }
        throw new Error(data.error || 'Respuesta no exitosa');
      }
      const data = await res.json();
      setSavedItineraryId(data.id || null);
      setSavedOk(true);
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
          n: s.place.nombre, d: s.place.direccion, c: s.place.costo,
          m: s.place.isMatch || false, a: s.horaLlegada, z: s.horaSalida,
        })),
      };
      const hash = encodeURIComponent(JSON.stringify(entry));
      setCalendarUrl(`${frontendUrl}/calendario#${hash}`);
    } catch {}
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
      if (res.ok) { setSavedOk(false); setSavedItineraryId(null); }
    } catch {}
  };

  const handleAuthSuccess = (uid: string, _nombre: string) => {
    setUserId(uid);
    sessionStorage.setItem('pitzbol_uid', uid);
    try {
      const stored = JSON.parse(localStorage.getItem('pitzbol_user') || '{}');
      if (stored.uid === uid) setUserRole(stored.role || 'turista');
    } catch {}
    setShowAuthModal(false);
    if (authTrigger === 'save' && stops.length > 0) saveItinerary(uid);
    setAuthTrigger(null);
  };

  const generateItinerary = async () => {
    if (!selectedDate || selectedInterests.length < 2) {
      alert('Selecciona una fecha y al menos 2 intereses para un itinerario variado');
      return;
    }
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
        fotos: Array.isArray(p['fotos']) ? p['fotos'] : [],
        lat: parseCoord(p['Latitud']) ?? undefined,
        lng: parseCoord(p['Longitud']) ?? undefined,
        horaApertura: p['horaApertura'] || undefined,
        horaCierre: p['horaCierre'] || undefined,
        diasCerrado: p['diasCerrado'] || 'ninguno',
      })).filter(p => p.nombre);

      const AKRON_KEY = 'akron';
      let filtered = places.filter(p =>
        !norm(p.nombre).includes(AKRON_KEY) &&
        selectedInterests.some(interest => matchesInterest(p.categoria, interest))
      );

      filtered = filtered.filter(p => {
        const min = parseCostMin(p.costo);
        return min === 0 || min <= budget;
      });

      if (transporte === 'a-pie') {
        const CENTRO_LAT = 20.6736, CENTRO_LNG = -103.3440;
        const withCoords = filtered.filter(p =>
          p.lat != null && p.lng != null &&
          haversine(CENTRO_LAT, CENTRO_LNG, p.lat!, p.lng!) <= 3
        );
        if (withCoords.length >= 3) filtered = withCoords;
      }

      if (foodPreference === 'vegetariano') {
        filtered = filtered.filter(p => {
          if (matchesInterest(p.categoria, 'gastronomia')) {
            const cat = norm(p.categoria);
            return cat.includes('vegana') || cat.includes('vegetaria') || cat.includes('sano');
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
        alert('No encontramos lugares que coincidan con tu selección. Prueba con otros intereses o aumenta el presupuesto.');
        return;
      }

      const ritmoMult = ritmo === 'tranquilo' ? 1.3 : ritmo === 'activo' ? 0.8 : 1;
      const adjustedPlaces = filtered.map(p => ({
        ...p,
        tiempoEstancia: Math.round(p.tiempoEstancia * ritmoMult),
      }));

      const matchReservedMins = attendsMatch ? 180 + 45 : 0;
      // targetMins es el tiempo real que debe llenarse
      const targetMins = (duration === 'rapido' ? 180 : duration === 'medio-dia' ? 360 : 540) - matchReservedMins;

      const mealContext = getMealContext(startTime);
      const hasGastro = selectedInterests.includes('gastronomia');
      const hasNocturna = selectedInterests.includes('vida-nocturna');

      // Número máximo de paradas ajustado para llenar el tiempo real
      const basePlaces = duration === 'rapido' ? 3 : duration === 'medio-dia' ? 6 : 10;
      const maxPlaces = ritmo === 'activo' ? basePlaces + 2 : ritmo === 'tranquilo' ? Math.max(2, basePlaces - 1) : basePlaces;

      const startHour = parseInt(startTime.split(':')[0]);
      const maxGastro = duration === 'rapido' ? 1 : duration === 'medio-dia' ? 2 : startHour < 11 ? 3 : 2;
      // Mínimo de minutos entre dos visitas a lugares de gastronomía
      const MIN_GASTRO_GAP_MINS = 150;
      const selectedDayOfWeek = getDayOfWeek(selectedDate);
      const timeToMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

      const postrePool = hasGastro
        ? adjustedPlaces.filter(p =>
            !norm(p.nombre).includes(AKRON_KEY) &&
            norm(p.categoria).includes('postre') &&
            isPlaceOpen(p, '14:00', selectedDayOfWeek)
          ).sort(() => Math.random() - 0.5)
        : [];

      const gastroPool = adjustedPlaces
        .filter(p => matchesInterest(p.categoria, 'gastronomia'))
        .sort((a, b) => mealScore(b, mealContext) - mealScore(a, mealContext));

      const nocturnaPool = adjustedPlaces
        .filter(p => matchesInterest(p.categoria, 'vida-nocturna') && !matchesInterest(p.categoria, 'gastronomia'))
        .sort(() => Math.random() - 0.5);

      const othersPool = adjustedPlaces
        .filter(p => !matchesInterest(p.categoria, 'gastronomia') && !matchesInterest(p.categoria, 'vida-nocturna'))
        .sort(() => Math.random() - 0.5);

      const afterMatchPool = attendsMatch && hasNocturna ? nocturnaPool : [];

      const buildInterleavedPool = (): Place[] => {
        // Nocturna siempre se maneja por separado cuando el usuario la seleccionó
        const others = hasNocturna ? othersPool : [...othersPool, ...nocturnaPool];
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
      let lastGastroEndMins = -MIN_GASTRO_GAP_MINS; // permite primer restaurante de inmediato
      const usedFoodTypes = new Set<string>();
      const usedNames = new Set<string>();

      const transitMins = transporte === 'a-pie' ? 10 : transporte === 'auto' ? 20 : 15;

      for (const place of mainPool) {
        if (selected.length >= maxPlaces) break;
        if (usedNames.has(place.nombre)) continue;
        const isGastro = matchesInterest(place.categoria, 'gastronomia');
        const isNocturna = matchesInterest(place.categoria, 'vida-nocturna');

        const estimatedArrival = addMinutes(startTime, totalTime + (selected.length > 0 ? transitMins : 0));
        const arrivalHour = parseInt(estimatedArrival.split(':')[0]);
        const arrivalMins = timeToMins(estimatedArrival);

        if (!isPlaceOpen(place, estimatedArrival, selectedDayOfWeek)) continue;
        if (isGastro && hasNocturna && arrivalHour >= 19) continue;
        if (isNocturna && hasNocturna && arrivalHour < 19) continue;

        if (isGastro) {
          if (gastroCount >= maxGastro) continue;
          // Mínimo MIN_GASTRO_GAP_MINS entre fin del último gastro y llegada al siguiente
          if (arrivalMins - lastGastroEndMins < MIN_GASTRO_GAP_MINS) continue;
          const foodType = getFoodType(place);
          if (usedFoodTypes.has(foodType)) continue;
          usedFoodTypes.add(foodType);
          gastroCount++;
        }

        const timeNeeded = place.tiempoEstancia + (selected.length > 0 ? transitMins : 0);
        if (totalTime + timeNeeded <= targetMins) {
          selected.push(place);
          usedNames.add(place.nombre);
          totalTime += timeNeeded;
          if (isGastro) lastGastroEndMins = arrivalMins + place.tiempoEstancia;
        }
      }

      // Si quedó tiempo libre (más de 30 min), intentar agregar más lugares
      if (totalTime < targetMins - 30 && selected.length < maxPlaces) {
        for (const place of [...othersPool, ...gastroPool]) {
          if (selected.length >= maxPlaces) break;
          if (usedNames.has(place.nombre)) continue;
          const isGastro = matchesInterest(place.categoria, 'gastronomia');
          const estArrival = addMinutes(startTime, totalTime + transitMins);
          const arrivalMins = timeToMins(estArrival);
          if (isGastro) {
            if (gastroCount >= maxGastro) continue;
            if (arrivalMins - lastGastroEndMins < MIN_GASTRO_GAP_MINS) continue;
            const foodType = getFoodType(place);
            if (usedFoodTypes.has(foodType)) continue;
            usedFoodTypes.add(foodType);
            gastroCount++;
          }
          if (!isPlaceOpen(place, estArrival, selectedDayOfWeek)) continue;
          const timeNeeded = place.tiempoEstancia + transitMins;
          if (totalTime + timeNeeded <= targetMins) {
            selected.push(place);
            usedNames.add(place.nombre);
            totalTime += timeNeeded;
            if (isGastro) lastGastroEndMins = arrivalMins + place.tiempoEstancia;
          }
        }
      }

      // Agregar lugares de vida nocturna al final, solo si llega después de las 7pm
      if (hasNocturna && !attendsMatch) {
        for (const place of nocturnaPool) {
          if (selected.length >= maxPlaces) break;
          if (usedNames.has(place.nombre)) continue;
          const estArrival = addMinutes(startTime, totalTime + (selected.length > 0 ? transitMins : 0));
          if (parseInt(estArrival.split(':')[0]) < 19) continue;
          if (!isPlaceOpen(place, estArrival, selectedDayOfWeek)) continue;
          selected.push(place);
          usedNames.add(place.nombre);
          totalTime += place.tiempoEstancia + transitMins;
        }
      }

      if (selected.length === 0) selected.push(mainPool[0] ?? filtered[0]);
      if (attendsMatch) selected.push(ESTADIO_AKRON);
      if (afterMatchPool.length > 0) selected.push(afterMatchPool[0]);

      const matchStop = selected.find(p => p.isMatch);
      const afterMatchStops = selected.filter(p => !p.isMatch && attendsMatch && afterMatchPool.includes(p));
      const regularStops = selected.filter(p => !p.isMatch && !afterMatchStops.includes(p));

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

      if (hasGastro && postrePool.length > 0) {
        let simMins = 0;
        let sortedLastGastroComidaIdx = -1;
        for (let i = 0; i < sortedRegular.length; i++) {
          const arrivalTime = addMinutes(startTime, simMins);
          if (matchesInterest(sortedRegular[i].categoria, 'gastronomia') && getMealContext(arrivalTime) === 'comida') {
            sortedLastGastroComidaIdx = i;
          }
          simMins += sortedRegular[i].tiempoEstancia + (i < sortedRegular.length - 1 ? transitMins : 0);
        }
        if (sortedLastGastroComidaIdx >= 0) {
          const refPlace = sortedRegular[sortedLastGastroComidaIdx];
          let bestPostre: Place | null = null;
          let bestDist = Infinity;
          for (const p of postrePool) {
            if (refPlace.lat != null && refPlace.lng != null && p.lat != null && p.lng != null) {
              const d = haversine(refPlace.lat, refPlace.lng, p.lat, p.lng);
              if (d < bestDist) { bestDist = d; bestPostre = p; }
            } else if (!bestPostre) { bestPostre = p; }
          }
          if (bestPostre && sortedRegular.length <= maxPlaces) {
            sortedRegular.splice(sortedLastGastroComidaIdx + 1, 0, bestPostre);
            // Re-aplicar repair para evitar dos gastro consecutivas tras insertar el postre
            const repaired = repairConsecutiveGastro(sortedRegular);
            sortedRegular.splice(0, sortedRegular.length, ...repaired);
          }
        }
      }

      const finalSelected = matchStop
        ? [...sortedRegular, matchStop, ...afterMatchStops]
        : sortedRegular;

      setTransitTime(transitMins);
      setAllPlaces(filtered);
      const schedule = buildSchedule(finalSelected, startTime, transitMins);
      setStops(schedule);

      const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-MX', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });

      setMeta({
        title: `Itinerario ${dateLabel}`,
        budget: `$${budget.toLocaleString('es-MX')} MXN`,
        groupSize: `${groupSize} persona${groupSize > 1 ? 's' : ''}`,
        duration: duration === 'rapido' ? '2–3 hrs' : duration === 'medio-dia' ? '5–6 hrs' : '8–9 hrs',
      });
      setShowResults(true);
      setSavedOk(false);
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
    const arr = [...stops]; [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    setStops(buildSchedule(arr.map(s => s.place), startTime, transitTime));
  };

  const moveDown = (i: number) => {
    if (i === stops.length - 1) return;
    const arr = [...stops]; [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    setStops(buildSchedule(arr.map(s => s.place), startTime, transitTime));
  };

  const removeStop = (i: number) => {
    const newPlaces = stops.filter((_, idx) => idx !== i).map(s => s.place);
    setStops(buildSchedule(newPlaces, startTime, transitTime));
  };

  const replaceStop = (i: number) => {
    const current = stops[i].place;
    const usedNames = new Set(stops.map(s => s.place.nombre));
    const matchingInterest = selectedInterests.find(int => matchesInterest(current.categoria, int)) || selectedInterests[0];
    const candidates = allPlaces.filter(p => !usedNames.has(p.nombre) && matchesInterest(p.categoria, matchingInterest));
    if (candidates.length === 0) return;
    const newPlace = candidates[Math.floor(Math.random() * candidates.length)];
    const newPlaces = stops.map((s, idx) => idx === i ? newPlace : s.place);
    setStops(buildSchedule(newPlaces, startTime, transitTime));
  };

  // ===== FORM =====
  if (!showResults) {
    return (
      <div className="min-h-screen bg-[#F7F9F4]">
        <style>{printStyles}</style>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onSuccess={handleAuthSuccess} />

        {/* Loading overlay con logo animado */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0D1F14]/96 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.4 } }}
            >
              <motion.div
                animate={{ y: [0, -22, 0], rotate: [0, 8, -8, 0] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                className="text-7xl mb-5 select-none"
              >
                ⚽
              </motion.div>
              <motion.div
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
              >
                <span className="text-3xl font-black text-white">Pitzbol</span>
              </motion.div>
              <motion.p
                className="text-white/60 text-sm mt-3 font-medium"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.8 }}
              >
                Creando tu itinerario perfecto...
              </motion.p>
              <div className="flex gap-1.5 mt-6">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-[#81C784]"
                    animate={{ scale: [1, 1.6, 1], opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero */}
        <div className="bg-gradient-to-br from-[#0D1F14] via-[#1A4D2E] to-[#2E6B40] text-white py-14 px-4 text-center relative overflow-hidden">
          <motion.div
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, #81C784 0%, transparent 50%), radial-gradient(circle at 80% 20%, #FFD700 0%, transparent 50%)' }}
            animate={{ opacity: [0.08, 0.15, 0.08] }}
            transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
          />
          <motion.div
            className="relative z-10 max-w-lg mx-auto"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <motion.div
              className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-xs font-semibold mb-5 backdrop-blur-sm"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <span>🏆</span>
              <span>Mundial 2026 · Guadalajara, México</span>
            </motion.div>
            <motion.h1
              className="text-4xl md:text-5xl font-black leading-tight mb-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Tu día perfecto<br />
              <span className="text-[#81C784]">en Guadalajara</span>
            </motion.h1>
            <motion.p
              className="text-white/70 text-sm max-w-sm mx-auto leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
            >
              Cuéntanos cómo eres y generamos un itinerario personalizado — lugares locales, gastronomía auténtica y experiencias únicas.
            </motion.p>
          </motion.div>
        </div>

        {/* Form */}
        <div className="max-w-lg mx-auto px-4 py-8">
          <form onSubmit={(e) => { e.preventDefault(); generateItinerary(); }}>
            <motion.div
              className="space-y-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {/* Fecha y hora */}
              <motion.div variants={cardVariants} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm font-bold text-[#1A4D2E] mb-4">
                  📅 ¿Cuándo visitas?
                </p>

                <div className="relative mb-3" ref={calendarRef}>
                  <button type="button"
                    onClick={() => {
                      if (!calendarOpen) {
                        const parts = selectedDate.split('-').map(Number);
                        if (parts[0]) setCalendarView({ year: parts[0], month: parts[1] - 1 });
                      }
                      setCalendarOpen(o => !o);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 border-2 border-gray-100 rounded-xl text-sm bg-[#F7F9F4] hover:border-[#1A4D2E] transition-all text-left group"
                  >
                    <FiCalendar className="text-[#1A4D2E] shrink-0" size={16} />
                    <span className={`flex-1 ${selectedDate ? 'text-gray-800 font-medium capitalize' : 'text-gray-400'}`}>
                      {selectedDate
                        ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                        : 'Selecciona una fecha'}
                    </span>
                    {MATCH_DAYS[selectedDate] && <span className="text-lg">⚽</span>}
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-[#1A4D2E] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <AnimatePresence>
                    {calendarOpen && (
                      <motion.div
                        className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden w-full"
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.18 }}
                      >
                        <div className="bg-[#1A4D2E] px-4 py-3 flex items-center justify-between">
                          <button type="button"
                            onClick={() => setCalendarView(v => { const d = new Date(v.year, v.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
                            className="text-white/70 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-sm"
                          >‹</button>
                          <span className="text-white font-bold text-sm capitalize">
                            {new Date(calendarView.year, calendarView.month).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                          </span>
                          <button type="button"
                            onClick={() => setCalendarView(v => { const d = new Date(v.year, v.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
                            className="text-white/70 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-sm"
                          >›</button>
                        </div>
                        <div className="grid grid-cols-7 bg-[#F0F7F0]">
                          {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'].map(d => (
                            <div key={d} className="text-center text-xs font-bold text-[#1A4D2E] py-2">{d}</div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 p-2 gap-0.5">
                          {(() => {
                            const todayStr = getLocalDateStr();
                            const total = getDaysInMonth(calendarView.year, calendarView.month);
                            const first = getFirstDayOfWeek(calendarView.year, calendarView.month);
                            const cells = [];
                            for (let i = 0; i < first; i++) cells.push(<div key={`e${i}`} />);
                            for (let d = 1; d <= total; d++) {
                              const dateStr = `${calendarView.year}-${String(calendarView.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                              const past = dateStr < todayStr;
                              const sel = dateStr === selectedDate;
                              const today = dateStr === todayStr;
                              const match = dateStr in MATCH_DAYS;
                              cells.push(
                                <button key={d} type="button" disabled={past}
                                  onClick={() => { setSelectedDate(dateStr); setAttendsMatch(null); setCalendarOpen(false); }}
                                  className={[
                                    'relative flex flex-col items-center justify-end pb-1 rounded-xl text-xs font-medium h-11 transition-all',
                                    past ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer',
                                    sel ? 'bg-[#1A4D2E] text-white' : '',
                                    !sel && today ? 'border-2 border-[#81C784] text-[#1A4D2E] font-bold' : '',
                                    !sel && !today && !past ? 'hover:bg-[#E8F5E9] text-gray-700' : '',
                                  ].join(' ')}
                                >
                                  {match && <span className="text-[9px] leading-none mb-0.5">⚽</span>}
                                  <span>{d}</span>
                                </button>
                              );
                            }
                            return cells;
                          })()}
                        </div>
                        <div className="px-4 pb-3 pt-1 flex items-center gap-4 text-xs text-gray-400 border-t border-gray-50">
                          <span>⚽ Día de partido</span>
                          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border-2 border-[#81C784] inline-block" /> Hoy</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Hora de inicio</label>
                    <div className="relative">
                      <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                      <select value={startTime} onChange={e => setStartTime(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-100 rounded-xl text-sm bg-[#F7F9F4] text-gray-800 focus:outline-none focus:border-[#1A4D2E] appearance-none">
                        {['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00'].map(t => (
                          <option key={t} value={t}>{formatTime12(t)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Duración</label>
                    <select value={duration} onChange={e => setDuration(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-100 rounded-xl text-sm bg-[#F7F9F4] text-gray-800 focus:outline-none focus:border-[#1A4D2E]">
                      <option value="rapido">Rápido (2–3 h)</option>
                      <option value="medio-dia">Medio día (5–6 h)</option>
                      <option value="dia-completo">Día completo (8–9 h)</option>
                    </select>
                  </div>
                </div>
              </motion.div>

              {/* Grupo y presupuesto */}
              <motion.div variants={cardVariants} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm font-bold text-[#1A4D2E] mb-4">
                  👥 Tu grupo
                </p>

                <div className="mb-4">
                  <div className="flex justify-between items-baseline mb-2">
                    <label className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                      <FiUsers size={13} /> Personas
                    </label>
                    <span className="text-sm font-bold text-[#1A4D2E]">{groupSize}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setGroupSize(g => Math.max(1, g - 1))}
                      className="w-8 h-8 rounded-full border border-gray-200 text-gray-600 font-bold hover:border-[#1A4D2E] hover:text-[#1A4D2E] transition-colors flex items-center justify-center">
                      −
                    </button>
                    <input type="range" min="1" max="15" value={groupSize}
                      onChange={e => setGroupSize(Number(e.target.value))}
                      className="flex-1 h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-[#0D601E]" />
                    <button type="button" onClick={() => setGroupSize(g => Math.min(15, g + 1))}
                      className="w-8 h-8 rounded-full border border-gray-200 text-gray-600 font-bold hover:border-[#1A4D2E] hover:text-[#1A4D2E] transition-colors flex items-center justify-center">
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <label className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                      <FiDollarSign size={13} /> Presupuesto por persona
                    </label>
                    <span className="text-sm font-bold text-[#1A4D2E]">
                      ${budget.toLocaleString('es-MX')} MXN
                      <span className="text-xs text-gray-400 font-normal ml-1">
                        (~${Math.round(budget / MXN_TO_USD).toLocaleString('en-US')} USD)
                      </span>
                    </span>
                  </div>
                  <input type="range" min="200" max="15000" step="100" value={budget}
                    onChange={e => setBudget(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-[#0D601E]" />
                  <div className="flex justify-between text-xs text-gray-300 mt-1">
                    <span>$200</span><span>$15,000</span>
                  </div>
                </div>
              </motion.div>

              {/* Estilo de viaje */}
              <motion.div variants={cardVariants} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm font-bold text-[#1A4D2E] mb-4">
                  🚀 Estilo de viaje
                </p>

                <div className="mb-4">
                  <label className="block text-xs text-gray-500 font-medium mb-2">Ritmo del día</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'tranquilo', label: 'Tranquilo', emoji: '🌿', desc: 'Más tiempo en cada lugar' },
                      { id: 'normal', label: 'Normal', emoji: '⚡', desc: 'Balance perfecto' },
                      { id: 'activo', label: 'Activo', emoji: '🔥', desc: 'Más lugares, más rápido' },
                    ].map(opt => (
                      <motion.button
                        key={opt.id} type="button" onClick={() => setRitmo(opt.id as any)}
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          ritmo === opt.id ? 'border-[#1A4D2E] bg-[#E8F5E9]' : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="text-xl mb-1">{opt.emoji}</div>
                        <div className={`text-xs font-bold ${ritmo === opt.id ? 'text-[#1A4D2E]' : 'text-gray-600'}`}>{opt.label}</div>
                        <div className="text-xs text-gray-400 mt-0.5 leading-tight">{opt.desc}</div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 font-medium mb-2">Cómo te vas a mover</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'a-pie', label: 'A pie', emoji: '🚶', desc: 'Solo el centro histórico' },
                      { id: 'taxi', label: 'Uber / Taxi', emoji: '🚗', desc: 'Toda la ciudad' },
                      { id: 'auto', label: 'Auto propio', emoji: '🚙', desc: 'Libertad total' },
                    ].map(opt => (
                      <motion.button
                        key={opt.id} type="button" onClick={() => setTransporte(opt.id as any)}
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          transporte === opt.id ? 'border-[#1A4D2E] bg-[#E8F5E9]' : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="text-xl mb-1">{opt.emoji}</div>
                        <div className={`text-xs font-bold ${transporte === opt.id ? 'text-[#1A4D2E]' : 'text-gray-600'}`}>{opt.label}</div>
                        <div className="text-xs text-gray-400 mt-0.5 leading-tight">{opt.desc}</div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Intereses */}
              <motion.div variants={cardVariants} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold text-[#1A4D2E]">
                    ✨ ¿Qué te apasiona?
                  </p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${selectedInterests.length >= 2 ? 'bg-[#E8F5E9] text-[#1A4D2E]' : 'bg-amber-50 text-amber-600'}`}>
                    {selectedInterests.length}/2 mín.
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {INTEREST_OPTIONS.map(opt => {
                    const active = selectedInterests.includes(opt.id);
                    return (
                      <motion.button
                        key={opt.id} type="button" onClick={() => toggleInterest(opt.id)}
                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
                        className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all ${
                          active ? 'border-[#1A4D2E] bg-[#E8F5E9]' : 'border-gray-100 hover:border-gray-200 bg-[#F7F9F4]'
                        }`}
                      >
                        <span className="text-2xl">{opt.emoji}</span>
                        <span className={`text-xs font-semibold text-center leading-tight ${active ? 'text-[#1A4D2E]' : 'text-gray-500'}`}>
                          {opt.name}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Tipo de comida */}
              <AnimatePresence>
                {selectedInterests.includes('gastronomia') && (
                  <motion.div
                    key="food-prefs"
                    variants={cardVariants}
                    initial="hidden" animate="visible" exit={{ opacity: 0, height: 0 }}
                    className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 overflow-hidden"
                  >
                    <p className="text-sm font-bold text-[#1A4D2E] mb-4">
                      🍽️ ¿Qué tipo de comida?
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {FOOD_PREFS.map(pref => (
                        <motion.button
                          key={pref.id} type="button"
                          onClick={() => setFoodPreference(foodPreference === pref.id ? '' : pref.id)}
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                            foodPreference === pref.id
                              ? 'border-[#1A4D2E] bg-[#E8F5E9]'
                              : 'border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <span className="text-2xl shrink-0">{pref.emoji}</span>
                          <div>
                            <div className={`text-xs font-bold ${foodPreference === pref.id ? 'text-[#1A4D2E]' : 'text-gray-700'}`}>{pref.name}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{pref.desc}</div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Partido */}
              <AnimatePresence>
                {matchInfo && (
                  <motion.div
                    key="match-card"
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.97 }}
                    className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-5"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <motion.span
                        className="text-2xl"
                        animate={{ rotate: [0, 15, -15, 0] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      >⚽</motion.span>
                      <div>
                        <p className="text-sm font-bold text-amber-900">¡Hay partido este día!</p>
                        <p className="text-xs text-amber-700 font-semibold">{matchInfo.equipos}</p>
                        <p className="text-xs text-amber-600">{matchInfo.partido} · Estadio Akron</p>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-amber-800 mb-2">¿Asistirás al partido?</p>
                    <div className="flex gap-2">
                      {[
                        { val: true, label: 'Sí, tengo boleto', emoji: '🎟️' },
                        { val: false, label: 'No, solo explorar', emoji: '🗺️' },
                      ].map(opt => (
                        <motion.button
                          key={String(opt.val)} type="button" onClick={() => setAttendsMatch(opt.val)}
                          whileTap={{ scale: 0.97 }}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                            attendsMatch === opt.val
                              ? 'bg-[#1A4D2E] text-white border-[#1A4D2E]'
                              : 'bg-white text-amber-800 border-amber-200 hover:border-amber-400'
                          }`}
                        >
                          <span>{opt.emoji}</span> {opt.label}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Botón generar */}
              <motion.button
                type="submit"
                variants={cardVariants}
                disabled={isGenerating || selectedInterests.length < 2}
                whileHover={selectedInterests.length >= 2 ? { scale: 1.02, boxShadow: '0 8px 32px rgba(13,96,30,0.3)' } : {}}
                whileTap={selectedInterests.length >= 2 ? { scale: 0.98 } : {}}
                className="w-full bg-gradient-to-r from-[#0D601E] to-[#1A4D2E] text-white py-4 rounded-2xl font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span className="flex items-center justify-center gap-2">
                  <FiZap size={17} /> Generar mi itinerario
                </span>
              </motion.button>

              {selectedInterests.length < 2 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-xs text-amber-600 -mt-2"
                >
                  Selecciona al menos 2 intereses para continuar
                </motion.p>
              )}
            </motion.div>
          </form>
        </div>
      </div>
    );
  }

  // ===== RESULTS =====
  return (
    <div className="min-h-screen bg-[#F7F9F4]">
      <style>{printStyles}</style>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onSuccess={handleAuthSuccess} />

      {/* Header resultado */}
      <motion.div
        className="bg-gradient-to-r from-[#0D1F14] to-[#1A4D2E] text-white px-4 py-6 print:hidden"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <motion.button
            onClick={() => setShowResults(false)}
            className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium transition-colors shrink-0"
            whileHover={{ x: -3 }}
          >
            <FiRefreshCw size={14} /> Modificar
          </motion.button>
          <div className="flex items-center gap-2 shrink-0">
            <motion.button
              onClick={() => {
                if (savedOk && savedItineraryId) unsaveItinerary();
                else if (!userId) { setAuthTrigger('save'); setShowAuthModal(true); }
                else saveItinerary();
              }}
              disabled={isSaving}
              title={savedOk ? 'Quitar guardado' : 'Guardar itinerario'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-xs font-semibold transition-all disabled:opacity-50"
              whileTap={{ scale: 0.95 }}
            >
              {isSaving
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : savedOk
                  ? <><FaBookmark size={13} /> Guardado</>
                  : <><FaRegBookmark size={13} /> Guardar</>
              }
            </motion.button>
            {calendarUrl && (
              <a href={calendarUrl}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-xs font-semibold transition-all">
                📅 Calendario
              </a>
            )}
            <motion.button
              onClick={generateItinerary}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#E8F5E9] text-[#1A4D2E] text-xs font-bold hover:bg-[#c8e6c9] transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Generar otra versión del itinerario"
            >
              ↺ Otra opción
            </motion.button>
            <motion.button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-[#1A4D2E] text-xs font-bold hover:bg-[#E8F5E9] transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FiPrinter size={13} /> Imprimir
            </motion.button>
          </div>
        </div>
      </motion.div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Print header — visible solo al imprimir */}
        <div className="hidden print:block print-header mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span style={{ fontSize: 28 }}>⚽</span>
            <span className="print-logo">Pitzbol</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>· Mundial 2026 Guadalajara</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{meta.title}</div>
        </div>

        {/* Meta del itinerario */}
        <motion.div
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="text-lg font-bold text-[#1A4D2E] mb-3 capitalize">{meta.title}</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { icon: '💰', text: meta.budget },
              { icon: '👥', text: meta.groupSize },
              { icon: '⏱️', text: meta.duration },
              { icon: '📍', text: `${stops.length} lugares` },
              { icon: ritmo === 'tranquilo' ? '🌿' : ritmo === 'activo' ? '🔥' : '⚡', text: ritmo === 'tranquilo' ? 'Tranquilo' : ritmo === 'activo' ? 'Activo' : 'Normal' },
              { icon: transporte === 'a-pie' ? '🚶' : transporte === 'auto' ? '🚙' : '🚗', text: transporte === 'a-pie' ? 'A pie' : transporte === 'auto' ? 'Auto propio' : 'Uber / Taxi' },
            ].map((tag, i) => (
              <motion.span
                key={i}
                className="inline-flex items-center gap-1 bg-[#F0F7F0] text-[#1A4D2E] text-xs font-medium px-3 py-1.5 rounded-full"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                {tag.icon} {tag.text}
              </motion.span>
            ))}
          </div>
        </motion.div>

        {/* Timeline */}
        <div className="space-y-3">
          {stops.map((stop, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={stopVariants}
              initial="hidden"
              animate="visible"
              className="flex gap-3"
            >
              {/* Indicador */}
              <div className="flex flex-col items-center shrink-0">
                <motion.div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0 print-stop-num ${stop.place.isMatch ? 'bg-amber-500' : 'bg-[#1A4D2E]'}`}
                  whileHover={{ scale: 1.15 }}
                >
                  {i + 1}
                </motion.div>
                {i < stops.length - 1 && (
                  <div className="w-px flex-1 my-1 bg-gray-100 min-h-[24px]" />
                )}
              </div>

              {/* Card */}
              <div className={`flex-1 rounded-2xl border overflow-hidden mb-1 print-card ${stop.place.isMatch ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-white'} shadow-sm`}>
                <div className="flex">
                  {stop.place.fotos[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={stop.place.fotos[0]} alt={stop.place.nombre}
                      className="w-24 h-full object-cover shrink-0 print:hidden"
                      style={{ maxHeight: 120 }}
                      referrerPolicy="no-referrer" />
                  )}
                  <div className="flex-1 p-4 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-sm font-black ${stop.place.isMatch ? 'text-amber-700' : 'text-[#0D601E]'}`}>
                        {formatTime12(stop.horaLlegada)}
                      </span>
                      <span className="text-xs text-gray-400">→ {formatTime12(stop.horaSalida)}</span>
                      <span className="ml-auto text-xs text-gray-400 flex items-center gap-0.5">
                        <FiClock size={10} /> {stop.place.tiempoEstancia} min
                      </span>
                    </div>

                    <h3 className={`font-bold text-sm leading-snug ${stop.place.isMatch ? 'text-amber-900' : 'text-[#1A4D2E]'}`}>
                      {stop.place.nombre}
                    </h3>

                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {INTEREST_OPTIONS.filter(opt =>
                        selectedInterests.includes(opt.id) && matchesInterest(stop.place.categoria, opt.id)
                      ).map(opt => (
                        <span key={opt.id} className="text-xs font-semibold bg-[#E8F5E9] text-[#1A4D2E] px-1.5 py-0.5 rounded-md">
                          {opt.emoji} {opt.name}
                        </span>
                      ))}
                      {norm(stop.place.categoria).includes('postre') && (
                        <span className="text-xs font-semibold bg-pink-50 text-pink-700 px-1.5 py-0.5 rounded-md">🍦 Postre</span>
                      )}
                    </div>

                    <p className="text-xs text-gray-400 mt-1.5 flex items-start gap-1">
                      <FiMapPin size={10} className="shrink-0 mt-0.5" />
                      {stop.place.direccion}
                    </p>

                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-gray-500 flex items-center gap-0.5">
                        <FiDollarSign size={10} /> {stop.place.costo}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-3 print:hidden">
                      {!stop.place.isMatch && (
                        <motion.button
                          onClick={() => {
                            const base = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.pitzbol.me';
                            window.open(`${base}/informacion/${encodeURIComponent(stop.place.nombre)}?from=itinerario`, '_blank', 'noopener,noreferrer');
                          }}
                          className="text-xs font-semibold text-[#0D601E] border border-[#81C784] rounded-lg px-2.5 py-1 hover:bg-[#E8F5E9] transition-colors"
                          whileHover={{ scale: 1.03 }}
                        >
                          Ver más →
                        </motion.button>
                      )}
                      <div className="ml-auto flex gap-1">
                        <button onClick={() => moveUp(i)} disabled={i === 0} title="Subir"
                          className="w-7 h-7 rounded-lg border border-gray-100 text-gray-400 text-xs disabled:opacity-25 hover:border-[#1A4D2E] hover:text-[#1A4D2E] transition-colors flex items-center justify-center">↑</button>
                        <button onClick={() => moveDown(i)} disabled={i === stops.length - 1} title="Bajar"
                          className="w-7 h-7 rounded-lg border border-gray-100 text-gray-400 text-xs disabled:opacity-25 hover:border-[#1A4D2E] hover:text-[#1A4D2E] transition-colors flex items-center justify-center">↓</button>
                        {!stop.place.isMatch && (
                          <button onClick={() => replaceStop(i)} title="Sugerir otro"
                            className="w-7 h-7 rounded-lg border border-[#81C784] text-[#0D601E] text-xs hover:bg-[#E8F5E9] transition-colors flex items-center justify-center">↺</button>
                        )}
                        <button onClick={() => removeStop(i)} title="Eliminar"
                          className="w-7 h-7 rounded-lg border border-red-100 text-red-400 text-xs hover:bg-red-50 transition-colors flex items-center justify-center">✕</button>
                      </div>
                    </div>
                  </div>
                </div>

                {stop.traslado && (
                  <div className={`px-4 py-2 border-t flex items-center gap-1.5 ${stop.traslado.includes('estadio') ? 'bg-amber-50/50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
                    <span className="text-sm">
                      {transporte === 'a-pie' ? '🚶' : '🚗'}
                    </span>
                    <span className={`text-xs font-medium ${stop.traslado.includes('estadio') ? 'text-amber-700' : 'text-gray-500'}`}>
                      {stop.traslado}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer acciones */}
        <motion.div
          className="mt-6 flex gap-3 print:hidden"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {calendarUrl && (
            <motion.a href={calendarUrl}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#E8F5E9] text-[#1A4D2E] text-sm font-bold hover:bg-[#C8E6C9] transition-all"
              whileHover={{ scale: 1.02 }}
            >
              📅 Ver en calendario
            </motion.a>
          )}
          <motion.button
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-[#0D601E] to-[#1A4D2E] text-white text-sm font-bold hover:shadow-lg transition-all"
            whileHover={{ scale: 1.03, boxShadow: '0 8px 32px rgba(13,96,30,0.3)' }}
            whileTap={{ scale: 0.98 }}
          >
            <FiPrinter size={15} /> Imprimir itinerario
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
