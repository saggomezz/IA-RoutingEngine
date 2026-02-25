// src/app/page.tsx
'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 flex items-center justify-center px-4">
      <div className="max-w-lg mx-auto text-center space-y-12">
        
        {/* Logo */}
        <div className="space-y-2">
          <h1 className="text-6xl font-black text-white tracking-tighter">
            PitzBol<span className="text-emerald-200">.</span>
          </h1>
          <p className="text-emerald-100 text-lg font-light tracking-widest">Descubre tu próxima aventura</p>
        </div>

        {/* Main CTA */}
        <div className="space-y-6">
          <p className="text-emerald-50 text-lg leading-relaxed max-w-md mx-auto">
            Déjate guiar por nuestra IA para crear el itinerario perfecto según tus intereses y presupuesto.
          </p>
          
          <Link href="/itinerary">
            <button className="w-full bg-white text-emerald-950 py-5 px-8 rounded-2xl font-bold text-lg hover:bg-emerald-50 hover:shadow-2xl transition-all duration-300 shadow-xl hover:scale-105 active:scale-95">
              Armar tu itinerario ✨
            </button>
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mt-16 pt-16 border-t border-emerald-700">
          <div className="space-y-2">
            <div className="text-3xl">🎯</div>
            <p className="text-xs text-emerald-100 font-medium">Personalizado</p>
          </div>
          <div className="space-y-2">
            <div className="text-3xl">⚡</div>
            <p className="text-xs text-emerald-100 font-medium">Rápido</p>
          </div>
          <div className="space-y-2">
            <div className="text-3xl">🤖</div>
            <p className="text-xs text-emerald-100 font-medium">Con IA</p>
          </div>
        </div>

      </div>
    </div>
  );
}