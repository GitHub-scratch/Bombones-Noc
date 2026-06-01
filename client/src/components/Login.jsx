import React, { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/auth/login`, { username, password });
      localStorage.setItem('noc_token', data.token);
      onLogin(data.user, data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-chocolate dark:bg-[#1a0f0d] flex items-center justify-center p-4 transition-colors duration-500">
      <div className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-700">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-white dark:bg-[#231512] rounded-2xl flex items-center justify-center shadow-2xl mb-4 overflow-hidden border border-white/5">
            <img
              src="/logo.png"
              alt="Bombones Noc"
              className="w-full h-full object-contain"
              onError={(e) => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=Everest&background=E31B54&color=fff&bold=true'; }}
            />
          </div>
          <h1 className="text-3xl font-black text-white dark:text-cream tracking-tight uppercase">Bombones <span className="text-raspberry">Noc</span></h1>
          <p className="text-white/40 dark:text-white/20 text-xs font-bold tracking-widest uppercase mt-1">Sistema de Producción</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#231512] rounded-3xl p-8 shadow-2xl border border-white/5 transition-colors duration-500">
          <h2 className="text-xl font-black text-chocolate dark:text-cream mb-6">Iniciar sesión</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-black text-slate-500 dark:text-white/40 uppercase tracking-widest block mb-1.5 ml-1">Usuario</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 rounded-xl text-sm font-bold text-chocolate dark:text-cream border border-slate-100 dark:border-white/5 outline-none focus:ring-4 focus:ring-chocolate/10 transition-all placeholder:text-slate-300 dark:placeholder:text-white/10"
                placeholder="admin"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500 dark:text-white/40 uppercase tracking-widest block mb-1.5 ml-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 rounded-xl text-sm font-bold text-chocolate dark:text-cream border border-slate-100 dark:border-white/5 outline-none focus:ring-4 focus:ring-chocolate/10 transition-all placeholder:text-slate-300 dark:placeholder:text-white/10"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-raspberry/5 border border-raspberry/10 rounded-xl px-4 py-3 text-raspberry text-xs font-bold animate-pulse">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-chocolate dark:bg-chocolate-light text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-chocolate/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Verificando...' : 'Entrar al Sistema'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
