'use client';
import { useEffect, useRef } from 'react';

export interface MapStop {
  lat: number;
  lng: number;
  nombre: string;
  foto?: string;
  num: number;
  isMatch?: boolean;
  isCamino?: boolean;
}

export default function ItineraryMap({ stops, userLocation }: {
  stops: MapStop[];
  userLocation?: { lat: number; lng: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    const validStops = stops.filter(s => s.lat && s.lng && !s.isCamino);
    if (!containerRef.current || (validStops.length === 0 && !userLocation)) return;

    const init = async () => {
      const L = (await import('leaflet')).default;

      if (!document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.setAttribute('data-leaflet-css', '1');
        document.head.appendChild(link);
      }

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current!);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      validStops.forEach(stop => {
        const color = stop.isMatch ? '#F59E0B' : '#1A4D2E';
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${color};color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35)">${stop.num}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -20],
        });

        const popupContent = `
          <div style="min-width:160px;font-family:system-ui,sans-serif;padding:2px">
            ${stop.foto ? `<img src="${stop.foto}" style="width:100%;height:80px;object-fit:cover;border-radius:8px;margin-bottom:7px" referrerpolicy="no-referrer" />` : ''}
            <div style="font-weight:700;font-size:13px;color:#1A4D2E;line-height:1.3">${stop.nombre}</div>
          </div>
        `;

        L.marker([stop.lat, stop.lng], { icon })
          .bindPopup(popupContent, { maxWidth: 200 })
          .addTo(map);
      });

      // User location blue dot
      if (userLocation) {
        const userIcon = L.divIcon({
          className: '',
          html: `<div style="width:16px;height:16px;border-radius:50%;background:#2196F3;border:3px solid white;box-shadow:0 0 0 4px rgba(33,150,243,0.25),0 2px 8px rgba(0,0,0,0.3)"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          popupAnchor: [0, -12],
        });
        L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
          .bindPopup('<div style="font-family:system-ui,sans-serif;font-size:12px;font-weight:600;color:#1565C0">📍 Tu ubicación</div>', { maxWidth: 140 })
          .addTo(map);
      }

      const allPoints: [number, number][] = [
        ...validStops.map(s => [s.lat, s.lng] as [number, number]),
        ...(userLocation ? [[userLocation.lat, userLocation.lng] as [number, number]] : []),
      ];

      if (allPoints.length === 1) {
        map.setView(allPoints[0], 15);
      } else if (allPoints.length > 1) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [40, 40] });
      } else {
        map.setView([20.6736, -103.3440], 13);
      }
    };

    init();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [stops]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
  );
}
