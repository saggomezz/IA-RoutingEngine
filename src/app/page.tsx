// src/app/page.tsx
'use client';
import ItineraryCard from '@/components/ItineraryCard';
import { useState } from 'react';

const CATEGORIAS = ["Gastronomía", "Cultura", "Fútbol", "Vida Nocturna", "Museos", "Naturaleza"];

export default function Home() {
  const [itinerary, setItinerary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [budget, setBudget] = useState(2000);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(["Cultura"]);

  const toggleInterest = (cat: string) => {
    setSelectedInterests(prev => 
      prev.includes(cat) ? prev.filter(i => i !== cat) : [...prev, cat]
    );
  };

  const handleGenerate = async () => {
    if (selectedInterests.length === 0) return alert("Selecciona al menos un interés");
    
    setLoading(true);
    setItinerary(null);
    try {
      // Usar la API local de itinerarios
      const response = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget: budget,
          interests: selectedInterests,
          location: 'La Minerva'
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
    <div className="min-h-screen bg-[#fafafa] py-16 px-4">
      <div className="max-w-md mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter">PitzBol<span className="text-emerald-800">.</span></h1>
          <p className="text-gray-500 text-sm italic mt-2">IA</p>
        </header>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-8">
          <div>
            <label className="block text-[13px] font-bold text-gray-400  mb-4">
              Presupuesto: <span className="text-emerald-900 text-sm">${budget} MXN</span>
            </label>
            <input type="range" min="500" max="10000" step="500" value={budget}
              onChange={(e) => setBudget(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-emerald-900"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">
              ¿Qué te interesa?
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
          
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-emerald-950 text-emerald-50 py-4 rounded-2xl font-bold hover:bg-emerald-900 transition-all disabled:opacity-50 shadow-xl shadow-emerald-900/20"
          >
            {loading ? 'Analizando rutas...' : 'Generar Itinerario'}
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