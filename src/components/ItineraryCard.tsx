// src/components/ItineraryCard.tsx
interface Activity {
  hora: string;
  actividad: string;
  tiempo_estancia: string;
  traslado_proximo: string;
}

interface ItineraryProps {
  data: {
    titulo: string;
    presupuesto_total: string;
    plan_detallado: Activity[];
    descripcion: string;
    tips: string;
  };
}

export default function ItineraryCard({ data }: ItineraryProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm max-w-xl mx-auto my-10">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">{data.titulo}</h2>
          <p className="text-sm text-gray-400 mt-1 tracking-widest font-medium">Itinerario Sugerido</p>
        </div>
        <span className="bg-emerald-900 text-emerald-50 px-4 py-1.5 rounded-full text-xs font-bold">
          {data.presupuesto_total}
        </span>
      </div>

      <div className="space-y-0 relative">
        <div className="absolute left-[7px] top-2 bottom-2 w-[1px] bg-gray-100"></div>

        {data.plan_detallado.map((item, index) => (
          <div key={index} className="relative pl-8 pb-10 last:pb-0">
            {/* punto de la línea de tiempo */}
            <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-emerald-900 bg-white"></div>
            
            <div className="flex flex-col">
              <span className="text-xs font-bold text-emerald-800 mb-1">{item.hora}</span>
              <h3 className="text-lg font-semibold text-gray-800">{item.actividad}</h3>
              <div className="flex gap-4 mt-2">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  ⏱️ {item.tiempo_estancia}
                </span>
                {item.traslado_proximo && (
                  <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                    🚗 Traslado: {item.traslado_proximo}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 pt-8 border-t border-gray-50">
        <p className="text-gray-600 text-sm leading-relaxed mb-6">
          {data.descripcion}
        </p>
        <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
          <h4 className="text-emerald-900 text-xs font-bold tracking-wider mb-2">Tips</h4>
          <p className="text-emerald-800 text-sm italic leading-snug">
            "{data.tips}"
          </p>
        </div>
      </div>
    </div>
  );
}