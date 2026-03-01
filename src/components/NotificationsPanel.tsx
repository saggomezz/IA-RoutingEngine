"use client";
import { useEffect, useRef, useState } from "react";

interface Notification {
  id: string;
  tipo: 'aprobado' | 'rechazado' | 'info';
  titulo: string;
  mensaje: string;
  fecha: string;
  leido: boolean;
}

interface NotificationsPanelProps {
  userId?: string;
}

export default function NotificationsPanel({ userId }: NotificationsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notification[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cargar notificaciones ejemplo (puedes conectar al backend después)
  useEffect(() => {
    if (userId) {
      // Ejemplo de notificaciones
      const ejemploNotificaciones: Notification[] = [
        {
          id: "1",
          tipo: "aprobado",
          titulo: "Solicitud Aprobada",
          mensaje: "Tu solicitud de guía ha sido aprobada",
          fecha: new Date().toISOString(),
          leido: false
        }
      ];
      setNotificaciones(ejemploNotificaciones);
      setNoLeidas(ejemploNotificaciones.filter(n => !n.leido).length);
    }
  }, [userId]);

  if (!userId) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
      >
        <span className="text-2xl">🔔</span>
        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-y-auto z-50">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-800">Notificaciones</h3>
          </div>
          
          {notificaciones.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No tienes notificaciones
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {notificaciones.map((notif) => (
                <div 
                  key={notif.id}
                  className={`p-3 rounded-lg cursor-pointer hover:bg-gray-50 ${!notif.leido ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${notif.tipo === 'aprobado' ? 'text-green-600' : notif.tipo === 'rechazado' ? 'text-red-600' : 'text-blue-600'}`}>
                      {notif.tipo === 'aprobado' ? '✅' : notif.tipo === 'rechazado' ? '❌' : 'ℹ️'}
                    </span>
                    <span className="font-medium text-sm">{notif.titulo}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{notif.mensaje}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}