import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  PlusCircle, Trash2, Settings as SettingsIcon, Edit3, Save, X,
  RefreshCw, Check, AlertCircle, Lock, UserPlus, Key, Users, Shield
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const cn = (...classes) => classes.filter(Boolean).join(' ');

export default function Settings({ materials, fetchData, showToast, user, token: tokenProp }) {
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [activeTab, setActiveTab] = useState('materiales');
  const [users, setUsers] = useState([]);
  const [newMaterialUnit, setNewMaterialUnit] = useState('kg');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);

  const getToken = () => tokenProp || user?.token || localStorage.getItem('noc_token');
  const authHeaders = () => {
    const t = getToken();
    return t ? { headers: { Authorization: `Bearer ${t}` } } : {};
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data } = await axios.get(`${API_URL}/usuarios`, authHeaders());
      setUsers(data || []);
    } catch (err) {
      showToast('Error al cargar usuarios: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setLoadingUsers(false);
    }
  };

  const deleteMaterial = async (id) => {
    if (!window.confirm('¿Eliminar este material? Esto podría afectar registros históricos.')) return;
    try {
      await axios.delete(`${API_URL}/materials/${id}`, authHeaders());
      showToast('Material eliminado');
      fetchData();
    } catch (err) {
      showToast('Error al eliminar material', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'usuarios') fetchUsers();
  }, [activeTab]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    const form = e.target;
    const userData = {
      username: form.username.value,
      password: form.password.value,
      nombre: form.nombre.value,
      rol: form.rol.value,
      permisos: {
        dashboard: form.p_dashboard.checked,
        inventory_in: form.p_inventory_in.checked,
        inventory_out: form.p_inventory_out.checked,
        production: form.p_production.checked,
        guarda: form.p_guarda.checked,
        history: form.p_history.checked,
        settings: form.p_settings.checked,
      }
    };
    try {
      await axios.post(`${API_URL}/usuarios`, userData, authHeaders());
      showToast('Usuario creado con éxito');
      form.reset();
      setShowUserForm(false);
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Error al crear usuario', 'error');
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    const form = e.target;
    const userData = {
      nombre: form.nombre.value,
      rol: form.rol.value,
      activo: form.activo.checked,
      permisos: {
        dashboard: form.p_dashboard.checked,
        inventory_in: form.p_inventory_in.checked,
        inventory_out: form.p_inventory_out.checked,
        production: form.p_production.checked,
        guarda: form.p_guarda.checked,
        history: form.p_history.checked,
        settings: form.p_settings.checked,
      }
    };
    if (form.password.value) userData.password = form.password.value;
    try {
      await axios.put(`${API_URL}/usuarios/${editingUser.id}`, userData, authHeaders());
      showToast('Usuario actualizado con éxito');
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Error al actualizar usuario', 'error');
    }
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const materialData = {
      name: formData.get('name'),
      unit: formData.get('unit'),
      min_stock: parseFloat(formData.get('min_stock')) || 0,
      category: formData.get('category'),
      base_cost: parseFloat(formData.get('base_cost')) || 0
    };
    try {
      await axios.post(`${API_URL}/materials`, materialData, authHeaders());
      e.target.reset();
      await fetchData();
      showToast('Nuevo material agregado');
    } catch (err) {
      showToast('Error al agregar material', 'error');
    }
  };

  const handleEditMaterial = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const materialData = {
      name: formData.get('name'),
      unit: formData.get('unit'),
      min_stock: parseFloat(formData.get('min_stock')) || 0,
      category: formData.get('category'),
      base_cost: parseFloat(formData.get('base_cost')) || 0
    };
    try {
      await axios.put(`${API_URL}/materials/${editingMaterial.id}`, materialData, authHeaders());
      setEditingMaterial(null);
      await fetchData();
      showToast('Material actualizado correctamente');
    } catch (err) {
      showToast('Error al actualizar material', 'error');
    }
  };

  const tabs = [
    { id: 'materiales', label: 'Insumos', icon: SettingsIcon },
    { id: 'usuarios', label: 'Usuarios', icon: Users },
  ];

  const permisosList = [
    { id: 'dashboard', label: 'Stock' },
    { id: 'inventory_in', label: 'Ingreso MP' },
    { id: 'inventory_out', label: 'Egreso MP' },
    { id: 'production', label: 'Producción' },
    { id: 'guarda', label: 'Guarda' },
    { id: 'history', label: 'Historial' },
    { id: 'settings', label: 'Config' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-chocolate dark:text-cream">Panel de <span className="text-raspberry">Sistema</span></h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-chocolate/40 dark:text-white/30 mt-1">Configuración técnica y gestión de accesos</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === tab.id
                ? "bg-chocolate dark:bg-chocolate-light text-white shadow-lg shadow-chocolate/20"
                : "text-chocolate/40 dark:text-white/20 hover:text-chocolate dark:hover:text-cream hover:bg-white dark:hover:bg-white/5"
            )}>
            <tab.icon size={14} />{tab.label}
          </button>
        ))}
      </div>

      {/* MATERIALES */}
      {activeTab === 'materiales' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-white/5 rounded-2xl p-6 shadow-sm">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-chocolate/50 dark:text-white/30 mb-4 flex items-center gap-2"><PlusCircle size={14}/>Nuevo Material</h3>
            <form onSubmit={handleAddMaterial} className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40 dark:text-white/30">Nombre</label>
                <input name="name" required placeholder="Ej: Avellanas" className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors"/>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40 dark:text-white/30">Categoría</label>
                <select name="category" className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors">
                  <option value="FRUTA">Fruta</option>
                  <option value="CHOCOLATE">Chocolate</option>
                  <option value="OTRO">Otro / Insumo</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40 dark:text-white/30">Unidad</label>
                <input name="unit" required placeholder="kg" onChange={(e) => setNewMaterialUnit(e.target.value || 'kg')} className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors"/>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40 dark:text-white/30">Costo Sugerido (CLP)</label>
                <input name="base_cost" type="number" step="0.01" placeholder="0" className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-emerald-600 dark:text-emerald-400 text-xs transition-colors"/>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40 dark:text-white/30">Mínimo ({newMaterialUnit})</label>
                <input name="min_stock" type="number" step="0.01" className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors"/>
              </div>
              <div className="flex items-end col-span-2 md:col-span-3">
                <button type="submit" className="w-full bg-chocolate dark:bg-chocolate-light text-white p-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:opacity-90 transition-all">Crear Material</button>
              </div>
            </form>
          </div>

          <div className="bg-white dark:bg-white/5 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-slate-100 dark:border-white/5">
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-chocolate/30 dark:text-white/20">Insumo</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-chocolate/30 dark:text-white/20">Categoría</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-chocolate/30 dark:text-white/20">Unidad</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-chocolate/30 dark:text-white/20">Alerta Stock</th>
                <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-chocolate/30 dark:text-white/20">Acciones</th>
              </tr></thead>
              <tbody>
                {materials.map(m => (
                  <tr key={m.id} className="border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4 font-bold text-xs text-chocolate dark:text-cream">{m.name}</td>
                    <td className="p-4"><span className="text-[9px] font-black uppercase tracking-widest bg-chocolate/10 text-chocolate dark:bg-white/10 dark:text-white/60 px-2 py-1 rounded-lg">{m.category || 'OTRO'}</span></td>
                    <td className="p-4 text-xs font-bold text-chocolate/60 dark:text-white/40">{m.unit}</td>
                    <td className="p-4 text-xs font-bold text-raspberry">{m.min_stock}</td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <button onClick={() => setEditingMaterial(m)} className="p-2 text-slate-200 dark:text-white/10 hover:text-chocolate dark:hover:text-cream hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"><Edit3 size={14}/></button>
                        <button onClick={() => deleteMaterial(m.id)} className="p-2 text-slate-200 dark:text-white/10 hover:text-raspberry hover:bg-raspberry/5 rounded-lg transition-all"><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editingMaterial && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-chocolate dark:text-cream">Editar Material</h3>
                  <button onClick={() => setEditingMaterial(null)} className="p-2 text-slate-300 dark:text-white/20 hover:text-raspberry transition-colors"><X size={18}/></button>
                </div>
                <form onSubmit={handleEditMaterial} className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40">Nombre</label>
                    <input name="name" defaultValue={editingMaterial.name} required className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs"/>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40">Categoría</label>
                    <select name="category" defaultValue={editingMaterial.category} className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs">
                      <option value="FRUTA">Fruta</option>
                      <option value="CHOCOLATE">Chocolate</option>
                      <option value="OTRO">Otro / Insumo</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40">Unidad</label>
                    <input name="unit" defaultValue={editingMaterial.unit} required className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs"/>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40">Costo Base</label>
                    <input name="base_cost" type="number" step="0.01" defaultValue={editingMaterial.base_cost} className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-emerald-600 text-xs"/>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40">Mínimo Stock</label>
                    <input name="min_stock" type="number" step="0.01" defaultValue={editingMaterial.min_stock} className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs"/>
                  </div>
                  <div className="flex gap-2 col-span-2 mt-2">
                    <button type="submit" className="flex-1 bg-chocolate text-white p-4 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] hover:opacity-90 transition-all flex items-center justify-center gap-2"><Save size={14}/>Guardar Cambios</button>
                    <button type="button" onClick={() => setEditingMaterial(null)} className="flex-1 bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/40 p-4 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-200 transition-all flex items-center justify-center gap-2"><X size={14}/>Cancelar</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* USUARIOS */}
      {activeTab === 'usuarios' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-white/5 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-chocolate/50 dark:text-white/30 flex items-center gap-2"><Users size={14}/>Usuarios Autorizados</h3>
              <button onClick={() => setShowUserForm(!showUserForm)} className="flex items-center gap-2 bg-raspberry text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all">
                {showUserForm ? <X size={14}/> : <UserPlus size={14}/>}
                {showUserForm ? 'Cancelar' : 'Nuevo Acceso'}
              </button>
            </div>

            {showUserForm && (
              <form onSubmit={handleAddUser} className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 p-4 bg-slate-50 dark:bg-black/20 rounded-xl">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40">Nombre Real</label>
                  <input name="nombre" required className="w-full p-3.5 bg-white dark:bg-black/40 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs"/>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40">Usuario</label>
                  <input name="username" required className="w-full p-3.5 bg-white dark:bg-black/40 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs"/>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40">Password</label>
                  <input name="password" type="password" required className="w-full p-3.5 bg-white dark:bg-black/40 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs"/>
                </div>
                <div className="col-span-2 md:col-span-3">
                  <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40 mb-2 block">Permisos de Navegación</label>
                  <div className="flex flex-wrap gap-3">
                    {permisosList.map(p => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" name={`p_${p.id}`} defaultChecked className="w-4 h-4 rounded accent-raspberry"/>
                        <span className="text-[9px] font-black text-chocolate/50 dark:text-white/40">{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40">Rol</label>
                  <select name="rol" className="w-full bg-white dark:bg-black/40 border-none rounded-lg text-[10px] font-black text-chocolate dark:text-cream p-2 shadow-sm">
                    <option value="operador">Operador</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex items-end col-span-2">
                  <button type="submit" className="w-full bg-raspberry text-white p-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2"><Check size={14}/>Crear Acceso</button>
                </div>
              </form>
            )}

            {loadingUsers ? (
              <div className="flex items-center justify-center p-8"><RefreshCw size={20} className="animate-spin text-chocolate/30"/></div>
            ) : (
              <table className="w-full">
                <thead><tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-chocolate/30">Colaborador</th>
                  <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-chocolate/30">Usuario</th>
                  <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-chocolate/30">Nivel</th>
                  <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-chocolate/30">Estado</th>
                  <th className="text-left p-4 text-[9px] font-black uppercase tracking-widest text-chocolate/30">Acciones</th>
                </tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-xs text-chocolate dark:text-cream">{u.nombre}</td>
                      <td className="p-4 text-xs text-chocolate/60 dark:text-white/40 font-mono">{u.username}</td>
                      <td className="p-4"><span className="text-[9px] font-black uppercase bg-chocolate/10 text-chocolate dark:bg-white/10 dark:text-white/60 px-2 py-1 rounded-lg">{u.rol}</span></td>
                      <td className="p-4"><span className={cn("text-[9px] font-black uppercase px-2 py-1 rounded-lg", u.activo ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500")}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                      <td className="p-4">
                        <button onClick={() => setEditingUser(u)} className="p-2 text-slate-300 dark:text-white/10 hover:text-chocolate dark:hover:text-cream hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"><Edit3 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {editingUser && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-chocolate dark:text-cream">Editar Perfil: <span className="text-raspberry">{editingUser.username}</span></h3>
                  <button onClick={() => setEditingUser(null)} className="p-2 text-slate-300 dark:text-white/20 hover:text-raspberry transition-colors"><X size={18}/></button>
                </div>
                <form onSubmit={handleEditUser} className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40">Nombre Completo</label>
                    <input name="nombre" defaultValue={editingUser.nombre} required className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs"/>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40">Nueva Contraseña (dejar vacío para no cambiar)</label>
                    <input name="password" type="password" placeholder="••••••••" className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs"/>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40">Rol</label>
                    <select name="rol" defaultValue={editingUser.rol} className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs">
                      <option value="operador">Operador</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 dark:bg-black/20 rounded-xl">
                    <input type="checkbox" name="activo" defaultChecked={editingUser.activo} className="w-5 h-5 rounded accent-raspberry"/>
                    <div>
                      <p className="text-xs font-black text-chocolate dark:text-cream">Usuario Activo</p>
                      <p className="text-[9px] text-chocolate/40 dark:text-white/30">Permite o bloquea el acceso al sistema</p>
                    </div>
                  </label>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-chocolate/40 mb-2 block">Permisos de Navegación</label>
                    <div className="flex flex-wrap gap-3">
                      {permisosList.map(p => (
                        <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" name={`p_${p.id}`} defaultChecked={editingUser.permisos?.[p.id]} className="w-4 h-4 rounded accent-raspberry"/>
                          <span className="text-[9px] font-black text-chocolate/50 dark:text-white/40">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="submit" className="flex-1 bg-chocolate text-white p-4 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] hover:opacity-90 transition-all flex items-center justify-center gap-2"><Save size={14}/>Guardar Cambios</button>
                    <button type="button" onClick={() => setEditingUser(null)} className="flex-1 bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/40 p-4 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2"><X size={14}/>Cancelar</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
