"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
    FiHome, FiUser, FiMenu, FiX, FiLogOut,
    FiCalendar, FiMapPin, FiCompass,
} from "react-icons/fi";
import imglogo from "./logoPitzbol.png";
import imgPasto from "./pastoVerde.png";

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://69.30.204.56:3000';

interface StoredUser {
    uid?: string;
    nombre?: string;
    fotoPerfil?: string;
    role?: string;
    [key: string]: unknown;
}

export default function PitzbolNavbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [user, setUser] = useState<StoredUser | null>(null);
    const [isLogoHovered, setIsLogoHovered] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadUser = () => {
            try {
                const raw = localStorage.getItem('pitzbol_user');
                setUser(raw ? JSON.parse(raw) : null);
            } catch { setUser(null); }
        };
        loadUser();

        const closeMenu = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
            }
        };

        window.addEventListener('storage', loadUser);
        window.addEventListener('authStateChanged', loadUser);
        document.addEventListener('mousedown', closeMenu);
        return () => {
            window.removeEventListener('storage', loadUser);
            window.removeEventListener('authStateChanged', loadUser);
            document.removeEventListener('mousedown', closeMenu);
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('pitzbol_user');
        localStorage.removeItem('pitzbol_token');
        sessionStorage.removeItem('pitzbol_uid');
        setUser(null);
        setIsMenuOpen(false);
        window.dispatchEvent(new Event('authStateChanged'));
    };

    const displayName = user?.nombre || (user as any)?.['01_nombre'] || 'Usuario';
    const roleLabel = user?.role === 'guia' ? 'Guía' : user?.role === 'admin' ? 'Admin' : 'Turista';

    return (
        <nav className="flex justify-between items-center bg-[#F6F0E6] px-4 md:px-8 h-20 md:h-24 sticky top-0 z-[100] shadow-sm text-[#1A4D2E]">
            {/* LOGO Y NOMBRE */}
            <div className="flex items-center h-full">
                <div
                    className="relative h-22 w-22 right-3 md:h-32 md:w-32 flex-shrink-0 cursor-pointer"
                    style={{ transform: isLogoHovered ? 'rotate(190deg)' : 'rotate(0deg)', transition: 'transform 2s ease-in-out' }}
                    onMouseEnter={() => setIsLogoHovered(true)}
                    onMouseLeave={() => setIsLogoHovered(false)}
                >
                    <Link href={FRONTEND_URL}>
                        <Image src={imglogo} alt="logo" fill className="object-contain" priority />
                    </Link>
                </div>
                <div className="relative flex items-center h-full ml-1 pointer-events-none">
                    <div className="absolute inset-y-0 -left-6 md:top-8 top-6 z-0 flex items-center w-[120%] min-w-[150px] md:min-w-[250px]">
                        <Image src={imgPasto} alt="pasto" className="object-contain" />
                    </div>
                    <h1 className="relative z-10 right-2 text-[35px] md:text-[50px] leading-none drop-shadow-[2px_4px_4px_rgba(0,0,0,0.5)] text-white pointer-events-auto" style={{ fontFamily: "'Jockey One', sans-serif" }}>
                        <Link href={FRONTEND_URL}>PITZ<span className="text-[#F00808]">BOL</span></Link>
                    </h1>
                </div>
            </div>

            {/* ICONOS DERECHA */}
            <div className="flex items-center gap-3 md:gap-5 relative" ref={menuRef}>
                <Link href={FRONTEND_URL} className="hidden md:block hover:text-[#F00808] transition-colors" title="Inicio">
                    <FiHome size={22} />
                </Link>

                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="p-2 z-[110] bg-white/40 rounded-full hover:bg-white transition-all shadow-sm"
                >
                    {isMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
                </button>

                {/* MENÚ DESPLEGABLE */}
                {isMenuOpen && (
                    <div className="absolute top-[120%] right-0 w-72 bg-white rounded-[32px] shadow-2xl border border-gray-100 p-5 flex flex-col gap-1 z-[120]">
                        <p className="text-[10px] uppercase tracking-widest text-[#769C7B] font-bold px-3 mb-2">Mi cuenta</p>

                        {user ? (
                            <a
                                href={`${FRONTEND_URL}/perfil`}
                                className="flex items-center gap-3 p-3 bg-[#F6F0E6]/50 rounded-2xl hover:bg-[#1A4D2E] hover:text-white transition-all group"
                            >
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-[#1A4D2E] group-hover:bg-white flex items-center justify-center text-white text-xs font-bold uppercase transition-colors">
                                    {user.fotoPerfil ? (
                                        <img src={user.fotoPerfil as string} alt="Foto" className="w-full h-full object-cover" loading="lazy" />
                                    ) : (
                                        <span className="text-sm">{displayName[0]}</span>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm leading-none">{displayName}</span>
                                    <span className="text-[10px] opacity-60 uppercase mt-1">{roleLabel}</span>
                                </div>
                            </a>
                        ) : (
                            <a
                                href={`${FRONTEND_URL}/login`}
                                className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-[#F6F0E6] rounded-2xl transition-all"
                            >
                                <FiUser className="text-[#0D601E]" />
                                <span className="font-bold text-sm italic text-[#1A4D2E]">Iniciar sesión</span>
                            </a>
                        )}

                        <div className="h-[1px] bg-gray-100 my-2 mx-2" />
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold px-3 mb-1">Explorar</p>

                        <a href={FRONTEND_URL} onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 hover:bg-[#F6F0E6] rounded-2xl text-sm font-medium transition-all">
                            <FiHome /> Inicio
                        </a>
                        <a href={`${FRONTEND_URL}/mapa`} onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 hover:bg-[#F6F0E6] rounded-2xl text-sm font-medium transition-all">
                            <FiMapPin /> Mapa
                        </a>
                        <a href={`${FRONTEND_URL}/calendario`} onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 hover:bg-[#F6F0E6] rounded-2xl text-sm font-medium transition-all">
                            <FiCalendar /> Calendario del Mundial
                        </a>
                        <a href={`${FRONTEND_URL}/tours`} onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 hover:bg-[#F6F0E6] rounded-2xl text-sm font-medium transition-all">
                            <FiCompass /> Tours
                        </a>

                        {user && (
                            <>
                                <div className="h-[1px] bg-gray-100 my-2 mx-2" />
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-3 p-3 rounded-2xl text-sm font-medium group w-full text-left transition-colors"
                                >
                                    <FiLogOut className="text-[#0D601E] group-hover:text-[#F00808] transition-colors" />
                                    <span className="text-[#1A4D2E] group-hover:text-[#F00808] transition-colors">Cerrar sesión</span>
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
}
