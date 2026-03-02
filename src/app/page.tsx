"use client";
import { useState } from "react";
import ItineraryCard from "../components/ItineraryCard";
import {
  FaBuilding, FaCamera, FaFutbol, FaLandmark,
  FaMoon, FaMountain, FaMusic, FaPalette, 
  FaShoppingBag, FaStore, FaTree, FaUtensils
} from "react-icons/fa";

export default function HomePage() {
  // Estados principales
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("09:00");
  const [duration, setDuration] = useState<string>("dia-completo");
  const [budget, setBudget] = useState<number>(1500);
  const [groupSize, setGroupSize] = useState<number>(2);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [foodPreference, setFoodPreference] = useState<string>("");
  const [isGenerating, setGenerating] = useState<boolean>(false);
  const [itineraries, setItineraries] = useState<any[]>([]);
  const [matchDay, setMatchDay] = useState<boolean>(false);

  // Opciones de intereses (usando los mismos del Frontend)
  const interestOptions = [
    { id: "futbol", name: "Fútbol", Icon: FaFutbol, color: "from-green-600 to-green-800" },
    { id: "gastronomia", name: "Gastronomía", Icon: FaUtensils, color: "from-orange-500 to-red-500" },
    { id: "vida-nocturna", name: "Vida Nocturna", Icon: FaMoon, color: "from-indigo-600 to-purple-700" },
    { id: "cultura", name: "Cultura", Icon: FaLandmark, color: "from-blue-500 to-indigo-600" },
    { id: "compras", name: "Compras", Icon: FaShoppingBag, color: "from-pink-500 to-rose-500" },
    { id: "naturaleza", name: "Naturaleza", Icon: FaTree, color: "from-green-500 to-emerald-600" },
    { id: "aventura", name: "Aventura", Icon: FaMountain, color: "from-orange-600 to-red-600" },
    { id: "fotografia", name: "Fotografía", Icon: FaCamera, color: "from-cyan-500 to-blue-500" },
    { id: "arquitectura", name: "Arquitectura", Icon: FaBuilding, color: "from-gray-600 to-gray-800" },
    { id: "musica", name: "Música", Icon: FaMusic, color: "from-purple-600 to-pink-600" },
    { id: "arte", name: "Arte e Historia", Icon: FaPalette, color: "from-purple-500 to-pink-500" },
    { id: "mercados", name: "Mercados Locales", Icon: FaStore, color: "from-yellow-600 to-orange-600" }
  ];

  const foodPreferences = [
    { id: "tradicional", name: "100% Tradicional", desc: "Solo comida típica tapatía" },
    { id: "mix", name: "Variado", desc: "Tradicional + internacional" },
    { id: "internacional", name: "Internacional", desc: "Comida familiar/internacional" },
    { id: "vegetariano", name: "Vegetariano", desc: "Opciones sin carne" },
  ];

  // Función para cargar datos desde CSV
  const loadPlaces = async () => {
    try {
      const response = await fetch('/datosLugares.csv');
      const csvText = await response.text();
      
      const lines = csvText.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      return lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const place: any = {};
        headers.forEach((header, index) => {
          place[header] = values[index] || '';
        });
        return place;
      });
    } catch (error) {
      console.error('Error loading places:', error);
      return [];
    }
  };

  // Función para generar itinerario
  const generateItinerary = async () => {
    if (!selectedDate || selectedInterests.length === 0) {
      alert('Por favor completa toda la información requerida');
      return;
    }

    setGenerating(true);
    
    try {
      const places = await loadPlaces();
      console.log(`Loaded ${places.length} places from CSV`);
      
      // Filtrar por intereses seleccionados  
      const filteredPlaces = places.filter(place => {
        return selectedInterests.some(interest => {
          const category = place.Categoria?.toLowerCase() || '';
          const tipo = place.Tipo?.toLowerCase() || '';
          
          switch (interest) {
            case 'futbol':
              return category.includes('deportes') || category.includes('futbol') || tipo.includes('estadio');
            case 'gastronomia':
              return category.includes('restaurante') || category.includes('comida') || tipo.includes('restaurante');
            case 'vida-nocturna':
              return category.includes('bar') || category.includes('cantina') || category.includes('nocturna');
            case 'cultura':
              return category.includes('museo') || category.includes('cultural') || category.includes('teatro');
            case 'naturaleza':
              return category.includes('parque') || category.includes('natural') || category.includes('verde');
            case 'compras':
              return category.includes('comercial') || category.includes('mercado') || category.includes('tienda');
            case 'arquitectura':
              return category.includes('historico') || category.includes('arquitectura') || tipo.includes('edificio');
            case 'fotografia':
              return category.includes('mirador') || category.includes('vista') || tipo.includes('panoramico');
            case 'arte':
              return category.includes('arte') || category.includes('galeria') || category.includes('cultural');
            case 'aventura':
              return category.includes('aventura') || category.includes('extremo') || tipo.includes('actividad');
            case 'musica':
              return category.includes('musica') || categoria.includes('concierto') || tipo.includes('musical');
            case 'mercados':
              return category.includes('mercado') || tipo.includes('mercado') || category.includes('local');
            default:
              return false;
          }
        });
      });

      console.log(`Filtered to ${filteredPlaces.length} places based on interests: ${selectedInterests.join(', ')}`);
      
      // Seleccionar lugares según duración
      let maxPlaces = 3;
      if (duration === 'medio-dia') maxPlaces = 4;
      if (duration === 'dia-completo') maxPlaces = 6;
      
      const selectedPlaces = filteredPlaces
        .sort(() => Math.random() - 0.5)
        .slice(0, maxPlaces);

      // Generar itinerario
      const newItinerary = {
        title: `Itinerario Mundial Guadalajara - ${new Date(selectedDate).toLocaleDateString('es-ES')}`,
        date: selectedDate,
        duration: duration === 'rapido' ? '3 horas' : duration === 'medio-dia' ? '6 horas' : '10 horas',
        budget: `$${budget} MXN por persona`,
        groupSize: `${groupSize} persona${groupSize > 1 ? 's' : ''}`,
        locations: selectedPlaces.map((place, index) => ({
          name: place.Nombre || `Lugar ${index + 1}`,
          address: place.Direccion || 'Dirección no disponible',
          duration: index === 0 ? '1.5 hrs' : index === selectedPlaces.length - 1 ? '2 hrs' : '1 hr',
          cost: place.Precio || '$50-200 MXN',
          rating: place.Rating ? parseFloat(place.Rating) : (4 + Math.random()).toFixed(1),
          note: place.Descripcion || `Una experiencia única para disfrutar ${selectedInterests.map(i => interestOptions.find(opt => opt.id === i)?.name).filter(Boolean).join(', ').toLowerCase()}.`,
          category: place.Categoria || 'General',
          type: place.Tipo || 'Atracción',
        }))
      };

      setItineraries([newItinerary]);
    } catch (error) {
      console.error('Error generating itinerary:', error);
      alert('Hubo un error al generar tu itinerario. Inténtalo de nuevo.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadPDF = () => {
    // Crear contenido del PDF
    const content = itineraries.map(itinerary => {
      let pdfContent = `ITINERARIO MUNDIAL GUADALAJARA\n`;
      pdfContent += `${itinerary.title}\n`;
      pdfContent += `Duración: ${itinerary.duration}\n\n`;
      
      itinerary.locations.forEach((location: any, index: number) => {
        pdfContent += `${index + 1}. ${location.name}\n`;
        pdfContent += `   📍 ${location.address}\n`;
        pdfContent += `   ⏱️ ${location.duration} | 💰 ${location.cost} | ⭐ ${location.rating}/5\n`;
        pdfContent += `   📝 ${location.note}\n\n`;
      });
      
      return pdfContent;
    }).join('\n\n');

    // Crear enlace de descarga
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Itinerario_Mundial_Guadalajara_${selectedDate || 'personalizado'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Navbar estático */}
      <nav className="bg-[#1A4D2E] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold text-white">Pitzbol</span>
            </div>
            <div className="flex items-center">
              <a
                href="http://69.30.204.56:3000"
                className="text-white hover:text-[#81C784] px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Volver a Pitzbol
              </a>
            </div>
          </div>
        </div>
      </nav>
      
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Header Minimalista */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-[#1A4D2E] tracking-tighter mb-2">
            PitzBot<span className="text-[#E53935]">.</span>
          </h1>
          <p className="text-[#81C784] text-sm italic">
            IA de Itinerarios Mundial 2026
          </p>
        </div>

        <form 
          id="itinerary-form"
          onSubmit={(e) => { e.preventDefault(); generateItinerary(); }} 
          className="max-w-md mx-auto bg-white p-8 rounded-3xl border border-[#E0F2F1] shadow-sm space-y-6"
        >
          {/* Información Básica */}
          <div>
            <label className="block text-[10px] font-bold text-[#81C784] uppercase tracking-[0.2em] mb-4">
              Información Básica
            </label>
            
            <div className="space-y-4">
              {/* Fecha */}
              <div>
                <label className="block text-[10px] font-bold text-[#81C784] uppercase tracking-[0.2em] mb-2">
                  Fecha de tu visita
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setMatchDay(new Date(e.target.value).getDay() % 6 === 0);
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full p-3 border border-[#E0F2F1] rounded-xl text-sm focus:ring-2 focus:ring-[#0D601E]/20 focus:border-[#0D601E] transition-all"
                  required
                />
              </div>

              {/* Hora */}
              <div>
                <label className="block text-[10px] font-bold text-[#81C784] uppercase tracking-[0.2em] mb-2">
                  Hora de inicio
                </label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-3 border border-[#E0F2F1] rounded-xl text-sm focus:ring-2 focus:ring-[#0D601E]/20 focus:border-[#0D601E] transition-all"
                >
                  <option value="09:00">9:00 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="13:00">1:00 PM</option>
                  <option value="14:00">2:00 PM</option>
                  <option value="15:00">3:00 PM</option>
                  <option value="16:00">4:00 PM</option>
                </select>
              </div>

              {/* Duración */}
              <div>
                <label className="block text-[10px] font-bold text-[#81C784] uppercase tracking-[0.2em] mb-2">
                  Duración del tour
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full p-3 border border-[#E0F2F1] rounded-xl text-sm focus:ring-2 focus:ring-[#0D601E]/20 focus:border-[#0D601E] transition-all"
                >
                  <option value="rapido">Rápido (2-3 hrs)</option>
                  <option value="medio-dia">Medio día (4-6 hrs)</option>
                  <option value="dia-completo">Día completo (8-10 hrs)</option>
                </select>
              </div>
            </div>

            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-[10px] font-bold text-[#81C784] uppercase tracking-[0.2em] mb-2">
                  Presupuesto: <span className="text-[#1A4D2E] text-sm">${budget} MXN</span>
                </label>
                <input
                  type="range"
                  min="200"
                  max="3000"
                  step="100"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#E0F2F1] rounded-lg appearance-none cursor-pointer accent-[#0D601E]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#81C784] uppercase tracking-[0.2em] mb-2">
                  Tamaño del grupo: <span className="text-[#1A4D2E] text-sm">{groupSize} persona{groupSize > 1 ? 's' : ''}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={groupSize}
                  onChange={(e) => setGroupSize(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#E0F2F1] rounded-lg appearance-none cursor-pointer accent-[#0D601E]"
                />
              </div>
            </div>
          </div>

          {/* Intereses */}
          <div>
            <label className="block text-[10px] font-bold text-[#81C784] uppercase tracking-[0.2em] mb-4">
              Intereses
            </label>
            <div className="grid grid-cols-2 gap-3">
              {interestOptions.map((option) => {
                const isSelected = selectedInterests.includes(option.id);
                const IconComponent = option.Icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedInterests(prev => prev.filter(int => int !== option.id));
                      } else {
                        setSelectedInterests(prev => [...prev, option.id]);
                      }
                    }}
                    className={`
                      relative overflow-hidden rounded-xl border transition-all duration-200 p-3 text-left
                      ${
                        isSelected
                          ? `border-transparent bg-gradient-to-br ${option.color} text-white shadow-md`
                          : 'border-[#E0F2F1] bg-white text-[#2D5A3D] hover:border-[#81C784] hover:shadow-sm'
                      }
                    `}
                  >
                    <div className="flex items-center space-x-2">
                      <IconComponent className={`text-lg ${
                        isSelected ? 'text-white' : 'text-[#81C784]'
                      }`} />
                      <span className="font-medium text-xs truncate">{option.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preferencias de Comida */}
          <div>
            <label className="block text-[10px] font-bold text-[#81C784] uppercase tracking-[0.2em] mb-4">
              Tipo de Comida
            </label>
            <div className="grid grid-cols-2 gap-3">
              {foodPreferences.map((pref) => (
                <button
                  key={pref.id}
                  type="button"
                  onClick={() => setFoodPreference(pref.id)}
                  className={`
                    p-3 rounded-xl border transition-all duration-200 text-left
                    ${
                      foodPreference === pref.id
                        ? 'border-[#0D601E] bg-[#0D601E] text-white'
                        : 'border-[#E0F2F1] bg-white text-[#2D5A3D] hover:border-[#81C784]'
                    }
                  `}
                >
                  <div className="font-medium text-xs mb-1">{pref.name}</div>
                  <div className="text-[10px] opacity-70">{pref.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Botón Generar */}
          <button
            type="submit"
            disabled={isGenerating || selectedInterests.length === 0}
            className="w-full bg-gradient-to-r from-[#0D601E] to-[#1A4D2E] text-white py-4 px-8 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md transition-all duration-200 relative overflow-hidden group"
          >
            {isGenerating ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Creando tu itinerario...</span>
              </div>
            ) : (
              'Generar Itinerario'
            )}
          </button>
        </form>

        {/* Resultados */}
        {itineraries.length > 0 && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-[#1A4D2E] flex items-center">
                Tu Itinerario Mundial Personalizado
              </h2>
              
              <button
                onClick={downloadPDF}
                className="bg-gradient-to-r from-[#0D601E] to-[#1A4D2E] text-white font-bold py-3 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center"
              >
                Descargar PDF
              </button>
            </div>

            <div className="space-y-6">
              {itineraries.map((itinerary, index) => (
                <ItineraryCard key={index} itinerary={itinerary} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}