"use client";
import React, { useState, useEffect, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaBookmark, FaRegBookmark } from 'react-icons/fa';
import {
  FiCalendar, FiClock, FiDollarSign, FiUsers, FiMapPin,
  FiZap, FiDownload,
} from 'react-icons/fi';
import AuthModal from '@/components/AuthModal';
import type { MapStop } from '@/components/ItineraryMap';
import {
  norm, matchesInterest, haversine,
  addMinutes, buildSchedule, MATCH_DAYS,
  generateItinerary as engineGenerateItinerary,
  pickAddStop, pickReplaceStop,
  dailySeed, rawToPlace,
  type Place, type Stop, type GenerateOptions, type Transporte,
} from '@/lib/ia-engine';

const ItineraryMap = dynamic(() => import('@/components/ItineraryMap'), { ssr: false });

const MXN_TO_USD = 17.50;

// ---- Calendar helpers ----
function getLocalDateStr(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getCurrentRoundedHour(): string {
  const now = new Date();
  const next = now.getMinutes() > 0 ? now.getHours() + 1 : now.getHours();
  return `${String(Math.min(next, 23)).padStart(2, '0')}:00`;
}
const ALL_START_TIMES = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// ---- Types ----
interface ItineraryMeta {
  title: string;
  budget: string;
  groupSize: string;
  duration: string;
}


const ESTADIO_AKRON: Place = {
  nombre: 'Llegada al Partido ⚽',
  categoria: 'Fútbol',
  direccion: 'Estadio Akron · Cto. J.V.C. 2800, Zapopan, Jalisco',
  tiempoEstancia: 120,
  costo: '',
  calificacion: '5',
  fotos: ['/api/img-proxy?k=estadio'],
  isMatch: true,
};

const CAMINO_AL_PARTIDO_BASE: Place = {
  nombre: 'Camino al Estadio Akron',
  categoria: 'Fútbol',
  direccion: 'Considera prever tráfico',
  tiempoEstancia: 120,
  costo: '',
  calificacion: '',
  fotos: [],
  isMatch: true,
  isCamino: true,
};

// ---- Helpers ----
function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ---- Interest options ----
const INTEREST_OPTIONS = [
  { id: 'cultura', name: 'Cultura', emoji: '🏛️' },
  { id: 'gastronomia', name: 'Gastronomía', emoji: '🍽️' },
  { id: 'arquitectura', name: 'Arquitectura', emoji: '🏗️' },
  { id: 'arte', name: 'Arte e historia', emoji: '🎨' },
  { id: 'cafeterias', name: 'Cafeterías', emoji: '☕' },
  { id: 'naturaleza', name: 'Naturaleza', emoji: '🌿' },
  { id: 'fotografia', name: 'Fotografía', emoji: '📷' },
  { id: 'compras', name: 'Compras', emoji: '🛍️' },
  { id: 'vida-nocturna', name: 'Clubs / Bar', emoji: '🍹' },
  { id: 'futbol', name: 'Fútbol', emoji: '⚽' },
];

const FOOD_PREFS = [
  { id: 'tradicional', name: 'Tapatío tradicional', emoji: '🌮', desc: 'Birria, torta ahogada, pozole' },
  { id: 'mix', name: 'Variado', emoji: '🍴', desc: 'Tradicional + internacional' },
  { id: 'vegetariano', name: 'Vegano / saludable', emoji: '🌱', desc: 'Opciones plant-based' },
];

// ---- Stagger variants ----
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 22 } },
};
const stopVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.07, type: 'spring' as const, stiffness: 240, damping: 20 },
  }),
};

