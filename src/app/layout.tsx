import type { Metadata } from "next";
import { Geist, Geist_Mono, Jockey_One, Roboto } from "next/font/google";
import "./globals.css";
import PitzbolNavbar from "@/components/PitzbolNavbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jockey = Jockey_One({ variable: "--font-jockey", subsets: ["latin"], weight: "400" });
const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "PitzBol IA",
  description: "Generador de itinerarios con IA para Guadalajara",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} ${jockey.variable} ${roboto.variable} antialiased bg-[#FDFCF9]`}>
        <PitzbolNavbar />
        <main className="relative z-10">
          {children}
        </main>
      </body>
    </html>
  );
}
