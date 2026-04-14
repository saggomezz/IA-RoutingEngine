"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { FiCalendar, FiHome, FiUser, FiGlobe } from "react-icons/fi";
import imglogo from "./logoPitzbol.png";
import imgPasto from "./pastoVerde.png";

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://pitzbol.me';

export default function PitzbolNavbar() {
    const [isLogoHovered, setIsLogoHovered] = useState(false);
    const [profileHref, setProfileHref] = useState(`${FRONTEND_URL}/login`);
    const [calCount, setCalCount] = useState(0);
    const [lang, setLang] = useState<'es' | 'en'>('es');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const l = params.get('lang');
        if (l === 'en' || l === 'es') setLang(l);
    }, []);

    useEffect(() => {
        const update = () => {
            try {
                const raw = localStorage.getItem('pitzbol_user');
                setProfileHref(raw ? `${FRONTEND_URL}/perfil` : `${FRONTEND_URL}/login`);
            } catch {}
        };
        const updateCal = () => {
            try {
                const cal = JSON.parse(localStorage.getItem('pitzbol_calendario') || '[]');
                setCalCount(cal.length);
            } catch {}
        };
        update();
        updateCal();
        window.addEventListener('storage', update);
        window.addEventListener('authStateChanged', update);
        window.addEventListener('storage', updateCal);
        window.addEventListener('calendarUpdated', updateCal);
        return () => {
            window.removeEventListener('storage', update);
            window.removeEventListener('authStateChanged', update);
            window.removeEventListener('storage', updateCal);
            window.removeEventListener('calendarUpdated', updateCal);
        };
    }, []);

    return (
        <nav className="flex justify-between items-center bg-[#F6F0E6] px-4 md:px-8 h-20 md:h-24 sticky top-0 z-[100] shadow-sm text-[#1A4D2E]">
            {/* LOGO */}
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

            {/* ICONOS */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => {
                        const next = lang === 'es' ? 'en' : 'es';
                        const params = new URLSearchParams(window.location.search);
                        params.set('lang', next);
                        window.location.search = params.toString();
                    }}
                    className="flex items-center gap-1.5 hover:text-[#F00808] transition-colors"
                    title={lang === 'es' ? 'Change language' : 'Cambiar idioma'}
                >
                    <FiGlobe size={20} />
                    <span className="text-xs font-bold hidden md:inline">{lang === 'es' ? '🇪🇸 ES' : '🇺🇸 EN'}</span>
                </button>
                <Link href={FRONTEND_URL} className="hover:text-[#F00808] transition-colors" title="Inicio">
                    <FiHome size={22} />
                </Link>
                <Link href={`${FRONTEND_URL}/calendario`} className="relative hover:text-[#F00808] transition-colors" title="Mi calendario">
                    <FiCalendar size={22} />
                    {calCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-[#F00808] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                            {calCount}
                        </span>
                    )}
                </Link>
                {profileHref.includes('/perfil') ? (
                    <a href={profileHref} className="hover:text-[#F00808] transition-colors" title="Mi perfil">
                        <FiUser size={22} />
                    </a>
                ) : (
                    <button
                        onClick={() => window.dispatchEvent(new Event('openAuthModal'))}
                        className="hover:text-[#F00808] transition-colors"
                        title="Iniciar sesión"
                    >
                        <FiUser size={22} />
                    </button>
                )}
            </div>
        </nav>
    );
}
