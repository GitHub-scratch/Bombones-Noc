import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
PlusCircle, Trash2, Settings as SettingsIcon, Edit3, Save, X,
  Check, AlertCircle, Lock, UserPlus, Key
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const cn = (...classes) => classes.filter(Boolean).join(' ');

export default function Settings({ materials, fetchData, showToast, user, token: tokenProp }) {
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [activeTab, setActiveTab] = useState('materiales');
  const [users, setUsers] = useState([]);
  const [newMaterialUnit, setNewMaterialUnit] = useState('kg');

  // ... (getToken, authHeaders, fetchUsers, etc.)

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


  useEffect(() => {
    if (activeTab === 'usuarios') fetchUsers();
     [activeTab]);

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
      console.error('Error al agregar material:', err);
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
    
    console.log('Enviando actualización de material:', materialData);
    
    try {
      await axios.put(`${API_URL}/materials/${editingMaterial.id}`, materialData, authHeaders());
      setEditingMaterial(null);
      await fetchData();
      showToast('Material actualizado correctamente');
    } catch (err) {
      console.error('Error al actualizar material:', err);
      showToast('Error al actualizar material', 'error');
    }
  };

  const tabs = [
    { id: 'materiales', label: 'Insumos',  icon: SettingsIcon },
    { id: 'usuarios',   label: 'Usuarios', icon: Users },
      ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h2 className="text-3xl font-black text-chocolate dark:text-cream tracking-tighter uppercase">Panel de <span className="text-raspberry">Sistema</span></h2>
        <p className="text-slate-400 dark:text-white/40 font-bold uppercase text-[9px] tracking-[0.3em] mt-1 ml-1">Configuración técnica y gestión de accesos</p>
      </header>

      {/* TABS DESIGN */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-chocolate/5 dark:bg-white/5 rounded-2xl w-fit transition-colors duration-500">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === tab.id 
                ? "bg-chocolate dark:bg-chocolate-light text-white shadow-lg shadow-chocolate/20" 
                : "text-chocolate/40 dark:text-white/20 hover:text-chocolate dark:hover:text-cream hover:bg-white dark:hover:bg-white/5"
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT: MATERIALES */}
      {activeTab === 'materiales' && (
        <div className="grid grid-cols-1 gap-8 animate-in slide-in-from-bottom-6">
          <section className="bg-white dark:bg-[#231512] p-6 rounded-[2rem] shadow-xl border border-chocolate/5 dark:border-white/5 transition-colors duration-500">
            <h3 className="text-lg font-black text-chocolate dark:text-cream mb-6 flex items-center gap-3 uppercase">
               <div className="p-2 bg-chocolate/5 dark:bg-white/5 text-chocolate dark:text-cream rounded-xl"><PlusCircle size={20}/></div>
               Nuevo Material
            </h3>
            <form onSubmit={handleAddMaterial} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="md:col-span-2 space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2">Nombre</label>
                <input name="name" required placeholder="Ej: Avellanas" className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2">Categoría</label>
                <select name="category" className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors">
                  <option value="FRUTA">Fruta</option>
                  <option value="CHOCOLATE">Chocolate</option>
                  <option value="OTRO">Otro / Insumo</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2">Unidad</label>
                <input name="unit" required placeholder="kg" onChange={(e) => setNewMaterialUnit(e.target.value || 'kg')} className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2">Costo Sugerido (CLP)</label>
                <input name="base_cost" type="number" step="0.01" placeholder="0" className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-emerald-600 dark:text-emerald-400 text-xs transition-colors" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2">Mínimo ({newMaterialUnit})</label>
                <input name="min_stock" type="number" step="0.01" className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors" />
              </div>
              <button type="submit" className="md:col-span-5 bg-chocolate dark:bg-chocolate-light text-white p-4 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl hover:scale-[1.01] transition-all">Crear Material</button>
            </form>
          </section>

          <div className="bg-white dark:bg-[#231512] rounded-[2rem] shadow-xl border border-chocolate/5 dark:border-white/5 overflow-hidden transition-colors duration-500">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-white/5">
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest">Insumo</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest text-center">Categoría</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest text-center">Unidad</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest text-right">Alerta Stock</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                {materials.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                    <td className="p-4 text-xs font-black text-chocolate dark:text-cream/90 uppercase">{m.name}</td>
                    <td className="p-4 text-center">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                        m.category === 'FRUTA' ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" :
                        m.category === 'CHOCOLATE' ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400" :
                        "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/40"
                      )}>
                        {m.category || 'OTRO'}
                      </span>
                    </td>
                    <td className="p-4 text-center"><span className="px-2 py-0.5 bg-chocolate/5 dark:bg-white/5 rounded-lg text-[8px] font-black text-chocolate dark:text-cream/60 uppercase">{m.unit}</span></td>
                    <td className="p-4 text-right font-black text-raspberry text-xs">{m.min_stock}</td>
                    <td className="p-4 text-center flex items-center justify-center gap-2">
                       <button onClick={() => setEditingMaterial(m)} className="p-2 text-slate-200 dark:text-white/10 hover:text-chocolate dark:hover:text-cream hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"><Edit3 size={16}/></button>
                       <button onClick={() => deleteMaterial(m.id)} className="p-2 text-slate-200 dark:text-white/10 hover:text-raspberry hover:bg-raspberry/5 rounded-lg transition-all"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MODAL EDITAR MATERIAL */}
          {editingMaterial && (
            <div className="fixed inset-0 bg-chocolate/40 dark:bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 transition-colors">
              <form onSubmit={handleEditMaterial} className="bg-white dark:bg-[#3d1f16] p-8 rounded-[2rem] shadow-2xl w-full max-w-lg space-y-6 animate-in zoom-in-95 duration-200 border border-white/5">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-4">
                  <h3 className="text-xl font-black text-chocolate dark:text-cream uppercase tracking-tighter flex items-center gap-3">
                    <Edit3 size={20} className="text-raspberry" />
                    Editar Material
                  </h3>
                  <button type="button" onClick={() => setEditingMaterial(null)} className="p-2 text-slate-300 dark:text-white/20 hover:text-raspberry transition-colors"><X size={24}/></button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2">Nombre</label>
                    <input name="name" defaultValue={editingMaterial.name} required className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2">Categoría</label>
                    <select name="category" defaultValue={editingMaterial.category} className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors">
                      <option value="FRUTA">Fruta</option>
                      <option value="CHOCOLATE">Chocolate</option>
                      <option value="OTRO">Otro / Insumo</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2">Unidad</label>
                      <input name="unit" defaultValue={editingMaterial.unit} required className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2">Costo Base</label>
                      <input name="base_cost" type="number" step="0.01" defaultValue={editingMaterial.base_cost} className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-emerald-600 dark:text-emerald-400 text-xs transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2">Mínimo Stock ({editingMaterial.unit})</label>
                      <input name="min_stock" type="number" step="0.01" defaultValue={editingMaterial.min_stock} className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 bg-chocolate dark:bg-chocolate-light text-white p-4 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-2">
                     <Save size={18} /> Guardar Cambios
                  </button>
                  <button type="button" onClick={() => setEditingMaterial(null)} className="flex-1 bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/40 p-4 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                     <X size={18} /> Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* CONTENT: USUARIOS */}
      {activeTab === 'usuarios' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-6">
          <div className="flex justify-between items-center px-2">
             <h3 className="text-lg font-black text-chocolate dark:text-cream uppercase tracking-tight">Usuarios Autorizados</h3>
             <button onClick={() => setShowUserForm(!showUserForm)} className="flex items-center gap-2 bg-raspberry text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all">
                {showUserForm ? <X size={14}/> : <UserPlus size={14}/>}
                {showUserForm ? 'Cancelar' : 'Nuevo Acceso'}
             </button>
          </div>

          {showUserForm && (
            <section className="bg-white dark:bg-[#231512] p-6 rounded-[2rem] shadow-xl border border-raspberry/10 transition-colors duration-500">
              <form onSubmit={handleAddUser} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2">Nombre Real</label>
                    <input name="nombre" required className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2">Usuario</label>
                    <input name="username" required className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2">Password</label>
                    <input name="password" type="password" required className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors" />
                  </div>
                </div>

                <div className="space-y-4">
                   <p className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2 flex items-center gap-2"><Shield size={12}/> Permisos de Navegación</p>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-black/20 p-6 rounded-2xl transition-colors">
                      {[
                        { id: 'dashboard', label: 'Stock' },
                        { id: 'inventory_in', label: 'Ingreso MP' },
                        { id: 'inventory_out', label: 'Egreso MP' },
                        { id: 'production', label: 'Producción' },
                        { id: 'guarda', label: 'Guarda' },
                        { id: 'history', label: 'Historial' },
                        { id: 'settings', label: 'Config' },
                                              ].map(p => (
                        <label key={p.id} className="flex items-center gap-2 cursor-pointer group">
                          <input type="checkbox" name={`p_${p.id}`} defaultChecked className="w-4 h-4 rounded border-slate-200 dark:border-white/10 text-raspberry focus:ring-raspberry transition-all" />
                          <span className="text-[9px] font-black text-chocolate/50 dark:text-white/40 group-hover:text-chocolate dark:group-hover:text-cream uppercase tracking-widest transition-colors">{p.label}</span>
                        </label>
                      ))}
                      <div className="md:col-span-1 border-l border-slate-200 dark:border-white/10 pl-4">
                        <label className="text-[8px] font-black uppercase text-slate-400 dark:text-white/40 block mb-1">Rol</label>
                        <select name="rol" className="w-full bg-white dark:bg-black/40 border-none rounded-lg text-[10px] font-black text-chocolate dark:text-cream p-2 shadow-sm transition-colors">
                          <option value="operador">Operador</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                   </div>
                </div>

                <button type="submit" className="w-full bg-chocolate dark:bg-chocolate-light text-white p-4 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] shadow-lg hover:scale-[1.01] transition-all flex items-center justify-center gap-2">
                   <Key size={16} /> Crear Acceso
                </button>
              </form>
            </section>
          )}

          <div className="bg-white dark:bg-[#231512] rounded-[2rem] shadow-xl border border-chocolate/5 dark:border-white/5 overflow-hidden transition-colors duration-500">
            {loadingUsers ? <div className="p-10 text-center"><RefreshCw className="animate-spin mx-auto text-chocolate/10 dark:text-white/10" size={40} /></div> : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-white/5">
                    <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest">Colaborador</th>
                    <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest">Usuario</th>
                    <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest text-center">Nivel</th>
                    <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest text-center">Estado</th>
                    <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                      <td className="p-4 font-black text-chocolate dark:text-cream/90 uppercase text-xs">{u.nombre}</td>
                      <td className="p-4 font-bold text-slate-400 dark:text-white/30 font-mono text-[10px]">{u.username}</td>
                      <td className="p-4 text-center"><span className={cn("px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest", u.rol === 'admin' ? "bg-chocolate dark:bg-chocolate-light text-white" : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/40")}>{u.rol}</span></td>
                      <td className="p-4 text-center"><div className="flex items-center justify-center gap-1.5 font-black text-[9px] uppercase text-slate-400 dark:text-white/40"><div className={cn("w-1.5 h-1.5 rounded-full", u.activo ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" : "bg-raspberry")} />{u.activo ? 'Activo' : 'Inactivo'}</div></td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => setEditingUser(u)}
                          className="p-2 text-slate-300 dark:text-white/10 hover:text-chocolate dark:hover:text-cream hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                        >
                          <Edit3 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* MODAL DE EDICIÓN DE USUARIO */}
          {editingUser && (
            <div className="fixed inset-0 bg-chocolate/40 dark:bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 transition-colors">
              <form onSubmit={handleEditUser} className="bg-white dark:bg-[#3d1f16] p-8 rounded-[2rem] shadow-2xl w-full max-w-2xl space-y-6 animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] border border-white/5">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-4">
                  <h3 className="text-xl font-black text-chocolate dark:text-cream uppercase tracking-tighter flex items-center gap-3">
                    <Edit3 size={20} className="text-raspberry" />
                    Editar Perfil: <span className="text-raspberry">{editingUser.username}</span>
                  </h3>
                  <button type="button" onClick={() => setEditingUser(null)} className="p-2 text-slate-300 dark:text-white/20 hover:text-raspberry transition-colors"><X size={24}/></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2">Nombre Completo</label>
                      <input name="nombre" defaultValue={editingUser.nombre} required className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2">Nueva Contraseña (Dejar vacío para no cambiar)</label>
                      <input name="password" type="password" className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors" placeholder="••••••••" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2">Nivel de Acceso (Rol)</label>
                      <select name="rol" defaultValue={editingUser.rol} className="w-full p-3.5 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs transition-colors">
                        <option value="operador">Operador</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-black/20 rounded-xl transition-colors">
                      <input type="checkbox" name="activo" defaultChecked={editingUser.activo} className="w-5 h-5 rounded border-slate-200 dark:border-white/10 text-raspberry focus:ring-raspberry transition-all" />
                      <div>
                        <p className="text-[10px] font-black text-chocolate dark:text-cream uppercase">Usuario Activo</p>
                        <p className="text-[8px] text-slate-400 dark:text-white/30 font-bold uppercase">Permite o bloquea el acceso al sistema</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                   <p className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 ml-2 flex items-center gap-2"><Shield size={12}/> Permisos de Navegación</p>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-black/20 p-6 rounded-2xl border border-slate-100 dark:border-white/5 transition-colors">
                      {[
                        { id: 'dashboard', label: 'Stock' },
                        { id: 'inventory_in', label: 'Ingreso MP' },
                        { id: 'inventory_out', label: 'Egreso MP' },
                        { id: 'production', label: 'Producción' },
                        { id: 'guarda', label: 'Guarda' },
                        { id: 'history', label: 'Historial' },
                        { id: 'settings', label: 'Config' },
                                              ].map(p => (
                        <label key={p.id} className="flex items-center gap-2 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            name={`p_${p.id}`} 
                            defaultChecked={editingUser.permisos[p.id]} 
                            className="w-4 h-4 rounded border-slate-200 dark:border-white/10 text-raspberry focus:ring-raspberry transition-all" 
                          />
                          <span className="text-[9px] font-black text-chocolate/50 dark:text-white/40 group-hover:text-chocolate dark:group-hover:text-cream uppercase tracking-widest transition-colors">{p.label}</span>
                        </label>
                      ))}
                   </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 bg-chocolate dark:bg-chocolate-light text-white p-4 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-2">
                     <Save size={18} /> Guardar Cambios
                  </button>
                  <button type="button" onClick={() => setEditingUser(null)} className="flex-1 bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/40 p-4 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                     <X size={18} /> Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      div>
  );
}
