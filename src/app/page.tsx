// src/app/page.tsx
'use client';
import ItineraryCard from '@/components/ItineraryCard';
import { useState } from 'react';

const CATEGORIAS = ["Gastronomía", "Cultura", "Fútbol", "Vida Nocturna", "Museos", "Naturaleza"];
const COMIDAS = ["Tacos", "Tortas Ahogadas", "Carne en su Jugo", "Birria", "Pozole", "Elote", "Quesadillas"];
const HORAS = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"];

export default function Home() {
  const [itinerary, setItinerary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [budget, setBudget] = useState(2000);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(["Cultura"]);
  const [selectedDate, setSelectedDate] = useState('');
  const [startTime, setStartTime] = useState('10:00 AM');
  const [attendMatch, setAttendMatch] = useState('');
  const [selectedFood, setSelectedFood] = useState<string[]>([]);
  const [groupSize, setGroupSize] = useState(2);

  const toggleInterest = (cat: string) => {
    setSelectedInterests(prev => 
      prev.includes(cat) ? prev.filter(i => i !== cat) : [...prev, cat]
    );
  };

  const toggleFood = (food: string) => {
    setSelectedFood(prev => 
      prev.includes(food) ? prev.filter(f => f !== food) : [...prev, food]
    );
  };

  // Verificar si hay partido hoy (simulado)
  const isMatchDay = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    return dayOfWeek === 0 || dayOfWeek === 6; // Fin de semana = posible partido
  };

  const handleGenerate = async () => {
    if (selectedInterests.length === 0) return alert("Selecciona al menos un interés");
    if (!selectedDate) return alert("Selecciona una fecha");
    if (selectedInterests.includes("Gastronomía") && selectedFood.length === 0) {
      return alert("Selecciona al menos una comida preferida");
    }
    
    setLoading(true);
    setItinerary(null);
    try {
      const response = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget: budget,
          interests: selectedInterests,
          location: 'La Minerva',
          date: selectedDate,
          startTime: startTime,
          attendMatch: attendMatch,
          preferredFood: selectedFood,
          groupSize: groupSize
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const data = await response.json();
      console.log("Respuesta de la IA:", data);

      if (data.error) {
        throw new Error(data.error || "Error generando itinerario");
      }

      const fixedData = {
        titulo: data.titulo || "Tu Ruta PitzBol",
        presupuesto_total: String(data.presupuesto_total || `${budget} MXN`),
        plan_detallado: data.plan_detallado || [],
        descripcion: data.descripcion || "Itinerario personalizado para tu visita.",
        tips: data.tips || "¡Disfruta Guadalajara!"
      };

      setItinerary(fixedData);
      
    } catch (error) {
      console.error("Error al renderizar:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] py-16 px-4" id="itinerary-form">
      <div className="max-w-md mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter">PitzBol<span className="text-emerald-800">.</span></h1>
          <p className="text-gray-500 text-sm italic mt-2">IA de Itinerarios</p>
        </header>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-8">
          
          {/* Sección Calendario */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">
              📅 Fecha de tu visita
            </label>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-900/20 focus:border-emerald-900"
            />
          </div>

          {/* Hora de inicio */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">
              🕐 Hora de inicio
            </label>
            <select 
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-900/20 focus:border-emerald-900"
            >
              {HORAS.map(hora => (
                <option key={hora} value={hora}>{hora}</option>
              ))}
            </select>
          </div>

          {/* Tamaño del grupo */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">
              👥 Tamaño del grupo: <span className="text-emerald-900 text-sm">{groupSize} persona{groupSize > 1 ? 's' : ''}</span>
            </label>
            <input type="range" min="1" max="10" value={groupSize}
              onChange={(e) => setGroupSize(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-emerald-900"
            />
          </div>

          {/* Presupuesto */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">
              💰 Presupuesto: <span className="text-emerald-900 text-sm">${budget} MXN</span>
            </label>
            <input type="range" min="500" max="10000" step="500" value={budget}
              onChange={(e) => setBudget(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-emerald-900"
            />
          </div>

          {/* Intereses */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">
              ❤️ ¿Qué te interesa?
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS.map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleInterest(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                    selectedInterests.includes(cat) 
                    ? "bg-emerald-950 border-emerald-950 text-white shadow-md" 
                    : "bg-white border-gray-200 text-gray-500 hover:border-emerald-800"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Pregunta sobre partido (si es fin de semana) */}
          {isMatchDay() && (
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">
                ⚽ ¿Te interesa asistir a un partido hoy?
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setAttendMatch('si')}
                  className={`flex-1 p-3 rounded-xl text-sm font-semibold transition-all ${
                    attendMatch === 'si' 
                    ? "bg-emerald-950 text-white" 
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Sí, me interesa
                </button>
                <button
                  onClick={() => setAttendMatch('no')}
                  className={`flex-1 p-3 rounded-xl text-sm font-semibold transition-all ${
                    attendMatch === 'no' 
                    ? "bg-emerald-950 text-white" 
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  No, prefiero otro plan
                </button>
              </div>
            </div>
          )}

          {/* Preferencias gastronómicas (si seleccionó Gastronomía) */}
          {selectedInterests.includes("Gastronomía") && (
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">
                🍴 ¿Qué comidas te gustan?
              </label>
              <div className="flex flex-wrap gap-2">
                {COMIDAS.map(comida => (
                  <button
                    key={comida}
                    onClick={() => toggleFood(comida)}
                    className={`px-3 py-2 rounded-full text-xs font-semibold transition-all border ${
                      selectedFood.includes(comida) 
                      ? "bg-orange-600 border-orange-600 text-white shadow-md" 
                      : "bg-white border-gray-200 text-gray-500 hover:border-orange-500"
                    }`}
                  >
                    {comida}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <button
            onClick={handleGenerate}
            disabled={loading || !selectedDate}
            className="w-full bg-emerald-950 text-emerald-50 py-4 rounded-2xl font-bold hover:bg-emerald-900 transition-all disabled:opacity-50 shadow-xl shadow-emerald-900/20"
          >
            {loading ? 'Analizando rutas...' : 'Generar Itinerario Personalizado'}
          </button>
        </div>

        {/* Los resultados aparecen aquí abajo */}
        {itinerary && (
          <div className="mt-10 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            <ItineraryCard data={itinerary} />
          </div>
        )}
      </div>
    </div>
  );
}