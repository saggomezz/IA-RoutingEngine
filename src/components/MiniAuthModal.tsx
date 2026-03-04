"use client";
import { useState } from "react";
import { FiX, FiMail, FiLock, FiUser, FiEye, FiEyeOff } from "react-icons/fi";

type AuthTrigger = 'save' | 'limit' | 'profile' | null;

interface MiniAuthModalProps {
  trigger: AuthTrigger;
  onClose: () => void;
  onSuccess: (uid: string, nombre: string) => void;
}

const TITLES: Record<string, string> = {
  save: '¡Guarda tu itinerario!',
  limit: 'Regístrate para continuar',
  profile: 'Mi cuenta',
};
const DESCS: Record<string, string> = {
  save: 'Inicia sesión o crea una cuenta para guardar este itinerario en tu perfil.',
  limit: 'Ya usaste tu itinerario de invitado. Regístrate para generar itinerarios ilimitados.',
  profile: 'Inicia sesión para ver tu perfil y tus itinerarios guardados.',
};

export default function MiniAuthModal({ trigger, onClose, onSuccess }: MiniAuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Register
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const title = TITLES[trigger || 'profile'];
  const desc = DESCS[trigger || 'profile'];

  const storeUser = (data: Record<string, any>) => {
    const user = {
      uid: data.user?.uid,
      email: data.user?.email,
      nombre: data.user?.nombre,
      apellido: data.user?.apellido || '',
      fotoPerfil: data.user?.fotoPerfil || null,
      role: data.user?.role || 'turista',
      guide_status: data.user?.guide_status || 'ninguno',
    };
    localStorage.setItem('pitzbol_user', JSON.stringify(user));
    if (data.token) localStorage.setItem('pitzbol_token', data.token);
    sessionStorage.setItem('pitzbol_uid', data.user?.uid || '');
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('authStateChanged'));
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) { setError('Completa todos los campos'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.msg || 'Credenciales incorrectas'); return; }
      storeUser(data);
      onSuccess(data.user?.uid, data.user?.nombre || loginEmail);
    } catch { setError('Error de conexión'); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!nombre || !regEmail || !password) { setError('Completa los campos obligatorios'); return; }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, apellido, email: regEmail, password, telefono: '', nacionalidad: '', role: 'turista' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.msg || 'Error al registrar'); return; }

      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, password }),
      });
      const loginData = await loginRes.json().catch(() => ({}));
      if (!loginRes.ok) { setError('Cuenta creada. Por favor inicia sesión.'); setIsLogin(true); return; }
      storeUser(loginData);
      onSuccess(loginData.user?.uid, loginData.user?.nombre || nombre);
    } catch { setError('Error de conexión'); }
    finally { setLoading(false); }
  };

  const inputClass = "w-full pl-9 pr-3 py-2.5 border border-[#E0F2F1] rounded-xl text-sm focus:border-[#1A4D2E] focus:outline-none transition-colors";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-[#1A4D2E] text-base">{title}</h3>
            <p className="text-xs text-gray-500 mt-1 leading-snug">{desc}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-3 shrink-0 mt-0.5">
            <FiX size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden border border-[#E0F2F1] mb-4">
          <button
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${isLogin ? 'bg-[#1A4D2E] text-white' : 'text-[#1A4D2E] hover:bg-[#E0F2F1]'}`}
          >Iniciar sesión</button>
          <button
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${!isLogin ? 'bg-[#1A4D2E] text-white' : 'text-[#1A4D2E] hover:bg-[#E0F2F1]'}`}
          >Registrarse</button>
        </div>

        {error && (
          <p className="text-xs text-red-500 font-semibold mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        {isLogin ? (
          <div className="space-y-3">
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#81C784]" size={15} />
              <input type="email" placeholder="Correo electrónico" value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                className={inputClass} />
            </div>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#81C784]" size={15} />
              <input type={showLoginPw ? 'text' : 'password'} placeholder="Contraseña" value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full pl-9 pr-10 py-2.5 border border-[#E0F2F1] rounded-xl text-sm focus:border-[#1A4D2E] focus:outline-none" />
              <button type="button" onClick={() => setShowLoginPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showLoginPw ? <FiEyeOff size={15} /> : <FiEye size={15} />}
              </button>
            </div>
            <button onClick={handleLogin} disabled={loading}
              className="w-full bg-[#1A4D2E] hover:bg-[#0D601E] text-white py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-50">
              {loading ? 'Cargando...' : 'Iniciar sesión'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-[#81C784]" size={15} />
                <input type="text" placeholder="Nombre *" value={nombre}
                  onChange={e => setNombre(e.target.value)} className={inputClass} />
              </div>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-[#81C784]" size={15} />
                <input type="text" placeholder="Apellido" value={apellido}
                  onChange={e => setApellido(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#81C784]" size={15} />
              <input type="email" placeholder="Correo electrónico *" value={regEmail}
                onChange={e => setRegEmail(e.target.value)} className={inputClass} />
            </div>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#81C784]" size={15} />
              <input type={showPw ? 'text' : 'password'} placeholder="Contraseña * (mín. 6 caracteres)" value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 border border-[#E0F2F1] rounded-xl text-sm focus:border-[#1A4D2E] focus:outline-none" />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPw ? <FiEyeOff size={15} /> : <FiEye size={15} />}
              </button>
            </div>
            <div className="relative">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#81C784]" size={15} />
              <input type={showConfirmPw ? 'text' : 'password'} placeholder="Confirmar contraseña *" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRegister()}
                className="w-full pl-9 pr-10 py-2.5 border border-[#E0F2F1] rounded-xl text-sm focus:border-[#1A4D2E] focus:outline-none" />
              <button type="button" onClick={() => setShowConfirmPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showConfirmPw ? <FiEyeOff size={15} /> : <FiEye size={15} />}
              </button>
            </div>
            <button onClick={handleRegister} disabled={loading}
              className="w-full bg-[#1A4D2E] hover:bg-[#0D601E] text-white py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-50">
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
