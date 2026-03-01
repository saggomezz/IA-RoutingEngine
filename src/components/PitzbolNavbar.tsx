"use client";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";

export default function PitzbolNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    // Verificar usuario
    const checkUser = () => {
      if (typeof window !== "undefined") {
        const storedUser = localStorage.getItem("pitzbol_user");
        setUser(storedUser ? JSON.parse(storedUser) : null);
      }
    };
    
    checkUser();
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("storage", checkUser);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("storage", checkUser);
    };
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("pitzbol_user");
      localStorage.removeItem("pitzbol_token");
      setUser(null);
      setIsMenuOpen(false);
      window.location.href = "http://69.30.204.56:3000";
    }
  };

  return (
    <nav className="flex justify-between items-center bg-[#F6F0E6] px-4 md:px-8 h-20 md:h-24 sticky top-0 z-[100] shadow-sm text-[#1A4D2E]">
      {/* LOGO Y NOMBRE */}
      <div className="flex items-center h-full">
        <div className="relative h-16 w-16 md:h-20 md:w-20 flex-shrink-0 cursor-pointer hover:rotate-180 transition-transform duration-1000">
          <Link href="http://69.30.204.56:3000">
            <div className="w-full h-full bg-[#1A4D2E] rounded-full flex items-center justify-center text-white text-2xl font-bold">
              ⚽
            </div>
          </Link>
        </div>

        <div className="relative flex items-center h-full ml-2 pointer-events-none">
          <div className="absolute inset-0 -left-4 md:-left-6 bg-gradient-to-r from-[#0D601E] to-[#769C7B] rounded-lg opacity-20"></div>
          <h1 
            className="relative z-10 text-[28px] md:text-[42px] leading-none drop-shadow-[2px_4px_4px_rgba(0,0,0,0.5)] text-white font-black pointer-events-auto cursor-pointer hover:scale-105 transition-transform"
            style={{ fontFamily: "'Jockey One', sans-serif" }}
          >
            <Link href="http://69.30.204.56:3000">
              PITZ<span className="text-[#F00808]">BOL</span>
            </Link>
          </h1>
        </div>
      </div>

      {/* BUSCADOR */}
      <div className="hidden lg:flex flex-1 max-w-[600px] mx-6 relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#769C7B] text-lg">🔍</span>
        <input 
          type="text" 
          placeholder="Buscar tours, guías o lugares..." 
          className="w-full pl-12 pr-4 py-2.5 bg-white/50 border border-[#1A4D2E]/10 rounded-full outline-none focus:bg-white focus:ring-2 focus:ring-[#0D601E]/10 transition-all text-sm"
        />
      </div>

      {/* ICONOS DERECHA */}
      <div className="flex items-center gap-3 md:gap-5 relative">
        <Link href="http://69.30.204.56:3000">
          <span className="text-2xl hover:text-[#F00808] transition-colors cursor-pointer" title="Home">🏠</span>
        </Link>
        <Link href="http://69.30.204.56:3000/favoritos">
          <span className="text-2xl hover:text-[#F00808] transition-colors cursor-pointer" title="Favoritos">❤️</span>
        </Link>
        <Link href="http://69.30.204.56:3000/calendario">
          <span className="text-2xl hover:text-[#F00808] transition-colors cursor-pointer" title="Calendario">📅</span>
        </Link>

        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)} 
          className="p-2 z-[110] bg-white/40 rounded-full hover:bg-white transition-all shadow-sm border border-gray-200"
        >
          <span className="text-2xl">{isMenuOpen ? "✕" : "☰"}</span>
        </button>

        {/* MENÚ DESPLEGABLE */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="absolute top-[120%] right-0 w-72 bg-white rounded-[32px] shadow-2xl border border-gray-100 p-5 flex flex-col gap-1 z-[120] animate-in fade-in slide-in-from-top-2 duration-300"
          >
            {/* SECCIÓN USUARIO */}
            <p className="text-[10px] uppercase tracking-widest text-[#769C7B] font-bold px-3 mb-2">Mi Cuenta</p>
            {user ? (
              <button 
                onClick={() => {
                  setIsMenuOpen(false);
                  window.location.href = "http://69.30.204.56:3000/perfil";
                }} 
                className="flex items-center gap-3 p-3 bg-[#F6F0E6]/50 rounded-2xl hover:bg-[#1A4D2E] hover:text-white transition-all group w-full text-left"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden bg-[#1A4D2E] group-hover:bg-white flex items-center justify-center text-white text-xs font-bold uppercase transition-colors">
                  {user.fotoPerfil ? (
                    <img src={user.fotoPerfil} alt="Perfil" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm">{(user.nombre || "U")[0]}</span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm leading-none">{user.nombre || "Usuario"}</span>
                  <span className="text-[10px] opacity-60 uppercase mt-1">Turista</span>
                </div>
              </button>
            ) : (
              <Link 
                href="http://69.30.204.56:3000" 
                onClick={() => setIsMenuOpen(false)} 
                className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-[#F6F0E6] rounded-2xl transition-all text-left"
              >
                <span className="text-[#0D601E] text-lg">👤</span> 
                <span className="font-bold text-sm italic text-[#1A4D2E]">Identificarse</span>
              </Link>
            )}

            <div className="h-[1px] bg-gray-100 my-2 mx-2" />
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold px-3 mb-1">Explorar</p>
            <Link href="http://69.30.204.56:3000/mapa" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 hover:bg-[#F6F0E6] rounded-2xl text-sm font-medium transition-all text-left">
              <span className="text-lg">🗺️</span> Mapa
            </Link>

            <div className="h-[1px] bg-gray-100 my-3 mx-2" />
            <p className="text-[10px] uppercase tracking-widest text-[#769C7B] font-bold px-3 mb-2">IA de Itinerarios</p>
            
            <button
              onClick={() => {
                setIsMenuOpen(false);
                setTimeout(() => {
                  document.querySelector("#itinerary-form")?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              className="flex items-center gap-3 p-3 rounded-2xl text-sm font-medium w-full text-left group hover:bg-[#F6F0E6] transition-all"
            >
              <span className="text-[#0D601E] group-hover:text-[#F00808] transition-colors text-lg">⚡</span>
              <span className="text-[#1A4D2E] group-hover:text-[#F00808] transition-colors">Crear Itinerario</span>
            </button>

            <div className="h-[1px] bg-gray-100 my-3 mx-2" />
            <p className="text-[10px] uppercase tracking-widest text-[#769C7B] font-bold px-3 mb-2">Oportunidades</p>
            
            <Link href="http://69.30.204.56:3000" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-2xl text-sm font-medium w-full text-left group hover:bg-[#F6F0E6] transition-all">
              <span className="text-[#0D601E] group-hover:text-[#F00808] transition-colors text-lg">🏆</span> 
              <span className="text-[#1A4D2E] group-hover:text-[#F00808] transition-colors">Conviértete en Guía</span>
            </Link>
            
            <Link href="http://69.30.204.56:3000" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-2xl text-sm font-medium w-full text-left group hover:bg-[#F6F0E6] mt-1">
              <span className="text-[#0D601E] group-hover:text-[#F00808] text-lg">💼</span> 
              <span className="text-[#1A4D2E] group-hover:text-[#F00808]">Publica tu Negocio</span>
            </Link>

            <div className="h-[1px] bg-gray-100 my-3 mx-2" />
            <p className="text-[10px] uppercase tracking-widest text-[#769C7B] font-bold px-3 mb-2">Pitzbol</p>

            <Link href="http://69.30.204.56:3000/nosotros" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-2xl text-sm font-medium group w-full text-left">
              <span className="text-[#0D601E] group-hover:text-[#F00808] transition-colors text-lg">ℹ️</span> 
              <span className="text-[#1A4D2E] group-hover:text-[#F00808] transition-colors">Nosotros</span>
            </Link>

            <Link href="http://69.30.204.56:3000/soporte" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-2xl text-sm font-medium group transition-colors">
              <span className="text-[#0D601E] group-hover:text-[#F00808] transition-colors text-lg">💬</span> 
              <span className="text-[#1A4D2E] group-hover:text-[#F00808] transition-colors">Soporte y Contacto</span>
            </Link>

            <Link href="http://69.30.204.56:3000/politica-privacidad" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-2xl text-sm font-medium group transition-colors">
              <span className="text-[#0D601E] group-hover:text-[#F00808] transition-colors text-lg">🛡️</span> 
              <span className="text-[#1A4D2E] group-hover:text-[#F00808] transition-colors">Política de Privacidad</span>
            </Link>

            {user && (
              <>
                <div className="h-[1px] bg-gray-100 my-3 mx-2" />
                <button 
                  onClick={handleLogout} 
                  className="flex items-center gap-3 p-3 rounded-2xl text-sm font-medium group w-full text-left transition-colors"
                >
                  <span className="text-[#0D601E] group-hover:text-[#F00808] transition-colors text-lg">🚪</span> 
                  <span className="text-[#1A4D2E] group-hover:text-[#F00808] transition-colors">Cerrar Sesión</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
