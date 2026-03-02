"use client";
import { useState } from "react";
import PitzbolNavbar from "../components/PitzbolNavbar";
import ItineraryCard from "../components/ItineraryCard";

interface Itinerary {
  title: string;
  duration: string;
  locations: Array<{
    name: string;
    category: string;
    address: string;
    duration: string;
    cost: string;
    rating: number;
    note: string;
    coordinates: [number, number];
  }>;
}

export default function Home() {
  // Estados principales
  const [selectedDate, setSelectedDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [budget, setBudget] = useState(1000);
  const [groupSize, setGroupSize] = useState(2);
  const [duration, setDuration] = useState("medio-dia");
  
  // Nuevos estados para Mundial
  const [travelStyle, setTravelStyle] = useState("");
  const [footballInterest, setFootballInterest] = useState("");
  const [foodPreference, setFoodPreference] = useState("");
  const [nightlifeLevel, setNightlifeLevel] = useState("");
  const [culturalInterest, setCulturalInterest] = useState("");
  const [transportMode, setTransportMode] = useState("");
  const [matchDay, setMatchDay] = useState(false);
  const [teamSupport, setTeamSupport] = useState("");
  
  // Estado de categorías múltiples
  const [interests, setInterests] = useState<string[]>([]);
  const [specialNeeds, setSpecialNeeds] = useState<string[]>([]);

  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [generating, setGenerating] = useState(false);

  // Opciones de intereses
  const interestOptions = [
    { id: "futbol", name: "Fútbol", emoji: "⚽", desc: "Estadios, bares deportivos, museos" },
    { id: "gastronomia", name: "Gastronomía", emoji: "🌮", desc: "Comida típica, restaurantes locales" },
    { id: "vida-nocturna", name: "Vida Nocturna", emoji: "🍻", desc: "Bares, antros, cantinas tradicionales" },
    { id: "cultura", name: "Cultura", emoji: "🎭", desc: "Museos, arte, historia, arquitectura" },
    { id: "compras", name: "Compras", emoji: "🛍️", desc: "Centros comerciales, mercados locales" },
    { id: "naturaleza", name: "Naturaleza", emoji: "🌿", desc: "Parques, espacios verdes" },
    { id: "aventura", name: "Aventura", emoji: "🎯", desc: "Actividades extremas y emocionantes" },
    { id: "fotografia", name: "Fotografía", emoji: "📸", desc: "Lugares instagrameables" },
  ];

  const travelStyles = [
    { id: "backpacker", name: "Mochilero", desc: "Económico, auténtico, local" },
    { id: "comfort", name: "Confort", desc: "Balance precio-comodidad" },
    { id: "luxury", name: "Lujo", desc: "Experiencias premium" },
    { id: "family", name: "Familiar", desc: "Actividades para toda la familia" },
  ];

  const footballLevels = [
    { id: "fanatic", name: "Fanático Total", desc: "Todo relacionado al fútbol" },
    { id: "casual", name: "Aficionado Casual", desc: "Me gusta el ambiente futbolero" },
    { id: "social", name: "Social", desc: "Solo para compartir con amigos" },
    { id: "none", name: "No me interesa", desc: "Prefiero otras actividades" },
  ];

  const foodPreferences = [
    { id: "tradicional", name: "100% Tradicional", desc: "Solo comida típica tapatía" },
    { id: "mix", name: "Variado", desc: "Tradicional + internacional" },
    { id: "internacional", name: "Internacional", desc: "Comida familiar/internacional" },
    { id: "vegetariano", name: "Vegetariano", desc: "Opciones sin carne" },
  ];

  const toggleInterest = (interest: string) => {
    setInterests(prev => 
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const toggleSpecialNeed = (need: string) => {
    setSpecialNeeds(prev => 
      prev.includes(need)
        ? prev.filter(n => n !== need)
        : [...prev, need]
    );
  };

  const generateItinerary = async () => {
    setGenerating(true);
    
    const prompt = `Crea un itinerario para turistas del Mundial de Fútbol que visitan Guadalajara.
    
PARÁMETROS:
- Fecha: ${selectedDate}
- Hora inicio: ${startTime}
- Duración: ${duration}
- Presupuesto: $${budget} MXN por persona
- Grupo de ${groupSize} personas
- Estilo de viaje: ${travelStyle}
- Interés en fútbol: ${footballInterest}
- Preferencia de comida: ${foodPreference}
- Intereses seleccionados: ${interests.join(', ')}
- ¿Es día de partido?: ${matchDay ? 'Sí' : 'No'}
- Equipo que apoya: ${teamSupport}
- Nivel de vida nocturna: ${nightlifeLevel}
- Interés cultural: ${culturalInterest}
- Transporte: ${transportMode}
- Necesidades especiales: ${specialNeeds.join(', ')}

Usa SOLO lugares del archivo datosLugares.csv que coincidan con los intereses seleccionados.
Organiza el itinerario por horarios lógicos y distancias.
Incluye tiempo de traslado entre lugares.
Considera el presupuesto total del grupo.
${matchDay ? 'IMPORTANTE: Si es día de partido, incluye lugares para ver el partido y ambiente futbolero antes/después.' : ''}
${teamSupport ? `El grupo apoya a: ${teamSupport}, incluye lugares relacionados si es posible.` : ''}

Responde en JSON con este formato exacto:
{
  "title": "Itinerario [Tema] - [Fecha]",
  "duration": "[X] horas",
  "totalCost": "$[X] MXN por persona",
  "locations": [
    {
      "name": "Nombre exacto del CSV",
      "category": "Categoría del CSV", 
      "address": "Dirección del CSV",
      "time": "HH:MM - HH:MM",
      "duration": "X minutos",
      "cost": "Costo del CSV",
      "rating": número_del_CSV,
      "note": "Nota del CSV + por qué se seleccionó",
      "coordinates": [latitud, longitud]
    }
  ]
}`;

    try {
      const response = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (response.ok) {
        const data = await response.json();
        try {
          const itinerary = JSON.parse(data.response);
          setItineraries([itinerary]);
        } catch {
          // Si no es JSON válido, mostrar respuesta directa
          setItineraries([{
            title: "Itinerario Personalizado",
            duration: `${duration === 'medio-dia' ? '4-6' : duration === 'dia-completo' ? '8-10' : '2-3'} horas`,
            locations: [{
              name: "Itinerario Generado",
              category: "Información",
              address: "Guadalajara, Jalisco",
              duration: "Variable",
              cost: `$${budget}`,
              rating: 5,
              note: data.response,
              coordinates: [20.6597, -103.3496]
            }]
          }]);
        }
      }
    } catch (error) {
      console.error("Error:", error);
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
      
      itinerary.locations.forEach((location, index) => {
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

  const isWeekend = selectedDate ? new Date(selectedDate).getDay() % 6 === 0 : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
      <PitzbolNavbar />
      
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Header Hero */}
        <div className="text-center mb-8 bg-gradient-to-r from-emerald-600 to-green-700 rounded-3xl p-8 text-white shadow-2xl">
          <div className="text-6xl mb-4">⚽🌮🎉</div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            ¡Tu Itinerario Perfecto para el Mundial!
          </h1>
          <p className="text-lg md:text-xl opacity-90">
            Descubre Guadalajara como un verdadero tapatío - IA especializada en turismo futbolero
          </p>
        </div>

        <form 
          id="itinerary-form"
          onSubmit={(e) => { e.preventDefault(); generateItinerary(); }} 
          className="space-y-8 bg-white rounded-3xl p-6 md:p-8 shadow-xl"
        >
          {/* Sección 1: Información Básica */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-blue-800 mb-6 flex items-center">
              📅 Información Básica
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Fecha */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  📅 ¿Cuándo vienes?
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setMatchDay(new Date(e.target.value).getDay() % 6 === 0);
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full p-3 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  required
                />
              </div>

              {/* Hora */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  🕐 Hora de inicio
                </label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-3 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  ⏰ Duración del tour
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full p-3 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="rapido">Rápido (2-3 hrs)</option>
                  <option value="medio-dia">Medio día (4-6 hrs)</option>
                  <option value="dia-completo">Día completo (8-10 hrs)</option>
                </select>
              </div>
            </div>

            {/* Presupuesto y Grupo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  💰 Presupuesto por persona: <span className="text-emerald-600">${budget} MXN</span>
                </label>
                <input
                  type="range"
                  min="200"
                  max="3000"
                  step="100"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-emerald"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>$200</span>
                  <span>$1,500</span>
                  <span>$3,000+</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  👥 Tamaño del grupo: <span className="text-emerald-600">{groupSize} personas</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={groupSize}
                  onChange={(e) => setGroupSize(Number(e.target.value))}
                  className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-emerald"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Solo</span>
                  <span>Pareja</span>
                  <span>Grupo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sección 2: Estilo de Viaje */}
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-purple-800 mb-6 flex items-center">
              🎒 ¿Qué tipo de viajero eres?
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {travelStyles.map(style => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setTravelStyle(style.id)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all hover:shadow-md ${
                    travelStyle === style.id
                      ? 'border-purple-500 bg-purple-100 shadow-lg'
                      : 'border-gray-200 bg-white hover:border-purple-300'
                  }`}
                >
                  <div className="font-bold text-lg">{style.name}</div>
                  <div className="text-sm text-gray-600">{style.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sección 3: Nivel Futbolero */}
          <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-green-800 mb-6 flex items-center">
              ⚽ ¡Hablemos de Fútbol!
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {footballLevels.map(level => (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => setFootballInterest(level.id)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all hover:shadow-md ${
                      footballInterest === level.id
                        ? 'border-green-500 bg-green-100 shadow-lg'
                        : 'border-gray-200 bg-white hover:border-green-300'
                    }`}
                  >
                    <div className="font-bold text-lg">{level.name}</div>
                    <div className="text-sm text-gray-600">{level.desc}</div>
                  </button>
                ))}
              </div>

              {/* Día de partido */}
              {isWeekend && (
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-4 mt-4">
                  <div className="flex items-center mb-3">
                    <span className="text-2xl mr-2">🏟️</span>
                    <span className="font-bold text-yellow-800">¡Puede haber partido este día!</span>
                  </div>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={matchDay}
                      onChange={(e) => setMatchDay(e.target.checked)}
                      className="w-4 h-4 text-yellow-600 bg-gray-100 border-gray-300 rounded focus:ring-yellow-500"
                    />
                    <span>Incluir ambiente de partido en el itinerario</span>
                  </label>

                  {matchDay && (
                    <div className="mt-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        ¿A qué equipo le vas?
                      </label>
                      <input
                        type="text"
                        value={teamSupport}
                        onChange={(e) => setTeamSupport(e.target.value)}
                        placeholder="México, Argentina, Chivas, etc..."
                        className="w-full p-3 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sección 4: Intereses */}
          <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-orange-800 mb-6 flex items-center">
              🎯 ¿Qué te interesa descubrir?
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {interestOptions.map(interest => (
                <button
                  key={interest.id}
                  type="button"
                  onClick={() => toggleInterest(interest.id)}
                  className={`p-4 rounded-2xl border-2 text-center transition-all hover:shadow-md ${
                    interests.includes(interest.id)
                      ? 'border-orange-500 bg-orange-100 shadow-lg'
                      : 'border-gray-200 bg-white hover:border-orange-300'
                  }`}
                >
                  <div className="text-3xl mb-2">{interest.emoji}</div>
                  <div className="font-bold text-sm">{interest.name}</div>
                  <div className="text-xs text-gray-600 mt-1">{interest.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sección 5: Gastronomía */}
          {interests.includes('gastronomia') && (
            <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-red-800 mb-6 flex items-center">
                🌮 ¡Hablemos de Comida!
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {foodPreferences.map(food => (
                  <button
                    key={food.id}
                    type="button"
                    onClick={() => setFoodPreference(food.id)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all hover:shadow-md ${
                      foodPreference === food.id
                        ? 'border-red-500 bg-red-100 shadow-lg'
                        : 'border-gray-200 bg-white hover:border-red-300'
                    }`}
                  >
                    <div className="font-bold text-lg">{food.name}</div>
                    <div className="text-sm text-gray-600">{food.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sección 6: Preferencias Adicionales */}
          <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-indigo-800 mb-6 flex items-center">
              ⚙️ Preferencias Adicionales
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Transporte */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  🚗 Transporte preferido
                </label>
                <select
                  value={transportMode}
                  onChange={(e) => setTransportMode(e.target.value)}
                  className="w-full p-3 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                >
                  <option value="">Cualquiera</option>
                  <option value="metro">Metro y transporte público</option>
                  <option value="uber">Uber/Taxi</option>
                  <option value="caminando">A pie (máximo)</option>
                  <option value="mixto">Mixto</option>
                </select>
              </div>

              {/* Vida Nocturna */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  🌙 Nivel de vida nocturna
                </label>
                <select
                  value={nightlifeLevel}
                  onChange={(e) => setNightlifeLevel(e.target.value)}
                  className="w-full p-3 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                >
                  <option value="ningito">Nada de vida nocturna</option>
                  <option value="casual">Casual (cervezas y botanas)</option>
                  <option value="moderado">Moderado (bares hasta medianoche)</option>
                  <option value="intenso">Intenso (¡Hasta que cierre el último!)</option>
                </select>
              </div>

              {/* Interés Cultural */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  🎭 Interés en cultura local
                </label>
                <select
                  value={culturalInterest}
                  onChange={(e) => setCulturalInterest(e.target.value)}
                  className="w-full p-3 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                >
                  <option value="bajo">Bajo (solo lo esencial)</option>
                  <option value="medio">Medio (algunos sitios históricos)</option>
                  <option value="alto">Alto (museos, historia, arte)</option>
                  <option value="muy-alto">Muy alto (inmersión cultural completa)</option>
                </select>
              </div>

              {/* Necesidades Especiales */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  ♿ Necesidades especiales
                </label>
                <div className="space-y-2">
                  {['Accesibilidad', 'Vegetariano/Vegano', 'Sin alcohol', 'Niños pequeños', 'Adultos mayores'].map(need => (
                    <label key={need} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={specialNeeds.includes(need)}
                        onChange={() => toggleSpecialNeed(need)}
                        className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm">{need}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Botón Generar */}
          <div className="text-center">
            <button
              type="submit"
              disabled={!selectedDate || interests.length === 0 || generating}
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-8 rounded-2xl text-lg shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed flex items-center mx-auto"
            >
              {generating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creando tu itinerario perfecto...
                </>
              ) : (
                <>
                  <span className="mr-2">🚀</span>
                  ¡Generar Mi Itinerario Mundial!
                </>
              )}
            </button>
            
            {!selectedDate && (
              <p className="text-red-500 text-sm mt-2">* Selecciona una fecha para continuar</p>
            )}
            {interests.length === 0 && selectedDate && (
              <p className="text-red-500 text-sm mt-2">* Selecciona al menos un interés</p>
            )}
          </div>
        </form>

        {/* Resultados */}
        {itineraries.length > 0 && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800 flex items-center">
                <span className="mr-3">🎯</span>
                Tu Itinerario Mundial Personalizado
              </h2>
              
              <button
                onClick={downloadPDF}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center"
              >
                <span className="mr-2">📄</span>
                Descargar PDF
              </button>
            </div>

            <div className="space-y-6">
              {itineraries.map((itinerary, index) => (
                <ItineraryCard key={index} itinerary={itinerary} />
              ))}
            </div>

            {/* Información adicional */}
            <div className="mt-8 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6 border-2 border-yellow-200">
              <h3 className="text-xl font-bold text-orange-800 mb-4 flex items-center">
                <span className="mr-2">💡</span>
                Tips para tu visita a Guadalajara
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <h4 className="font-bold text-orange-700 mb-2">🎫 Mundial 2026</h4>
                  <ul className="space-y-1 text-gray-700">
                    <li>• Estadio Akron será una de las sedes oficiales</li>
                    <li>• Reserva hospedaje con anticipación</li>
                    <li>• Los precios suben durante semanas del Mundial</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-bold text-orange-700 mb-2">🌮 Comida Típica</h4>
                  <ul className="space-y-1 text-gray-700">
                    <li>• Tortas Ahogadas: platillo emblemático</li>
                    <li>• Birria: perfecto para el clima</li>
                    <li>• Tejuino: bebida refrescante tradicional</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-bold text-orange-700 mb-2">🚗 Transporte</h4>
                  <ul className="space-y-1 text-gray-700">
                    <li>• Metro: rápido y económico</li>
                    <li>• Uber/DiDi: disponible en toda la ciudad</li>
                    <li>• Centro histórico es muy caminable</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-bold text-orange-700 mb-2">⚽ Ambiente Futbolero</h4>
                  <ul className="space-y-1 text-gray-700">
                    <li>• Chivas es el equipo local más querido</li>
                    <li>• Las cantinas se llenan en días de partido</li>
                    <li>• La Minerva es el punto de celebración</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .slider-emerald::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #10b981;
          cursor: pointer;
        }
        
        .slider-emerald::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #10b981;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}