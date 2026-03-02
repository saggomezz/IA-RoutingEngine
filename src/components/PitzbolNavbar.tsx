"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import imglogo from "./logoPitzbol.png";
import imgPasto from "./pastoVerde.png";

export default function PitzbolNavbar() {
    const [isLogoHovered, setIsLogoHovered] = useState(false);

    return (
        <nav className="flex justify-between items-center bg-[#F6F0E6] px-4 md:px-8 h-20 md:h-24 sticky top-0 z-[100] shadow-sm text-[#1A4D2E]">
            {/* LOGO Y NOMBRE - Navegación al Frontend */}
            <div className="flex items-center h-full">
                <div 
                    className="relative h-22 w-22 right-3 md:h-32 md:w-32 flex-shrink-0 cursor-pointer transition-transform duration-2000 ease-in-out"
                    style={{ transform: isLogoHovered ? 'rotate(190deg)' : 'rotate(0deg)' }}
                    onMouseEnter={() => setIsLogoHovered(true)}
                    onMouseLeave={() => setIsLogoHovered(false)}
                >
                    <Link href="http://69.30.204.56:3000">
                        <Image src={imglogo} alt="logo" fill className="object-contain" priority />
                    </Link>
                </div>

                <div className="relative flex items-center h-full ml-1 pointer-events-none">
                    <div className="absolute inset-y-0 -left-6 md:top-8 top-6 z-0 flex items-center w-[120%] min-w-[150px] md:min-w-[250px]">
                        <Image src={imgPasto} alt="pasto" className="object-contain" />
                    </div>
                    <h1 className="relative z-10 right-2 text-[35px] md:text-[50px] leading-none drop-shadow-[2px_4px_4px_rgba(0,0,0,0.5)] text-white pointer-events-auto cursor-pointer hover:scale-105 transition-transform" style={{ fontFamily: "'Jockey One', sans-serif" }}>
                        <Link href="http://69.30.204.56:3000">
                            PITZ<span className="text-[#F00808]">BOL</span>
                        </Link>
                    </h1>
                </div>
            </div>

            {/* TÍTULO Y BOTÓN DE NAVEGACIÓN */}
            <div className="flex items-center gap-4">
                <div className="hidden md:flex flex-col items-end">
                    <h2 className="text-[#1A4D2E] text-lg md:text-xl font-bold">IA de Itinerarios</h2>
                    <p className="text-[#769C7B] text-xs md:text-sm">Powered by PitzBot</p>
                </div>

            </div>
        </nav>
    );
}
