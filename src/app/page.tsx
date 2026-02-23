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
      // Construir prompt para la IA en el VPS
      const prompt = `Dame un itinerario de 1 día en Guadalajara con presupuesto de $${budget} MXN. 
      Intereses: ${selectedInterests.join(", ")}. 
      Ubicación de partida: La Minerva.
      Genera 2 opciones de itinerarios en JSON con estructura: titulo, presupuesto_total, plan_detallado (array de hora, actividad, tiempo_estancia, traslado_proximo), descripcion, tips.`;

      // Conectar al backend del VPS
      const response = await fetch('http://69.30.204.56:3001/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const data = await response.json();
      console.log("Respuesta de la IA:", data);

      if (!data.success) {
        throw new Error(data.msg || "Error generando itinerario");
      }

      // NORMALIZACIÓN: Parseamos la respuesta de Ollama
      let rawItinerary;
      
      try {
        // Intentar parsear como JSON
        const parsed = JSON.parse(data.output);
        rawItinerary = parsed.itinerarios?.[0] || parsed.opcion_1 || parsed;
      } catch {
        // Si no es JSON válido, usar la respuesta cruda
        rawItinerary = {
          titulo: "Tu Ruta PitzBol",
          presupuesto_total: budget,
          plan_detallado: [],
          descripcion: data.output,
          tips: "Disfruta tu itinerario personalizado en Guadalajara"
        };
      }

      const fixedData = {
        titulo: rawItinerary.titulo || "Tu Ruta PitzBol",
        presupuesto_total: String(rawItinerary.presupuesto_total || budget),
        plan_detallado: rawItinerary.plan_detallado || [],
        descripcion: rawItinerary.descripcion || "Itinerario personalizado para tu visita.",
        tips: rawItinerary.tips || "¡Disfruta Guadalajara!"
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