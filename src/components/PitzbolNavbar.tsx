"use client";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { FiHome, FiMenu, FiX, FiZap } from "react-icons/fi";

export default function PitzbolNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="flex justify-between items-center bg-[#F6F0E6] px-4 md:px-8 h-20 md:h-24 sticky top-0 z-[100] shadow-sm text-[#1A4D2E] border-b border-gray-200">
      {/* LOGO Y NOMBRE */}
      <div className="flex items-center h-full gap-2">
        <Link href="http://69.30.204.56:3000" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div 
            className="text-2xl md:text-3xl font-black text-[#1A4D2E] drop-shadow-sm"
            style={{ fontFamily: "'Jockey One', sans-serif" }}
          >
            PITZ<span className="text-[#F00808]">BOL</span>
          </div>
        </Link>
      </div>

      {/* ICONOS DERECHA */}
      <div className="flex items-center gap-3 md:gap-5 relative">
        <Link href="http://69.30.204.56:3000">
          <FiHome size={22} className="hover:text-[#F00808] transition-colors cursor-pointer" title="Volver al Home" />
        </Link>

        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)} 
          className="p-2 z-[110] bg-white/60 rounded-full hover:bg-white transition-all shadow-sm border border-gray-200"
        >
          {isMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>

        {/* MENÚ DESPLEGABLE */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="absolute top-[120%] right-0 w-72 bg-white rounded-[24px] shadow-2xl border border-gray-200 p-5 flex flex-col gap-1 z-[120] animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <p className="text-[10px] uppercase tracking-widest text-[#769C7B] font-bold px-3 mb-2">
              Itinerarios
            </p>
            
            <button
              onClick={() => {
                setIsMenuOpen(false);
                setTimeout(() => {
                  document.querySelector("#itinerary-form")?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              className="flex items-center gap-3 p-3 rounded-2xl text-sm font-medium w-full text-left group hover:bg-[#F6F0E6] transition-all"
            >
              <FiZap className="text-[#0D601E] group-hover:text-[#F00808] transition-colors" />
              <span className="text-[#1A4D2E] group-hover:text-[#F00808] transition-colors">
                Crear Itinerario con IA
              </span>
            </button>

            <div className="h-[1px] bg-gray-200 my-3 mx-2" />

            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold px-3 mb-1">
              Navegación
            </p>
            
            <Link 
              href="http://69.30.204.56:3000" 
              onClick={() => setIsMenuOpen(false)} 
              className="flex items-center gap-3 p-3 hover:bg-[#F6F0E6] rounded-2xl text-sm font-medium transition-all text-left"
            >
              <FiHome className="text-[#1A4D2E]" /> 
              <span className="text-[#1A4D2E]">Volver al Home</span>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
