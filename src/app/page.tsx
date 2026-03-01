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
  const [showForm, setShowForm] = useState(false);

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
    <div className="min-h-screen bg-gradient-to-br from-[#FDFCF9] via-[#F6F0E6] to-[#F0E8DC]">
      {/* HERO SECTION */}
      {!showForm && !itinerary && (
        <section className="min-h-[85vh] flex items-center justify-center px-4 py-20 animate-in fade-in duration-1000">
          <div className="max-w-2xl text-center space-y-8">
            {/* LOGO Y NOMBRE */}
            <div className="animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-700 delay-100">
              <div className="flex justify-center mb-6">
                <div className="text-7xl md:text-8xl font-black drop-shadow-lg">
                  PITZ<span className="text-[#F00808]">BOL</span>
                </div>
              </div>
              <h2 className="text-xl md:text-2xl text-[#1A4D2E] font-semibold tracking-wide">
                Tu Asistente de Viaje en Guadalajara
              </h2>
            </div>

            {/* DESCRIPCIÓN */}
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200">
              <p className="text-lg text-gray-700 leading-relaxed">
                Bienvenido a <span className="font-bold text-[#1A4D2E]">PitzBot</span>, tu compañero de IA para descubrir Guadalajara
              </p>
              <p className="text-gray-600">
                Crea itinerarios personalizados basados en tu presupuesto e intereses. Desde gastronomía hasta fútbol, ¡nosotros te guiamos!
              </p>
            </div>

            {/* CTA BUTTON */}
            <button
              onClick={() => {
                setShowForm(true);
                setTimeout(() => {
                  document.querySelector("#itinerary-form")?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              className="inline-flex items-center gap-3 px-8 py-5 bg-[#1A4D2E] text-white font-bold text-lg rounded-full hover:bg-[#0D601E] transition-all duration-300 shadow-xl hover:shadow-2xl group animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300"
            >
              <span className="text-2xl">⚡</span>
              Crear Itinerario con IA
              <span className="text-xl group-hover:translate-x-1 transition-transform">→</span>
            </button>

            {/* FEATURES */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 pt-12 border-t border-gray-300/30 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
              <div className="p-4">
                <p className="text-sm text-[#1A4D2E] font-semibold">⚡ Instantáneo</p>
                <p className="text-xs text-gray-600">Rutas en segundos</p>
              </div>
              <div className="p-4">
                <p className="text-sm text-[#1A4D2E] font-semibold">🎯 Personalizado</p>
                <p className="text-xs text-gray-600">Según tu presupuesto</p>
              </div>
              <div className="p-4">
                <p className="text-sm text-[#1A4D2E] font-semibold">🤖 IA Inteligente</p>
                <p className="text-xs text-gray-600">Recomendaciones únicas</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FORMULARIO */}
      <div 
        className={`${showForm || itinerary ? "py-16 px-4 animate-in fade-in duration-600" : "opacity-0"}`}
        id="itinerary-form"
      >
        {(showForm || itinerary) && (
          <div className="max-w-2xl mx-auto">
            {/* FORMULARIO */}
            {!itinerary && (
              <div className="bg-white p-8 md:p-12 rounded-3xl border border-gray-100 shadow-xl space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
                <div>
                  <h3 className="text-2xl font-bold text-[#1A4D2E] mb-2">Cuéntame sobre tu viaje</h3>
                  <p className="text-gray-600 text-sm">Personalizaremos tu itinerario según tus preferencias</p>
                </div>

                {/* PRESUPUESTO */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-bold text-[#1A4D2E]">Presupuesto</label>
                    <span className="text-lg font-bold text-[#F00808] bg-[#F6F0E6] px-4 py-1 rounded-full">
                      ${budget.toLocaleString()} MXN
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="500" 
                    max="10000" 
                    step="100" 
                    value={budget}
                    onChange={(e) => setBudget(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1A4D2E]"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>$500</span>
                    <span>$10,000</span>
                  </div>
                </div>

                {/* INTERESES */}
                <div>
                  <label className="block text-sm font-bold text-[#1A4D2E] mb-4">¿Qué te interesa?</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {CATEGORIAS.map(cat => (
                      <button
                        key={cat}
                        onClick={() => toggleInterest(cat)}
                        className={`px-4 py-3 rounded-xl font-semibold transition-all border-2 text-sm hover:scale-105 active:scale-95 ${
                          selectedInterests.includes(cat) 
                          ? "bg-[#1A4D2E] border-[#1A4D2E] text-white shadow-lg" 
                          : "bg-[#F6F0E6] border-[#1A4D2E]/20 text-[#1A4D2E] hover:border-[#1A4D2E]"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* BOTÓN GENERAR */}
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full bg-[#1A4D2E] hover:bg-[#0D601E] text-white py-4 rounded-2xl font-bold text-lg transition-all disabled:opacity-50 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⚙️</span>
                      Generando tu itinerario...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span className="text-xl">⚡</span>
                      Generar Itinerario
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* RESULTADO */}
            {itinerary && (
              <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
                <ItineraryCard data={itinerary} />
                <button
                  onClick={() => {
                    setShowForm(false);
                    setItinerary(null);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full mt-6 px-6 py-3 border-2 border-[#1A4D2E] text-[#1A4D2E] font-bold rounded-xl hover:bg-[#F6F0E6] transition-all"
                >
                  Crear otro itinerario
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}