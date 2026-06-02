import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LayoutDashboard, PackagePlus, History, Settings, Zap,
  ArrowUpRight, ClipboardList, LogOut, Lock, Database
} from 'lucide-react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

export default function Sidebar({ activeTab, setActiveTab, lowStockCount, currentUser, onLogout, permisos }) {
  const [serverStatus, setServerStatus] = useState('checking');

  const checkServer = async () => {
    try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/materials`, { timeout: 3000 });
      setServerStatus(res.status === 200 ? 'online' : 'offline');
    } catch { setServerStatus('offline'); }
  };

  useEffect(() => {
    checkServer();
    const i = setInterval(checkServer, 15000);
    return () => clearInterval(i);
  }, []);

  const menuItems = [
    { id: 'dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'inventory',  icon: PackagePlus,      label: 'Bodega de Insumos' },
    { id: 'production', icon: Zap,              label: 'Producción' },
    { id: 'guarda',     icon: ArrowUpRight,     label: 'Salida a Guarda' },
    { id: 'settings',   icon: Settings,         label: 'Configuración' },
  ];

  return (
    <aside className="w-64 h-full bg-chocolate text-white flex flex-col shrink-0 border-r border-white/5 shadow-[10px_0_30px_rgba(0,0,0,0.2)] z-50">
      {/* Logo Section */}
      <div className="p-8 pb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl shadow-black/10 border border-white/10 overflow-hidden">
            <img src="/logo.png" alt="Logo Noc" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter uppercase leading-none text-white">Bombones<br/><span className="text-raspberry">NOC</span></h1>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-1">
          <div className={cn(
            "w-2 h-2 rounded-full animate-pulse",
            serverStatus === 'online' ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" : "bg-raspberry shadow-[0_0_8px_rgba(230,57,70,0.8)]"
          )} />
          <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">Sistema {serverStatus === 'online' ? 'Conectado' : 'Desconectado'}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
        {menuItems.map(({ id, icon: Icon, label }) => {
          const esAdmin = currentUser?.rol === 'admin'; let tienePermiso = esAdmin || !permisos || permisos[id] !== false;
          if (id === 'inventory') {
            tienePermiso = !permisos || permisos.inventory !== false || permisos.inventory_in !== false || permisos.inventory_out !== false;
          }
          const isActive = activeTab === id;
          const badge = id === 'dashboard' ? lowStockCount : 0;

          if (!tienePermiso) return null;

          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 group relative overflow-hidden",
                isActive 
                  ? "bg-white text-chocolate shadow-2xl translate-x-1" 
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-raspberry" />}
              <Icon size={18} className={cn(isActive ? "text-raspberry" : "group-hover:scale-110 group-hover:text-white transition-all")} />
              <span className="flex-1 text-left">{label}</span>
              {badge > 0 && (
                <span className={cn(
                  "px-2 py-0.5 rounded-lg text-[9px] font-black",
                  isActive ? "bg-raspberry text-white" : "bg-raspberry/20 text-raspberry"
                )}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-6 space-y-4 bg-black/20 border-t border-white/5">
        {currentUser && (
          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors cursor-default min-w-0">
            <div className="w-10 h-10 bg-chocolate-light rounded-xl flex items-center justify-center border border-white/10 shadow-inner shrink-0">
              <span className="text-sm font-black text-raspberry">{currentUser.nombre.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-tight truncate text-white">{currentUser.nombre}</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 bg-raspberry rounded-full" />
                <p className="text-[7px] font-black text-white/40 uppercase tracking-[0.2em]">{currentUser.rol}</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-[9px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-raspberry hover:bg-raspberry/10 transition-all border border-transparent hover:border-raspberry/20 active:scale-95"
        >
          <LogOut size={14} />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
