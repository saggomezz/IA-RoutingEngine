"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { FiChevronRight, FiHome, FiMenu, FiX, FiZap } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

export default function PitzbolNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <nav className="flex justify-between items-center bg-[#F6F0E6] px-4 md:px-8 h-20 md:h-24 sticky top-0 z-[100] shadow-sm text-[#1A4D2E]">
      {/* LOGO Y NOMBRE */}
      <div className="flex items-center h-full gap-2">
        <Link href="http://69.30.204.56:3000" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="text-2xl md:text-3xl font-black text-white drop-shadow-md">
            PITZ<span className="text-[#F00808]">BOL</span>
          </div>
        </Link>
      </div>

      {/* ICONOS DERECHA */}
      <div className="flex items-center gap-3 md:gap-5">
        <Link href="http://69.30.204.56:3000">
          <FiHome size={22} className="hover:text-[#F00808] transition-colors" title="Volver al Home" />
        </Link>

        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 z-[110] bg-white/40 rounded-full hover:bg-white transition-all shadow-sm">
          {isMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>

        {/* MENÚ DESPLEGABLE */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute top-[120%] right-0 w-72 bg-white rounded-[32px] shadow-2xl border border-gray-100 p-5 flex flex-col gap-1 z-[120]"
            >
              <p className="text-[10px] uppercase tracking-widest text-[#769C7B] font-bold px-3 mb-2">Itinerarios</p>
              
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  document.querySelector("#itinerary-form")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex items-center gap-3 p-3 rounded-2xl text-sm font-medium w-full text-left group hover:bg-[#F6F0E6] transition-all"
              >
                <FiZap className="text-[#0D601E] group-hover:text-[#F00808] transition-colors" />
                <span className="text-[#1A4D2E] group-hover:text-[#F00808] transition-colors">Crear Itinerario con IA</span>
              </button>

              <div className="h-[1px] bg-gray-100 my-3 mx-2" />

              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold px-3 mb-1">Navegación</p>
              <Link href="http://69.30.204.56:3000" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 hover:bg-[#F6F0E6] rounded-2xl text-sm font-medium transition-all text-left">
                <FiHome /> Volver al Home
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