// ---- Print styles ----
const printStyles = `
@media print {
  @page { margin: 1cm; size: A4; }
  body { background: white !important; font-family: Arial, Helvetica, sans-serif !important; }
  .print\\:hidden { display: none !important; }
  .print\\:block { display: block !important; }
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
    color: white !important;
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
  const [startTime, setStartTime] = useState(() => {
    const min = getCurrentRoundedHour();
    const available = ALL_START_TIMES.filter(t => t >= min);
    return available.length > 0 ? available[0] : '09:00';
  });
  const [duration, setDuration] = useState('dia-completo');
  const [budget, setBudget] = useState(1500);
  const [groupSize, setGroupSize] = useState(2);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [foodPreference, setFoodPreference] = useState('');
  const [attendsMatch, setAttendsMatch] = useState<boolean | null>(null);
  const [ritmo, setRitmo] = useState<'tranquilo' | 'normal' | 'activo'>('normal');
  const [transporte, setTransporte] = useState<Transporte>('taxi');
  const [isGenerating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [meta, setMeta] = useState<ItineraryMeta>({ title: '', budget: '', groupSize: '', duration: '' });
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('turista');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTrigger, setAuthTrigger] = useState<'save' | 'limit' | 'profile' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [savedItineraryId, setSavedItineraryId] = useState<string | null>(null);
  const [calendarUrl, setCalendarUrl] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [calendarView, setCalendarView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const calendarRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (selectedDate !== getLocalDateStr()) return;
    const min = getCurrentRoundedHour();
    const available = ALL_START_TIMES.filter(t => t >= min);
    if (available.length > 0) setStartTime(available[0]);
  }, [selectedDate]);

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
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {} // sin ubicación, se usa la del último lugar como fallback
    );
  }, []);

  // Botón atrás del navegador vuelve al formulario desde el itinerario
  useEffect(() => {
    const handlePopState = () => setShowResults(false);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  const downloadPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentW = pageW - margin * 2;

    // Header verde
    doc.setFillColor(26, 77, 46);
    doc.rect(0, 0, pageW, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('Pitzbol', margin, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Mundial 2026 Guadalajara', margin, 26);
    doc.setFontSize(10);
    doc.text(meta.title, pageW - margin, 22, { align: 'right' });

    let y = 46;

    stops.forEach((stop, i) => {
      if (y > 265) { doc.addPage(); y = 20; }

      // Circulo numerado
      doc.setFillColor(26, 77, 46);
      doc.circle(margin + 4, y - 2, 4.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(String(i + 1), margin + 4, y, { align: 'center' });

      // Horario
      doc.setTextColor(13, 96, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${stop.horaLlegada} - ${stop.horaSalida}`, margin + 12, y);

      // Nombre
      y += 6;
      doc.setTextColor(26, 77, 46);
      doc.setFontSize(12);
      const nameLines = doc.splitTextToSize(stop.place.nombre, contentW - 12);
      doc.text(nameLines, margin + 12, y);
      y += nameLines.length * 5.5;

      // Dirección
      if (stop.place.direccion) {
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const dirLines = doc.splitTextToSize(stop.place.direccion, contentW - 12);
        doc.text(dirLines, margin + 12, y);
        y += dirLines.length * 4.5;
      }

      // Costo
      if (stop.place.costo && stop.place.costo !== 'No disponible') {
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Costo aprox: ${stop.place.costo}`, margin + 12, y);
        y += 4.5;
      }

      // Duración
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(8);
      doc.text(`Tiempo de visita: ${stop.place.tiempoEstancia} min`, margin + 12, y);
      y += 4;

      // Línea separadora
      y += 4;
      if (i < stops.length - 1) {
        doc.setDrawColor(220, 220, 220);
        doc.line(margin + 12, y - 2, pageW - margin, y - 2);
        y += 4;
      }
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text('Generado por Pitzbol — ia.pitzbol.me', margin, doc.internal.pageSize.getHeight() - 8);

    const filename = `itinerario-pitzbol-${meta.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;
    doc.save(filename);
  };

  const handleGenerate = async () => {
    if (!selectedDate || selectedInterests.length < 2) {
      setGenerateError('Selecciona una fecha y al menos 2 intereses para continuar.');
      return;
    }
    const guestCount = parseInt(sessionStorage.getItem('pitzbol_guest_count') || '0');
    if (!userId && guestCount >= 1) {
      setAuthTrigger('limit');
      setShowAuthModal(true);
      return;
    }
    setGenerateError(null);
    setGenerating(true);
    const loadStart = Date.now();
    try {
      const res = await fetch('/api/places');
      const raw: Record<string, any>[] = await res.json();

      const places: Place[] = raw.map(rawToPlace).filter((p): p is Place => p !== null);

      if (places.length === 0) {
        setGenerateError('No encontramos lugares disponibles. Inténtalo de nuevo en unos momentos.');
        return;
      }

      // Memoria de sesión: cargar lugares ya vistos en esta sesión
      const seenRaw = sessionStorage.getItem('pitzbol_seen_places');
      const seenNames = new Set<string>(
        seenRaw ? (JSON.parse(seenRaw) as string[]).map((n: string) => n.toLowerCase()) : []
      );

      const engineOpts: GenerateOptions = {
        interests: selectedInterests,
        ritmo,
        startTime,
        budget,
        selectedDate,
        seed: dailySeed(),
        duration: duration as 'rapido' | 'medio-dia' | 'dia-completo',
        foodPreference,
        transporte,
        userLat: transporte === 'a-pie' ? (userLocation?.lat ?? 20.6736) : undefined,
        userLng: transporte === 'a-pie' ? (userLocation?.lng ?? -103.3440) : undefined,
        walkRadius: transporte === 'a-pie' ? (userLocation ? 2 : 3) : undefined,
        reservedMins: attendsMatch ? 240 : 0,
        seenNames,
      };

      const regularPlaces = engineGenerateItinerary(places, engineOpts);

      if (regularPlaces.length === 0) {
        setGenerateError('No encontramos lugares con esos filtros. Prueba con más intereses o aumenta el presupuesto.');
        return;
      }

      // Tarjetas de partido (UI — no son paradas de itinerario regular)
      const matchCards: Place[] = [];
      if (attendsMatch) {
        const matchInfo = MATCH_DAYS[selectedDate];
        if (matchInfo) {
          const caminoHora = addMinutes(matchInfo.hora, -120);
          matchCards.push({ ...CAMINO_AL_PARTIDO_BASE, forcedArrival: caminoHora });
          matchCards.push({ ...ESTADIO_AKRON, forcedArrival: matchInfo.hora });
        } else {
          matchCards.push(CAMINO_AL_PARTIDO_BASE);
          matchCards.push(ESTADIO_AKRON);
        }
      }

      const finalSelected = [...regularPlaces, ...matchCards];

      setAllPlaces(places);
      const schedule = buildSchedule(finalSelected, startTime, transporte);
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
      // Añadir entrada al historial para que el botón atrás del navegador funcione
      window.history.pushState({ itinerario: true }, '');

      // Guardar lugares mostrados en sessionStorage para evitar repeticiones
      const newSeen = new Set<string>(seenNames);
      regularPlaces.forEach(p => newSeen.add(p.nombre.toLowerCase()));
      // Máximo 40 nombres guardados; si se supera, limpia los más viejos
      const seenList = Array.from(newSeen).slice(-40);
      sessionStorage.setItem('pitzbol_seen_places', JSON.stringify(seenList));
      if (!userId) {
        const prev = parseInt(sessionStorage.getItem('pitzbol_guest_count') || '0');
        sessionStorage.setItem('pitzbol_guest_count', String(prev + 1));
      }
    } catch (error) {
      console.error(error);
      setGenerateError('Error al generar el itinerario. Inténtalo de nuevo.');
    } finally {
      const elapsed = Date.now() - loadStart;
      if (elapsed < 2000) await new Promise(r => setTimeout(r, 2000 - elapsed));
      setGenerating(false);
    }
  };

  const moveUp = (i: number) => {
    if (i === 0) return;
    const arr = [...stops]; [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    setStops(buildSchedule(arr.map(s => s.place), startTime, transporte));
  };

  const moveDown = (i: number) => {
    if (i === stops.length - 1) return;
    const arr = [...stops]; [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    setStops(buildSchedule(arr.map(s => s.place), startTime, transporte));
  };

  const removeStop = (i: number) => {
    const newPlaces = stops.filter((_, idx) => idx !== i).map(s => s.place);
    setStops(buildSchedule(newPlaces, startTime, transporte));
  };

  const addStop = () => {
    const currentPlaces = stops.map(s => s.place);
    const newPlace = pickAddStop(allPlaces, currentPlaces, {
      interests: selectedInterests,
      budget,
      selectedDate,
      startTime,
      seed: dailySeed(),
    });
    if (!newPlace) return;
    const regular = stops.filter(s => !s.place.isMatch).map(s => s.place);
    const match = stops.filter(s => s.place.isMatch).map(s => s.place);
    setStops(buildSchedule([...regular, newPlace, ...match], startTime, transporte));
  };

  const replaceStop = (i: number) => {
    const currentPlaces = stops.map(s => s.place);
    const newPlace = pickReplaceStop(allPlaces, currentPlaces, i, {
      interests: selectedInterests,
      budget,
      selectedDate,
      startTime,
      seed: dailySeed(),
    });
    if (!newPlace) return;
    const newPlaces = currentPlaces.map((p, idx) => idx === i ? newPlace : p);
    setStops(buildSchedule(newPlaces, startTime, transporte));
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
              className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F5F0E8]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.4 } }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center"
              >
                <Image
                  src="/logoPitzbol.png"
                  alt="Pitzbol"
                  fill
                  sizes="(max-width: 768px) 256px, 320px"
                  className="object-contain"
                  priority
                />
              </motion.div>

              <div className="relative -mt-8 md:-mt-10 z-10 text-center">
                <h3 className="text-xl md:text-3xl font-black text-[#1A4D2E] uppercase tracking-tighter leading-none">
                  Generando Itinerario
                </h3>
                <motion.p
                  className="text-[#769C7B] italic text-xs md:text-base font-medium mt-2 animate-pulse"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.8 }}
                >
                  Buscando los mejores lugares para ti...
                </motion.p>
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
          <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }}>
            <motion.div
              className="space-y-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {/* Fecha y hora */}
              <motion.div variants={cardVariants} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm font-bold text-[#1A4D2E] mb-4">
                  ¿Cuándo visitas?
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
                        {(selectedDate === getLocalDateStr()
                          ? ALL_START_TIMES.filter(t => t >= getCurrentRoundedHour())
                          : ALL_START_TIMES
                        ).map(t => (
                          <option key={t} value={t}>{formatTime12(t)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Duración</label>
                    <select value={duration} onChange={e => setDuration(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-100 rounded-xl text-sm bg-[#F7F9F4] text-gray-800 focus:outline-none focus:border-[#1A4D2E]">
                      <option value="rapido">Rápido</option>
                      <option value="medio-dia">Medio día</option>
                      <option value="dia-completo">Día completo</option>
                    </select>
                  </div>
                </div>
              </motion.div>

              {/* Grupo y presupuesto */}
              <motion.div variants={cardVariants} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm font-bold text-[#1A4D2E] mb-4">
                  Tu grupo
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
                  Estilo de viaje
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
                    ¿Qué te interesa?
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
                      ¿Qué tipo de comida?
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
                        <p className="text-xs text-amber-600">{matchInfo.partido} · {matchInfo.hora} hrs (CDMX)</p>
                      </div>
                    </div>
                    <p className="text-xs text-amber-700 mt-1 mb-3 italic">
                      🎉 Tip local: es tradición tapatía reunirse en La Minerva a festejar después del partido.
                    </p>
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

              {generateError && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3"
                >
                  <span className="mt-0.5 shrink-0">⚠️</span>
                  <span>{generateError}</span>
                </motion.div>
              )}
            </motion.div>
          </form>
        </div>
      </div>
    );
  }

  // ===== RESULTS =====
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#F7F9F4]">
      <style>{printStyles}</style>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onSuccess={handleAuthSuccess} />

      {/* Header resultado */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">

        {/* ── Lista de paradas ── */}
        <div className="w-full lg:w-[42%] lg:flex-shrink-0 lg:overflow-y-auto overflow-x-hidden px-3 sm:px-4 py-4">

        {/* Print header — visible solo al imprimir */}
        <div className="hidden print:block print-header mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span style={{ fontSize: 28 }}>⚽</span>
            <span className="print-logo">Pitzbol</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>· Mundial 2026 Guadalajara</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>{meta.title}</div>
        </div>

        {/* Barra de acciones */}
        <motion.div
          className="flex items-center gap-2 mb-3 print:hidden flex-wrap"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Guardar */}
          <motion.button
            onClick={() => {
              if (savedOk && savedItineraryId) unsaveItinerary();
              else if (!userId) { setAuthTrigger('save'); setShowAuthModal(true); }
              else saveItinerary();
            }}
            disabled={isSaving}
            title={savedOk ? 'Quitar guardado' : 'Guardar itinerario'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 border ${savedOk ? 'bg-[#E8F5E9] border-[#1A4D2E] text-[#1A4D2E]' : 'bg-white border-gray-200 text-gray-600 hover:border-[#1A4D2E] hover:text-[#1A4D2E]'}`}
            whileTap={{ scale: 0.95 }}
          >
            {isSaving
              ? <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-[#1A4D2E] rounded-full animate-spin" />
              : savedOk
                ? <><FaBookmark size={13} className="text-[#1A4D2E]" /><span className="hidden sm:inline">Guardado</span></>
                : <><FaRegBookmark size={13} /><span className="hidden sm:inline">Guardar</span></>
            }
          </motion.button>

          {/* Agregar lugar */}
          <button
            onClick={addStop}
            title="Agregar lugar"
            className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2 hover:border-[#1A4D2E] hover:text-[#1A4D2E] transition-colors text-gray-600"
          >
            <span className="text-xs font-medium text-gray-400">{stops.filter(s => !s.place.isMatch).length}</span>
            <span className="font-bold text-sm text-[#1A4D2E]">+</span>
            <span className="hidden sm:inline text-xs font-medium">Agregar lugar</span>
          </button>

          {/* Descargar PDF */}
          <motion.button
            onClick={() => downloadPDF()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1A4D2E] text-white text-xs font-bold hover:bg-[#0D601E] transition-all ml-auto"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            title="Descargar PDF"
          >
            <FiDownload size={14} />
            <span className="hidden sm:inline">Descargar PDF</span>
          </motion.button>
        </motion.div>

        {/* Meta del itinerario */}
        <motion.div
          className="hidden sm:block bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4 print:hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="text-base font-bold text-[#1A4D2E] capitalize">{meta.title}</h2>
        </motion.div>

        {/* Timeline */}
        <div className="space-y-2 md:space-y-3">
          {stops.map((stop, i) => {
            const next = stops[i + 1];
            const nearbyTip = (() => {
              if (!next || !stop.place.lat || !stop.place.lng || !next.place.lat || !next.place.lng) return null;
              if (stop.place.isMatch || stop.place.isCamino || next.place.isMatch || next.place.isCamino) return null;
              const dist = haversine(stop.place.lat, stop.place.lng, next.place.lat, next.place.lng);
              return dist <= 0.5 ? dist : null;
            })();
            return (
            <React.Fragment key={i}>
            <motion.div
              custom={i}
              variants={stopVariants}
              initial="hidden"
              animate="visible"
              className="flex gap-1.5 sm:gap-3"
            >
              {/* Indicador */}
              <div className="flex flex-col items-center shrink-0">
                <motion.div
                  className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white text-[10px] sm:text-xs font-black shrink-0 print-stop-num ${stop.place.isMatch ? 'bg-amber-500' : 'bg-[#1A4D2E]'}`}
                  whileHover={{ scale: 1.15 }}
                >
                  {i + 1}
                </motion.div>
                {i < stops.length - 1 && (
                  <div className="w-px flex-1 my-0.5 sm:my-1 bg-gray-100 min-h-[12px]" />
                )}
              </div>

              {/* Card */}
              {stop.place.isCamino ? (
                /* Tarjeta naranja: Camino al Estadio */
                <div className="flex-1 rounded-xl sm:rounded-2xl border-2 border-orange-300 bg-gradient-to-r from-orange-500 to-amber-500 overflow-hidden mb-1 shadow-md print-card">
                  <div className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
                    <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-lg sm:text-2xl">🚗</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 sm:gap-2 mb-0.5">
                        <span className="text-xs sm:text-sm font-black text-white">{formatTime12(stop.horaLlegada)}</span>
                        <span className="hidden sm:inline text-xs text-white/70">→ {formatTime12(stop.horaSalida)}</span>
                      </div>
                      <h3 className="font-black text-xs sm:text-base text-white line-clamp-2">{stop.place.nombre}</h3>
                      <p className="hidden sm:block text-xs text-white/80 mt-0.5">{stop.place.direccion}</p>
                    </div>
                  </div>
                </div>
              ) : stop.place.isMatch ? (
                /* Tarjeta del Estadio Akron */
                <div className="flex-1 rounded-xl sm:rounded-2xl border-2 border-amber-400 overflow-hidden mb-1 shadow-md print-card bg-[#0D1F14]">
                  <div className="flex">
                    {stop.place.fotos?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={stop.place.fotos?.[0]} alt="Estadio Akron"
                        className="hidden sm:block w-28 object-cover shrink-0 print:hidden"
                        style={{ maxHeight: 130 }}
                        referrerPolicy="no-referrer" />
                    )}
                    <div className="flex-1 p-4 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-black text-amber-400">{formatTime12(stop.horaLlegada)}</span>
                        <span className="text-xs text-white/50">→ {formatTime12(stop.horaSalida)}</span>
                      </div>
                      <h3 className="font-black text-base text-white leading-tight">{stop.place.nombre}</h3>
                      {matchInfo && (
                        <p className="text-xs font-bold text-amber-300 mt-1">⚽ {matchInfo.equipos}</p>
                      )}
                      <p className="text-xs text-white/60 mt-1 flex items-center gap-1">
                        <FiMapPin size={10} className="shrink-0" />
                        {stop.place.direccion}
                      </p>
                      <div className="mt-2 flex items-center gap-2 print:hidden">
                        <motion.button
                          onClick={() => {
                            const base = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.pitzbol.me';
                            window.open(`${base}/informacion/${encodeURIComponent('Estadio Akron, Guadalajara')}?from=itinerario`, '_blank', 'noopener,noreferrer');
                          }}
                          className="text-xs font-semibold text-amber-300 border border-amber-400/50 rounded-lg px-2.5 py-1 hover:bg-amber-400/20 transition-colors"
                          whileHover={{ scale: 1.03 }}
                        >
                          Ver más →
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
              /* Tarjeta normal de lugar */
              <div className="flex-1 rounded-xl border border-gray-100 bg-white overflow-hidden mb-1 print-card shadow-sm">
                <div className="flex items-stretch">
                  {stop.place.fotos?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={stop.place.fotos?.[0]} alt={stop.place.nombre}
                      className="w-20 sm:w-24 md:w-32 object-cover shrink-0 self-stretch print:hidden"
                      referrerPolicy="no-referrer" />
                  )}
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="text-sm font-black text-[#0D601E] leading-none">{formatTime12(stop.horaLlegada)}</span>
                      <span className="text-xs text-gray-400">→ {formatTime12(stop.horaSalida)}</span>
                      <span className="ml-auto text-xs text-gray-400 flex items-center gap-0.5 shrink-0">
                        <FiClock size={10} /> {stop.place.tiempoEstancia} min
                      </span>
                    </div>

                    <h3 className="font-bold text-sm leading-snug text-[#1A4D2E] line-clamp-2">{stop.place.nombre}</h3>

                    <div className="hidden sm:flex flex-wrap gap-1 mt-1.5">
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

                    <p className="hidden sm:flex text-xs text-gray-400 mt-1.5 items-start gap-1">
                      <FiMapPin size={10} className="shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{stop.place.direccion}</span>
                    </p>

                    {stop.place.costo && stop.place.costo !== 'No disponible' && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <FiDollarSign size={10} className={/gratis/i.test(stop.place.costo) ? 'text-[#0D601E]' : 'text-gray-400'} />
                        <span className={`text-xs font-medium ${/gratis/i.test(stop.place.costo) ? 'text-[#0D601E] font-bold' : 'text-gray-500'}`}>
                          {stop.place.costo}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 mt-2 print:hidden">
                      <motion.button
                        onClick={() => {
                          const base = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.pitzbol.me';
                          window.location.href = `${base}/informacion/${encodeURIComponent(stop.place.nombre)}?from=itinerario`;
                        }}
                        className="text-xs font-semibold text-[#0D601E] border border-[#81C784] rounded-lg px-2 py-1 hover:bg-[#E8F5E9] transition-colors"
                        whileHover={{ scale: 1.03 }}
                      >
                        Ver →
                      </motion.button>
                      <div className="ml-auto flex gap-1">
                        <button onClick={() => moveUp(i)} disabled={i === 0} title="Subir"
                          className="w-7 h-7 rounded-lg border border-gray-100 text-gray-400 text-xs disabled:opacity-25 hover:border-[#1A4D2E] hover:text-[#1A4D2E] transition-colors flex items-center justify-center">↑</button>
                        <button onClick={() => moveDown(i)} disabled={i === stops.length - 1} title="Bajar"
                          className="w-7 h-7 rounded-lg border border-gray-100 text-gray-400 text-xs disabled:opacity-25 hover:border-[#1A4D2E] hover:text-[#1A4D2E] transition-colors flex items-center justify-center">↓</button>
                        <button onClick={() => replaceStop(i)} title="Sugerir otro"
                          className="w-7 h-7 rounded-lg border border-[#81C784] text-[#0D601E] text-xs hover:bg-[#E8F5E9] transition-colors flex items-center justify-center">↺</button>
                        <button onClick={() => removeStop(i)} title="Eliminar"
                          className="w-7 h-7 rounded-lg border border-red-100 text-red-400 text-xs hover:bg-red-50 transition-colors flex items-center justify-center">✕</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )} {/* fin ternario isMatch/normal */}
            </motion.div>

            {nearbyTip !== null && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F0F7F0] border border-[#81C784] rounded-xl text-xs text-[#1A4D2E] print:hidden">
                <span>📍</span>
                <span>Al visitar <strong>{stop.place.nombre}</strong> puedes pasar a <strong>{next!.place.nombre}</strong> — está a solo {Math.round(nearbyTip * 1000)} metros.</span>
              </div>
            )}
            </React.Fragment>
          );
          })}
        </div>

        {/* Footer acciones */}
        <motion.div
          className="mt-6 flex gap-3 print:hidden"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <motion.a
            href={`${process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://www.pitzbol.me'}/itinerarios`}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#E8F5E9] text-[#1A4D2E] text-sm font-bold hover:bg-[#C8E6C9] transition-all"
            whileHover={{ scale: 1.02 }}
          >
            🗺️ Ver mis itinerarios
          </motion.a>
          <motion.button
            onClick={handleGenerate}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-[#1A4D2E] text-[#1A4D2E] text-sm font-bold hover:bg-[#E8F5E9] transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            title="Generar un itinerario completamente nuevo"
          >
            <span className="text-base sm:hidden">↺</span>
            <span className="hidden sm:inline">↺ Generar de nuevo</span>
          </motion.button>
          <motion.button
            onClick={() => downloadPDF()}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-[#0D601E] to-[#1A4D2E] text-white text-sm font-bold hover:shadow-lg transition-all"
            whileHover={{ scale: 1.03, boxShadow: '0 8px 32px rgba(13,96,30,0.3)' }}
            whileTap={{ scale: 0.98 }}
          >
            <FiDownload size={16} className="sm:hidden" />
            <FiDownload size={15} className="hidden sm:inline" />
            <span className="hidden sm:inline">Descargar PDF</span>
          </motion.button>
        </motion.div>

        </div>{/* fin lista de paradas */}

        {/* ── Mapa: abajo en móvil/tablet, derecha en desktop ── */}
        <div className="w-full h-[300px] lg:flex-1 lg:h-full print:hidden">
          {(() => {
            const mapStops: MapStop[] = stops
              .map((s, originalIdx) => ({ s, originalIdx }))
              .filter(({ s }) => s.place.lat && s.place.lng)
              .map(({ s, originalIdx }) => ({
                lat: s.place.lat!,
                lng: s.place.lng!,
                nombre: s.place.nombre,
                foto: s.place.fotos?.[0],
                num: originalIdx + 1,
                isMatch: s.place.isMatch,
                isCamino: s.place.isCamino,
              }));
            if (mapStops.filter(s => !s.isCamino).length === 0) {
              return (
                <div className="w-full h-full flex items-center justify-center bg-[#F0F7F0] text-[#1A4D2E]/40 text-sm">
                  Sin coordenadas para mostrar en mapa
                </div>
              );
            }
            return <ItineraryMap stops={mapStops} userLocation={userLocation} />;
          })()}
        </div>

      </div>{/* fin flex col */}

      {/* Modal detalle de lugar */}
      <AnimatePresence>
        {selectedStop && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedStop(null)}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              {selectedStop.place.fotos?.[0] ? (
                <div className="relative w-full h-48 sm:h-56">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedStop.place.fotos[0]}
                    alt={selectedStop.place.nombre}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <button
                    onClick={() => setSelectedStop(null)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors text-sm"
                  >✕</button>
                </div>
              ) : (
                <div className="relative flex items-center justify-center h-20 bg-[#1A4D2E]">
                  <span className="text-4xl">📍</span>
                  <button
                    onClick={() => setSelectedStop(null)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/40 transition-colors text-sm"
                  >✕</button>
                </div>
              )}

              <div className="p-5">
                <h2 className="text-lg font-black text-[#1A4D2E] leading-snug mb-2">
                  {selectedStop.place.nombre}
                </h2>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {INTEREST_OPTIONS.filter(opt =>
                    selectedInterests.includes(opt.id) && matchesInterest(selectedStop.place.categoria, opt.id)
                  ).map(opt => (
                    <span key={opt.id} className="text-xs font-semibold bg-[#E8F5E9] text-[#1A4D2E] px-2 py-0.5 rounded-full">
                      {opt.emoji} {opt.name}
                    </span>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <FiClock size={14} className="text-[#1A4D2E] shrink-0" />
                    <span>{formatTime12(selectedStop.horaLlegada)} → {formatTime12(selectedStop.horaSalida)}</span>
                    <span className="text-gray-400 text-xs">({selectedStop.place.tiempoEstancia} min)</span>
                  </div>

                  {selectedStop.place.direccion && (
                    <div className="flex items-start gap-2 text-gray-600">
                      <FiMapPin size={14} className="text-[#1A4D2E] shrink-0 mt-0.5" />
                      <span className="text-xs leading-snug">{selectedStop.place.direccion}</span>
                    </div>
                  )}

                  {selectedStop.place.horaApertura && selectedStop.place.horaCierre && (
                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                      <span>🕐</span>
                      <span>Abre {selectedStop.place.horaApertura} – cierra {selectedStop.place.horaCierre}</span>
                    </div>
                  )}

                  {selectedStop.place.costo && selectedStop.place.costo !== 'No disponible' && (
                    <div className="flex items-center gap-2">
                      <FiDollarSign size={14} className={/gratis/i.test(selectedStop.place.costo) ? 'text-[#0D601E]' : 'text-gray-400'} />
                      <span className={`text-sm font-medium ${/gratis/i.test(selectedStop.place.costo) ? 'text-[#0D601E] font-bold' : 'text-gray-600'}`}>
                        {selectedStop.place.costo}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedStop(null)}
                  className="mt-5 w-full py-3 rounded-2xl bg-[#1A4D2E] text-white font-bold text-sm hover:bg-[#0D601E] transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
