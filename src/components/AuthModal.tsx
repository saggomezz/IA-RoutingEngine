"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { FiEye, FiEyeOff, FiLock, FiMail, FiX } from "react-icons/fi";

const ALL_COUNTRIES = [
  { name: "Alemania", lada: "+49" }, { name: "Argentina", lada: "+54" },
  { name: "Australia", lada: "+61" }, { name: "Brasil", lada: "+55" },
  { name: "Canadá", lada: "+1" }, { name: "Chile", lada: "+56" },
  { name: "Colombia", lada: "+57" }, { name: "Corea del Sur", lada: "+82" },
  { name: "Dinamarca", lada: "+45" }, { name: "España", lada: "+34" },
  { name: "Estados Unidos", lada: "+1" }, { name: "Francia", lada: "+33" },
  { name: "Italia", lada: "+39" }, { name: "Japón", lada: "+81" },
  { name: "México", lada: "+52" }, { name: "Países Bajos", lada: "+31" },
  { name: "Perú", lada: "+51" }, { name: "Portugal", lada: "+351" },
  { name: "Reino Unido", lada: "+44" }, { name: "Uruguay", lada: "+598" },
].sort((a, b) => a.name.localeCompare(b.name));

const ErrorMsg = ({ text }: { text: string }) => (
  <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
    className="text-[10px] text-red-500 font-bold ml-4 mt-1 text-left">{text}</motion.p>
);

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (uid: string, nombre: string) => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [regNombre, setRegNombre] = useState("");
  const [regApellido, setRegApellido] = useState("");
  const [nacionalidad, setNacionalidad] = useState("");
  const [telefono, setTelefono] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);
  const [successUserName, setSuccessUserName] = useState("");
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  useEffect(() => {
    const country = ALL_COUNTRIES.find(c => c.name === nacionalidad);
    if (country) setTelefono(country.lada + " ");
  }, [nacionalidad]);

  const storeUser = (data: Record<string, any>) => {
    const user = {
      uid: data.user?.uid,
      email: data.user?.email,
      nombre: data.user?.nombre || data.user?.["01_nombre"] || "",
      apellido: data.user?.apellido || data.user?.["02_apellido"] || "",
      fotoPerfil: data.user?.fotoPerfil || null,
      telefono: data.user?.telefono || "No registrado",
      nacionalidad: data.user?.nacionalidad || "No registrado",
      especialidades: data.user?.especialidades || [],
      role: data.user?.role || "turista",
      guide_status: data.user?.guide_status || "ninguno",
    };
    if (data.token) localStorage.setItem("pitzbol_token", data.token);
    localStorage.setItem("pitzbol_user", JSON.stringify(user));
    sessionStorage.setItem("pitzbol_uid", data.user?.uid || "");
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("authStateChanged"));
  };

  const handleRegister = async () => {
    setErrors({});
    const newErrors: Record<string, string> = {};
    if (!regNombre.trim()) newErrors.nombre = "Campo requerido";
    if (!regApellido.trim()) newErrors.apellido = "Campo requerido";
    if (!nacionalidad) newErrors.nacionalidad = "Campo requerido";
    if (telefono.replace(/\s/g, "").length < 10) newErrors.telefono = "Número incompleto";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) newErrors.email = "Correo inválido";
    if (regPassword.length < 6) newErrors.password = "Mínimo 6 caracteres";
    if (regPassword !== regConfirmPassword) newErrors.confirmPassword = "Las contraseñas no coinciden";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: regEmail, password: regPassword, nombre: regNombre,
          apellido: regApellido, telefono: telefono.replace(/\s/g, ""),
          nacionalidad, role: "turista",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data?.msg || "Error al registrar"); return; }

      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail, password: regPassword }),
      });
      const loginData = await loginRes.json().catch(() => ({}));
      if (!loginRes.ok) { alert("Registro completado, pero falló el inicio de sesión."); onClose(); return; }

      storeUser(loginData);
      setSuccessUserName(loginData.user?.nombre || regNombre);
      setIsNewAccount(true);
      setShowLoginSuccess(true);
      setTimeout(() => onSuccess(loginData.user?.uid, loginData.user?.nombre || regNombre), 2000);
    } catch { alert("Error de conexión con el servidor."); }
  };

  const handleLogin = async () => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        storeUser(data);
        setSuccessUserName(data.user?.nombre || data.user?.["01_nombre"] || "Usuario");
        setIsNewAccount(false);
        setShowLoginSuccess(true);
        setTimeout(() => onSuccess(data.user?.uid, data.user?.nombre || "Usuario"), 2000);
      } else {
        const msg = data?.msg || data?.message || data?.error ||
          (res.status === 401 ? "Credenciales inválidas." :
           res.status === 404 ? "Usuario no encontrado." : `Error (${res.status})`);
        alert(msg);
      }
    } catch { alert("Error de conexión con el servidor."); }
  };

  if (!isOpen) return null;

  const inputClass = "w-full px-6 py-2.5 bg-transparent border border-[#1A4D2E]/20 rounded-full outline-none text-[#1A4D2E] transition-all focus:border-[#0D601E] focus:ring-2 focus:ring-[#0D601E]/10 placeholder:text-gray-500 text-sm md:text-base";
  const iconColor = "#769C7B";
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center p-0 md:p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative bg-white w-full max-w-[500px] md:max-w-[950px] rounded-t-[30px] md:rounded-[50px] overflow-hidden shadow-2xl flex flex-col md:flex-row border border-white/20"
        style={{
          height: showLoginSuccess
            ? isMobile ? "400px" : "280px"
            : isMobile ? (isLogin ? "75vh" : "85vh") : "600px",
        }}
      >
        {showLoginSuccess ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 bg-gradient-to-br from-[#0D601E] to-[#0a4620] flex flex-col items-center justify-center z-50 rounded-t-[30px] md:rounded-[50px] text-center px-6"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
              className="w-16 h-16 bg-green-400 rounded-full flex items-center justify-center mb-5 shadow-lg shadow-black/20"
            >
              <svg className="w-9 h-9 text-[#0D601E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
            <motion.h2 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-2xl md:text-3xl font-black text-white mb-2" style={{ fontFamily: "var(--font-jockey)" }}>
              {isNewAccount ? "¡CUENTA CREADA!" : "¡BIENVENIDO!"}
            </motion.h2>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="text-green-100 text-lg md:text-xl font-semibold">{successUserName}</motion.p>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="text-green-200 text-sm md:text-base mt-4">Redirigiendo...</motion.p>
          </motion.div>
        ) : (
          <>
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-4 md:hidden mb-2" />
            <button onClick={onClose} className="absolute top-4 md:top-6 right-6 md:right-8 z-[210] text-gray-400 hover:text-red-500 transition-all">
              <FiX size={28} />
            </button>

            {/* LOGIN */}
            <form onSubmit={e => { e.preventDefault(); handleLogin(); }}
              className={`w-full md:w-1/2 h-full p-8 md:p-12 flex flex-col items-center justify-center bg-white transition-opacity duration-300 ${!isLogin && isMobile ? "hidden opacity-0" : "flex opacity-100"}`}>
              <h2 className="text-[32px] md:text-[42px] text-[#8B0000] mb-8 font-black text-center" style={{ fontFamily: "var(--font-jockey)" }}>
                INICIAR SESIÓN
              </h2>
              <div className="w-full max-w-sm space-y-5 text-center">
                <div className="relative text-left">
                  <FiMail color={iconColor} size={18} className="absolute left-5 top-1/2 -translate-y-1/2 z-10" />
                  <input type="email" placeholder="Correo electrónico" className={`${inputClass} pl-14`}
                    value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                </div>
                <div className="text-left">
                  <div className="relative">
                    <FiLock color={iconColor} size={18} className="absolute left-5 top-1/2 -translate-y-1/2 z-10" />
                    <input type={showLoginPassword ? "text" : "password"} placeholder="Contraseña"
                      className={`${inputClass} pl-14 pr-14`} style={{ fontFamily: "Inter, sans-serif" }}
                      value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                    <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#0D601E]">
                      {showLoginPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                  <div className="text-right mt-2 px-4">
                    <a href={`${process.env.NEXT_PUBLIC_FRONTEND_URL || "http://69.30.204.56:3000"}/forgot-password`}
                      className="text-[11px] md:text-[13px] text-gray-500 hover:text-[#0D601E] transition-colors italic">
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>
                </div>
                <button type="submit" className="w-full md:w-3/4 mx-auto bg-[#0D601E] text-white py-2.5 rounded-full hover:bg-[#094d18] transition-all shadow-md text-sm tracking-wide font-medium mt-4">
                  Entrar
                </button>
                <div className="md:hidden mt-8">
                  <p className="text-gray-500 text-xs">¿Sin cuenta?{" "}
                    <button type="button" onClick={() => setIsLogin(false)} className="text-[#8B0000] font-bold underline italic">
                      Crear cuenta
                    </button>
                  </p>
                </div>
              </div>
            </form>

            {/* REGISTRO */}
            <form onSubmit={e => { e.preventDefault(); handleRegister(); }}
              className={`w-full md:w-1/2 h-full p-8 md:p-12 flex flex-col items-center justify-center bg-white border-l border-gray-100 overflow-y-auto transition-opacity duration-300 ${isLogin && isMobile ? "hidden opacity-0" : "flex opacity-100"}`}>
              <h2 className="text-[32px] md:text-[42px] text-[#8B0000] mb-6 font-black text-center uppercase" style={{ fontFamily: "var(--font-jockey)" }}>
                CREAR CUENTA
              </h2>
              <div className="w-full max-w-sm flex flex-col gap-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input placeholder="Nombre *" className={`${inputClass} ${errors.nombre ? "border-red-500 bg-red-50" : ""}`}
                      value={regNombre} onChange={e => setRegNombre(capitalize(e.target.value))} />
                    {errors.nombre && <ErrorMsg text={errors.nombre} />}
                  </div>
                  <div>
                    <input placeholder="Apellido *" className={`${inputClass} ${errors.apellido ? "border-red-500 bg-red-50" : ""}`}
                      value={regApellido} onChange={e => setRegApellido(capitalize(e.target.value))} />
                    {errors.apellido && <ErrorMsg text={errors.apellido} />}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <select value={nacionalidad} onChange={e => setNacionalidad(e.target.value)}
                      className={`${inputClass} appearance-none pr-10 ${errors.nacionalidad ? "border-red-500 bg-red-50" : ""}`}>
                      <option value="" disabled>Nacionalidad *</option>
                      {ALL_COUNTRIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    {errors.nacionalidad && <ErrorMsg text={errors.nacionalidad} />}
                  </div>
                  <div>
                    <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Teléfono *"
                      className={`${inputClass} ${errors.telefono ? "border-red-500 bg-red-50" : ""}`} />
                    {errors.telefono && <ErrorMsg text={errors.telefono} />}
                  </div>
                </div>
                <div className="relative">
                  <FiMail color={iconColor} size={18} className="absolute left-5 top-1/2 -translate-y-1/2 z-10" />
                  <input placeholder="Correo electrónico *" className={`${inputClass} pl-14 ${errors.email ? "border-red-500 bg-red-50" : ""}`}
                    value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                  {errors.email && <ErrorMsg text={errors.email} />}
                </div>
                <div className="relative">
                  <div className="relative text-left">
                    <FiLock color={iconColor} size={18} className="absolute left-5 top-1/2 -translate-y-1/2 z-10" />
                    <input type={showRegPassword ? "text" : "password"} placeholder="Contraseña * (mín. 6)"
                      className={`${inputClass} pl-14 pr-12 ${errors.password ? "border-red-500 bg-red-50" : ""}`}
                      value={regPassword} onChange={e => setRegPassword(e.target.value)} />
                    <button type="button" tabIndex={-1} onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#0D601E]">
                      {showRegPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    </button>
                  </div>
                  <div className="absolute -bottom-4 left-0 w-full">
                    {errors.password && <ErrorMsg text={errors.password} />}
                  </div>
                </div>
                <div className="relative">
                  <div className="relative text-left">
                    <FiLock color={iconColor} size={18} className="absolute left-5 top-1/2 -translate-y-1/2 z-10" />
                    <input type={showRegConfirmPassword ? "text" : "password"} placeholder="Confirmar contraseña *"
                      className={`${inputClass} pl-14 pr-12 ${errors.confirmPassword ? "border-red-500 bg-red-50" : ""}`}
                      value={regConfirmPassword} onChange={e => setRegConfirmPassword(e.target.value)} />
                    <button type="button" tabIndex={-1} onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#0D601E]">
                      {showRegConfirmPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    </button>
                  </div>
                  <div className="absolute -bottom-4 left-0 w-full">
                    {errors.confirmPassword && <ErrorMsg text={errors.confirmPassword} />}
                  </div>
                </div>
                <button type="submit" className="w-full bg-[#0D601E] text-white py-2.5 rounded-full hover:bg-[#094d18] shadow-md text-sm tracking-wide font-medium">
                  Registrarse
                </button>
                <div className="md:hidden text-center mt-4 pb-4">
                  <p className="text-gray-500 text-xs">¿Ya tienes cuenta?{" "}
                    <button type="button" onClick={() => setIsLogin(true)} className="text-[#8B0000] font-bold underline italic">
                      Inicia sesión
                    </button>
                  </p>
                </div>
              </div>
            </form>

            {/* PANEL VERDE DESLIZABLE (desktop) */}
            <motion.div
              animate={{ x: isLogin ? 0 : "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="hidden md:flex absolute top-0 left-0 w-1/2 h-full bg-[#B2C7B5] z-[205] flex-col items-center justify-center p-8 md:p-12 text-center pointer-events-none"
            >
              <div className="pointer-events-auto">
                <h2 className="text-[40px] md:text-[54px] text-[#1A4D2E] leading-none mb-4" style={{ fontFamily: "var(--font-jockey)" }}>
                  BIENVENIDO
                </h2>
                <p className="text-[#1A4D2E] mb-8 font-medium text-sm md:text-base">
                  {isLogin ? "¿Ya tienes cuenta?" : "¿Sin cuenta?"}
                </p>
                <button onClick={() => setIsLogin(!isLogin)}
                  className="px-8 md:px-12 py-3 border-2 border-[#8B0000] text-[#8B0000] rounded-full hover:bg-[#8B0000] hover:text-white transition-all text-[11px] md:text-[14px]">
                  {isLogin ? "Entrar" : "Registrarse"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}
