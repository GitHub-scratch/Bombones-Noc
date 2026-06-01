import React, { useState } from 'react';
import axios from 'axios';
import Valuation from './Valuation';
import { 
  PackagePlus, PackageMinus, History, Edit3, Trash2, Save, X, 
  Coins, Grape, Package, Search, Calendar, ChevronDown, ChevronUp, PlusCircle, Lock,
  AlertTriangle, AlertCircle, Info, ClipboardList, Database
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const cn = (...classes) => classes.filter(Boolean).join(' ');

export default function Inventory({ materials, stock, ptStock, productionHistory, movements, fetchData, showToast, userPermisos }) {
  const [materialForExit, setMaterialForExit] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [editingMovement, setEditingMovement] = useState(null);
  const [expandedMaterials, setExpandedMaterials] = useState({});
  const [valuation, setValuation] = useState(0);
  const [traceLote, setTraceLote] = useState('');
  const [traceResults, setTraceResults] = useState(null);
  const [auditMode, setAuditMode] = useState(false);
  const [auditForm, setAuditModeForm] = useState({});
  const [showValuationDetail, setShowValuationDetail] = useState(false);

  const loadValuation = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/business/valuation`);
      setValuation(Number(data.total_valuation) || 0);
    } catch (e) { console.error("Error loading valuation", e); }
  };

  React.useEffect(() => {
    loadValuation();
  }, [stock]);

  const handleAuditSubmit = async (e) => {
    e.preventDefault();
    if (!window.confirm('¿Confirmar auditoría? Se generarán ajustes automáticos de stock.')) return;
    
    try {
      showToast('Procesando ajustes...', 'info');
      for (const matId in auditForm) {
        const currentStock = stock.filter(s => s.material_id === parseInt(matId)).reduce((a, c) => a + (c.quantity || 0), 0);
        const physicalStock = parseFloat(auditForm[matId]);
        const diff = physicalStock - currentStock;

        if (diff !== 0) {
          const batches = stock.filter(s => s.material_id === parseInt(matId));
          const batchId = batches.length > 0 ? batches[0].batch_id : null;
          
          if (batchId) {
            if (diff < 0) {
              await axios.post(`${API_URL}/inventory/out`, { batch_id: batchId, quantity: Math.abs(diff), description: 'AJUSTE AUDITORÍA' });
            } else {
              await axios.post(`${API_URL}/inventory/in`, { material_id: matId, lote: 'ADJ-AUDIT', quantity: diff, expiry_date: '', description: 'AJUSTE AUDITORÍA' });
            }
          }
        }
      }
      setAuditMode(false);
      setAuditModeForm({});
      await fetchData();
      showToast('Auditoría completada con éxito');
    } catch (err) {
      showToast('Error en el proceso de auditoría', 'error');
    }
  };

  const handleTraceability = (lote) => {
    setTraceLote(lote);
    if (!lote) {
      setTraceResults(null);
      return;
    }
    const results = (productionHistory || []).filter(prod => 
      prod.ingredients?.some(ing => ing.lote?.toLowerCase().includes(lote.toLowerCase()))
    );
    setTraceResults(results);
  };

  // Permisos granulares
  const canIn = !userPermisos || userPermisos.inventory_in !== false;
  const canOut = !userPermisos || userPermisos.inventory_out !== false;

  const getMaterialIcon = (name) => {
    const n = name.toLowerCase();
    if (n.includes('chocolate') || n.includes('cacao') || n.includes('choc.')) return <Coins size={16} />;
    if (n.includes('frambuesa') || n.includes('berry') || n.includes('crumble')) return <Grape size={16} />;
    return <Package size={16} />;
  };

  const getExpiryAlert = (dateStr) => {
    if (!dateStr) return null;
    try {
      const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
      if (diff < 0) return { label: 'Vencido', color: 'text-raspberry bg-raspberry/10' };
      if (diff < 15) return { label: 'Vence Pronto', color: 'text-amber-600 bg-amber-50' };
    } catch (e) { return null; }
    return null;
  };

  const totalCrumbleWaste = Array.isArray(productionHistory) 
    ? productionHistory.reduce((acc, curr) => acc + (curr.crumble_waste || 0), 0) 
    : 0;
  
  const mermaInStock = Array.isArray(ptStock) 
    ? ptStock.find(p => p.pt_name === 'Merma Crumble')?.total_quantity || 0
    : 0;

  const handleEntry = async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await axios.post(`${API_URL}/inventory/in`, {
        material_id: form.material.value,
        lote: form.lote.value,
        quantity: parseFloat(form.quantity.value),
        expiry_date: form.expiry.value
      });
      form.reset();
      await fetchData();
      showToast('Ingreso registrado con éxito');
    } catch (err) {
      showToast('Error al registrar ingreso', 'error');
    }
  };

  const handleExit = async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await axios.post(`${API_URL}/inventory/out`, {
        batch_id: form.batch.value,
        quantity: parseFloat(form.quantity.value),
        description: form.proceso.value
      });
      form.reset();
      setMaterialForExit('');
      await fetchData();
      showToast('Salida registrada con éxito');
    } catch (err) {
      showToast(err.response?.data?.error || 'Error en salida', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este movimiento? El stock se revertirá.')) return;
    try {
      await axios.delete(`${API_URL}/movements/${id}`);
      await fetchData();
      showToast('Movimiento eliminado');
    } catch (err) {
      showToast('Error al eliminar', 'error');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/movements/${editingMovement.id}`, editingMovement);
      setEditingMovement(null);
      await fetchData();
      showToast('Movimiento actualizado');
    } catch (err) {
      showToast(err.response?.data?.error || 'Error al actualizar', 'error');
    }
  };

  const filteredMovements = movements.filter(m => {
    const matchesSearch = m.material_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         m.lote.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !dateFilter || m.date.startsWith(dateFilter);
    return matchesSearch && matchesDate;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-chocolate uppercase tracking-tighter">Gestión de <span className="text-raspberry">Insumos</span></h2>
          <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.3em] mt-1 ml-1">Control de entrada y salida de materias primas</p>
        </div>

        {/* VALUATION CARD */}
        <button 
          onClick={() => setShowValuationDetail(true)}
          className="bg-white px-6 py-4 rounded-3xl border border-chocolate/5 shadow-xl shadow-chocolate/5 flex items-center gap-4 group hover:border-chocolate/10 hover:scale-105 active:scale-95 transition-all text-left"
        >
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
            <Coins size={24} />
          </div>
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Valorización Bodega</p>
            <p className="text-2xl font-black text-chocolate tracking-tighter">
              ${valuation.toLocaleString('es-CL')}
            </p>
          </div>
        </button>

        {/* VALUATION MODAL OVERLAY */}
        {showValuationDetail && (
          <div className="fixed inset-0 bg-chocolate/40 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <div className="bg-cream p-8 rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto relative border border-chocolate/10 animate-in fade-in zoom-in duration-300">
              <button 
                onClick={() => setShowValuationDetail(false)} 
                className="absolute top-6 right-6 p-2 bg-white text-slate-400 hover:text-raspberry rounded-full transition-all border border-chocolate/5 shadow-sm z-10"
              >
                <X size={20} />
              </button>
              <Valuation materials={materials} stock={stock} showToast={showToast} />
            </div>
          </div>
        )}
      </header>

      {/* TRACEABILITY & AUDIT SECTION */}
      <section className="bg-chocolate p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 text-white">
          <Search size={100} />
        </div>
        <div className="relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-raspberry text-white rounded-2xl shadow-lg shadow-raspberry/20">
                <ClipboardList size={22} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white tracking-tight uppercase">Rastreador y Auditoría</h3>
                <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest">Trazabilidad o ajuste físico de inventario</p>
              </div>
            </div>
            {canOut && (
              <button 
                onClick={() => setAuditMode(!auditMode)}
                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${auditMode ? 'bg-white text-chocolate' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                <Database size={16} /> {auditMode ? 'Cerrar Auditoría' : 'Iniciar Auditoría'}
              </button>
            )}
          </div>

          {!auditMode ? (
            <div className="max-w-md relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-raspberry transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Ingresa lote de materia prima..." 
                value={traceLote}
                onChange={(e) => handleTraceability(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/10 rounded-2xl text-white font-bold placeholder:text-white/20 focus:ring-4 focus:ring-raspberry/20 outline-none transition-all" 
              />
            </div>
          ) : (
            <form onSubmit={handleAuditSubmit} className="animate-in slide-in-from-top-4 duration-500 space-y-6">
              <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {materials.map(m => {
                    const currentStock = stock.filter(s => s.material_id === m.id).reduce((a, c) => a + (c.quantity || 0), 0);
                    return (
                      <div key={m.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                        <div className="flex justify-between items-start">
                          <p className="text-[10px] font-black text-white uppercase truncate pr-2">{m.name}</p>
                          <span className="text-[8px] font-bold text-white/40 uppercase">{m.unit}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <p className="text-[7px] font-black text-white/30 uppercase mb-1">Digital: {currentStock.toFixed(1)}</p>
                            <input 
                              type="number" 
                              step="0.01"
                              placeholder="Físico..."
                              required
                              onChange={(e) => setAuditModeForm({...auditForm, [m.id]: e.target.value})}
                              className="w-full p-2.5 bg-white/10 border border-white/10 rounded-xl text-white font-bold text-xs outline-none focus:bg-white/20"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="bg-raspberry text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-raspberry/20 hover:scale-105 active:scale-95 transition-all">
                  Guardar y Sincronizar Stock
                </button>
              </div>
            </form>
          )}

          {traceResults && !auditMode && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              {traceResults.length > 0 ? (
                <div className="bg-white/5 rounded-3xl border border-white/5 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5">
                        <th className="p-4 text-[9px] font-black uppercase text-white/40 tracking-widest">Fecha Prod.</th>
                        <th className="p-4 text-[9px] font-black uppercase text-white/40 tracking-widest">Producto Terminado</th>
                        <th className="p-4 text-[9px] font-black uppercase text-white/40 tracking-widest">Lote PT</th>
                        <th className="p-4 text-[9px] font-black uppercase text-white/40 tracking-widest text-right">Cantidad Insumo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {traceResults.map(prod => {
                        const ingUsed = prod.ingredients?.find(i => i.lote.toLowerCase().includes(traceLote.toLowerCase()));
                        return (
                          <tr key={prod.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 text-xs font-bold text-white/60">{new Date(prod.date).toLocaleDateString()}</td>
                            <td className="p-4 text-xs font-black text-white uppercase">{prod.pt_name}</td>
                            <td className="p-4 text-xs font-bold text-raspberry uppercase">{prod.pt_lote}</td>
                            <td className="p-4 text-right">
                              <span className="text-xs font-black text-white">{ingUsed?.quantity}</span>
                              <span className="text-[8px] font-bold text-white/30 uppercase ml-1">{ingUsed?.unit}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-6 bg-white/5 rounded-3xl border border-dashed border-white/10 text-white/40 italic">
                  <AlertCircle size={20} />
                  <p className="text-sm font-bold">No se encontraron productos vinculados a este lote.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* FORM GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* INGRESO FORM */}
        {canIn ? (
          <section className="bg-white p-6 rounded-[2rem] shadow-xl border border-chocolate/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 text-chocolate group-hover:scale-110 transition-transform">
              <PackagePlus size={80} />
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-chocolate text-white rounded-xl shadow-lg shadow-chocolate/20">
                <PlusCircle size={20} />
              </div>
              <h3 className="text-lg font-black text-chocolate tracking-tight uppercase">Ingreso a Bodega</h3>
            </div>
            
            <form onSubmit={handleEntry} className="space-y-4 relative z-10">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Seleccionar Material</label>
                <select name="material" className="w-full p-3.5 bg-slate-50 rounded-xl border-none font-bold text-chocolate text-xs focus:ring-2 focus:ring-chocolate/20 appearance-none" required>
                  <option value="">Elegir insumo...</option>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Lote</label>
                  <input name="lote" placeholder="LOT-2024" className="w-full p-3.5 bg-slate-50 rounded-xl border-none font-bold text-chocolate text-xs focus:ring-2 focus:ring-chocolate/20" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Cantidad</label>
                  <input name="quantity" type="number" step="0.01" placeholder="0.00" className="w-full p-3.5 bg-slate-50 rounded-xl border-none font-bold text-chocolate text-xs focus:ring-2 focus:ring-chocolate/20" required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Fecha de Vencimiento</label>
                <input name="expiry" type="date" className="w-full p-3.5 bg-slate-50 rounded-xl border-none font-bold text-chocolate focus:ring-2 focus:ring-chocolate/20 text-xs" />
              </div>
              <button type="submit" className="w-full bg-chocolate text-white p-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-chocolate/20 hover:scale-[1.01] active:scale-95 transition-all">
                Registrar Entrada
              </button>
            </form>
          </section>
        ) : (
          <div className="bg-white/50 p-12 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-3 opacity-60">
            <Lock size={40} className="text-slate-300" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin permisos para ingresos</p>
          </div>
        )}

        {/* SALIDA FORM */}
        {canOut ? (
          <section className="bg-raspberry/5 p-6 rounded-[2rem] shadow-xl border border-raspberry/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 text-raspberry group-hover:scale-110 transition-transform">
              <PackageMinus size={80} />
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-raspberry text-white rounded-xl shadow-lg shadow-raspberry/20">
                <PackageMinus size={20} />
              </div>
              <h3 className="text-lg font-black text-chocolate tracking-tight uppercase">Salida Directa</h3>
            </div>

            <form onSubmit={handleExit} className="space-y-4 relative z-10">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Filtrar por Material</label>
                <select value={materialForExit} onChange={e => setMaterialForExit(e.target.value)} className="w-full p-3.5 bg-white rounded-xl border-none font-bold text-chocolate text-xs focus:ring-2 focus:ring-raspberry/20 shadow-sm" required>
                  <option value="">Todos los materiales...</option>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Seleccionar Lote en Stock</label>
                <select name="batch" className="w-full p-3.5 bg-white rounded-xl border-none font-bold text-chocolate text-xs focus:ring-2 focus:ring-raspberry/20 shadow-sm" required>
                  <option value="">Elegir lote...</option>
                  {stock.filter(s => !materialForExit || s.material_id === parseInt(materialForExit)).map(s => (
                    <option key={s.batch_id} value={s.batch_id}>Lote: {s.lote} | Disponible: {s.quantity} {s.unit}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Cantidad</label>
                  <input name="quantity" type="number" step="0.01" placeholder="0.00" className="w-full p-3.5 bg-white rounded-xl border-none font-bold text-chocolate text-xs focus:ring-2 focus:ring-raspberry/20 shadow-sm" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Motivo / Destino</label>
                  <input name="proceso" placeholder="Merma o Uso" className="w-full p-3.5 bg-white rounded-xl border-none font-bold text-chocolate text-xs focus:ring-2 focus:ring-raspberry/20 shadow-sm" required />
                </div>
              </div>
              <button type="submit" className="w-full bg-raspberry text-white p-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-raspberry/20 hover:scale-[1.01] active:scale-95 transition-all">
                Registrar Salida
              </button>
            </form>
          </section>
        ) : (
          <div className="bg-white/50 p-12 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-3 opacity-60">
            <Lock size={40} className="text-slate-300" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin permisos para salidas directas</p>
          </div>
        )}
      </div>

      {/* SECCIÓN DE STOCK RÁPIDO */}
      <section className="space-y-6 pt-4">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-chocolate text-white rounded-lg shadow-lg shadow-chocolate/20">
            <Coins size={18} />
          </div>
          <h3 className="text-lg font-black text-chocolate uppercase tracking-tight">Estado de Stock MP</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* CUADRO DE MERMA REDUCIDO */}
          <div className="p-5 rounded-[2rem] border border-raspberry/20 bg-raspberry/[0.02] shadow-sm relative overflow-hidden group">
            <div className="absolute -right-2 -top-2 opacity-5 text-raspberry group-hover:scale-110 transition-transform">
              <AlertTriangle size={50} />
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-raspberry text-white rounded-xl">
                <AlertTriangle size={16} />
              </div>
              <div className="flex-1 overflow-hidden">
                <h4 className="text-[10px] font-black text-chocolate uppercase leading-tight truncate">Merma Crumble</h4>
              </div>
            </div>
            <div className="flex justify-between items-end">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black tracking-tighter text-raspberry">{totalCrumbleWaste.toFixed(1)}</span>
                <span className="text-[9px] font-bold text-slate-300 uppercase">KG</span>
              </div>
              <div className="text-[8px] font-black text-chocolate/40 uppercase tracking-widest text-right">
                Stock: <span className="text-chocolate">{mermaInStock.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {materials.map(m => {
            const allRows = stock.filter(s => s.material_id === m.id);
            const total = allRows.reduce((a, c) => a + (Number(c.quantity) || 0), 0);
            const actualBatches = allRows.filter(s => s.batch_id !== null);
            const isLow = total <= m.min_stock;
            
            return (
              <div key={m.id} className={cn(
                "p-5 rounded-[2rem] border transition-all duration-300 relative overflow-hidden",
                isLow 
                  ? "bg-raspberry/[0.02] border-raspberry/20 shadow-sm animate-pulse" 
                  : "bg-white border-chocolate/5 shadow-sm hover:border-chocolate/10"
              )}>
                {isLow && (
                  <div className="absolute top-3 right-3 animate-bounce">
                    <AlertCircle size={16} className="text-raspberry" />
                  </div>
                )}

                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn(
                      "p-2 rounded-xl transition-colors",
                      isLow ? "bg-raspberry text-white" : "bg-chocolate/5 text-chocolate"
                    )}>
                      {getMaterialIcon(m.name)}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="text-[10px] font-black text-chocolate uppercase leading-tight truncate">{m.name}</h4>
                      <p className={cn("text-[8px] font-bold uppercase", isLow ? "text-raspberry" : "text-slate-300")}>
                        {isLow ? 'Bajo Stock' : 'Disponible'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto flex justify-between items-end">
                    <div className="flex items-baseline gap-1.5">
                      <span className={cn("text-2xl font-black tracking-tighter", isLow ? "text-raspberry" : "text-chocolate")}>{total.toFixed(1)}</span>
                      <span className="text-[9px] font-bold text-slate-300 uppercase">{m.unit}</span>
                    </div>
                    <button 
                      onClick={() => setExpandedMaterials(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                      className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-400 transition-all"
                    >
                      {expandedMaterials[m.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {expandedMaterials[m.id] && (
                    <div className="mt-4 pt-3 border-t border-chocolate/5 space-y-2 animate-in slide-in-from-top-1">
                      {actualBatches.length === 0 ? (
                        <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl text-slate-400 italic">
                          <Info size={10} />
                          <span className="text-[8px] font-bold uppercase">Sin lotes activos</span>
                        </div>
                      ) : (
                        <div className="max-h-40 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-chocolate/10">
                          {actualBatches.map(s => {
                            const alert = getExpiryAlert(s.expiry_date);
                            const qty = Number(s.quantity) || 0;
                            return (
                              <div key={s.batch_id} className="flex justify-between items-center p-2 bg-slate-50 rounded-xl text-[9px] border border-transparent hover:border-chocolate/10 transition-colors">
                                <div>
                                  <p className="font-black text-chocolate uppercase">Lote {s.lote}</p>
                                  <p className="text-[7px] text-slate-400 font-bold uppercase">Vence: {s.expiry_date || 'N/A'}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-black text-chocolate">{qty.toFixed(1)}</p>
                                  {alert && <span className={cn("text-[6px] font-black px-1 py-0.5 rounded mt-0.5 inline-block uppercase", alert.color)}>{alert.label}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* HISTORIAL SECTION */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
          <h3 className="text-lg font-black text-chocolate uppercase tracking-tight flex items-center gap-2">
            <History size={18} className="text-raspberry" /> Movimientos Recientes
          </h3>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <div className="relative group flex-1 md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-chocolate transition-colors" size={14} />
              <input type="text" placeholder="Buscar material o lote..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-chocolate/5 rounded-xl text-[11px] font-bold shadow-sm focus:ring-4 focus:ring-chocolate/5 outline-none transition-all" />
            </div>
            <div className="relative group">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-chocolate transition-colors" size={14} />
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                className="pl-9 pr-3 py-2 bg-white border border-chocolate/5 rounded-xl text-[11px] font-bold shadow-sm focus:ring-4 focus:ring-chocolate/5 outline-none transition-all" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl shadow-chocolate/[0.05] border border-chocolate/5 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Fecha</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Material</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Tipo</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest text-right">Cantidad</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Identificación</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredMovements.map((mov) => (
                <tr key={mov.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-4 text-[10px] font-bold text-slate-400 whitespace-nowrap">{new Date(mov.date).toLocaleString()}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                       <div className="p-1.5 bg-chocolate/5 text-chocolate rounded-lg group-hover:bg-chocolate group-hover:text-white transition-all">{getMaterialIcon(mov.material_name)}</div>
                       <span className="text-xs font-black text-chocolate uppercase">{mov.material_name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter",
                      mov.type === 'IN' ? "bg-green-100 text-green-700" : "bg-raspberry/10 text-raspberry"
                    )}>
                      {mov.type === 'IN' ? 'Entrada' : 'Salida'}
                    </span>
                  </td>
                  <td className="p-4 text-right font-black text-xs text-chocolate">{mov.quantity} <span className="text-[9px] opacity-30 lowercase">{mov.unit}</span></td>
                  <td className="p-4">
                    <div className="text-[10px] font-black text-slate-500 uppercase">LOTE: {mov.lote}</div>
                    <div className="text-[8px] text-slate-300 font-bold uppercase tracking-tight italic truncate max-w-[120px]">{mov.description || 'Sin notas'}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      {(canIn || canOut) && mov.type !== 'PROD' && (
                        <>
                          <button 
                            onClick={() => setEditingMovement(mov)} 
                            disabled={!canOut}
                            className="p-2 text-slate-200 hover:text-chocolate hover:bg-slate-100 rounded-lg transition-all disabled:opacity-0"
                          >
                            <Edit3 size={14}/>
                          </button>
                          <button 
                            onClick={() => handleDelete(mov.id)} 
                            disabled={!canOut}
                            className="p-2 text-slate-200 hover:text-raspberry hover:bg-raspberry/5 rounded-lg transition-all disabled:opacity-0"
                          >
                            <Trash2 size={14}/>
                          </button>
                        </>
                      )}
                      {mov.type === 'PROD' && (
                        <span className="text-[7px] font-black text-slate-300 uppercase tracking-tighter">Protegido</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMovements.length === 0 && <div className="p-10 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">No hay movimientos</div>}
        </div>
      </section>
    </div>
  );
}
