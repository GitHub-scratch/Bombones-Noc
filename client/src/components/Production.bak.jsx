import React, { useState } from 'react';
import axios from 'axios';
import { Zap, Plus, Trash2, ChevronDown, ChevronUp, PackageOpen, History, Printer, X, Loader2, RefreshCw, Layers, PlusCircle, Database } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

export default function Production({ materials, stock, productionHistory, fetchData, showToast }) {
  const [selectedIngredients, setSelectedIngredients] = useState([
    { id: Date.now(), material_id: '', batch_id: '', quantity: '' }
  ]);
  const [expandedProd, setExpandedProd] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printConfig, setPrintConfig] = useState({
    pt_name: '', pt_lote: '', quantity: 1, prod_date: '', exp_date: '', zpl: '', loadingPreview: false
  });

  const addIngredient = () => setSelectedIngredients([...selectedIngredients, { id: Date.now(), material_id: '', batch_id: '', quantity: '' }]);
  const removeIngredient = (id) => selectedIngredients.length > 1 && setSelectedIngredients(selectedIngredients.filter(ing => ing.id !== id));
  const updateIngredient = (id, field, value) => setSelectedIngredients(selectedIngredients.map(ing => ing.id === id ? { ...ing, [field]: value } : ing));

  const handleProduction = async (e) => {
    e.preventDefault();
    const form = e.target;
    const ingredients = selectedIngredients.map(ing => ({ batch_id: parseInt(ing.batch_id), quantity: parseFloat(ing.quantity) }));
    try {
      await axios.post(`${API_URL}/production`, {
        ingredients,
        pt_name: form.pt_name.value,
        pt_lote: form.pt_lote.value,
        pt_quantity: parseFloat(form.pt_quantity.value),
        pt_unit: form.pt_unit.value,
        chocolate_waste: 0,
        crumble_waste: parseFloat(form.crumble_waste.value) || 0
      });
      form.reset();
      setSelectedIngredients([{ id: Date.now(), material_id: '', batch_id: '', quantity: '' }]);
      await fetchData();
      showToast('Producción registrada con éxito');
    } catch (err) {
      showToast(err.response?.data?.error || 'Error en producción', 'error');
    }
  };

  const deleteProduction = async (id) => {
    if (!window.confirm('¿Eliminar esta producción?')) return;
    try {
      await axios.delete(`${API_URL}/production/${id}`);
      await fetchData();
      showToast('Producción eliminada');
    } catch (err) {
      showToast('Error al eliminar producción', 'error');
    }
  };

  const openPrintModal = async (prod) => {
    const prodDateISO = prod.date ? prod.date.split('T')[0] : new Date().toISOString().split('T')[0];
    const d = new Date(prodDateISO); d.setFullYear(d.getFullYear() + 1);
    const expDateISO = d.toISOString().split('T')[0];
    
    setPrintConfig({ pt_name: prod.pt_name, pt_lote: prod.pt_lote, quantity: Math.ceil(prod.pt_quantity), prod_date: prodDateISO, exp_date: expDateISO, zpl: '', loadingPreview: true });
    setIsPrintModalOpen(true);
    try {
      const { data } = await axios.post(`${API_URL}/label-preview`, { pt_lote: prod.pt_lote, date: prod.date });
      setPrintConfig(prev => ({ ...prev, zpl: data.zpl, loadingPreview: false }));
    } catch {
      showToast('Error al generar vista previa', 'error');
      setPrintConfig(prev => ({ ...prev, loadingPreview: false }));
    }
  };

  const handleFinalPrint = async () => {
    try {
      showToast('Imprimiendo...', 'info');
      const { data } = await axios.post(`${API_URL}/print-labels`, { pt_lote: printConfig.pt_lote, pt_quantity: printConfig.quantity, custom_zpl: printConfig.zpl });
      showToast(data.message);
      setIsPrintModalOpen(false);
    } catch (err) {
      showToast(err.response?.data?.error || 'Error de impresión', 'error');
    }
  };

  const filteredHistory = productionHistory.filter(p => (p.pt_name.toLowerCase().includes(searchTerm.toLowerCase()) || p.pt_lote.toLowerCase().includes(searchTerm.toLowerCase())) && (!dateFilter || p.date.startsWith(dateFilter)));

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* HEADER */}
      <header>
        <h2 className="text-3xl font-black text-chocolate tracking-tighter uppercase">Línea de <span className="text-raspberry">Producción</span></h2>
        <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.3em] mt-1 ml-1">Transformación de insumos en producto terminado</p>
      </header>

      {/* REGISTRO DE PRODUCCION */}
      <section className="bg-white p-6 rounded-[2rem] shadow-xl border border-chocolate/5 relative overflow-hidden group">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-chocolate/[0.02] rounded-full blur-3xl group-hover:bg-raspberry/[0.02] transition-all duration-1000" />
        <form onSubmit={handleProduction} className="space-y-6 relative z-10">
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-chocolate tracking-tight uppercase flex items-center gap-3">
                <div className="p-2 bg-chocolate text-white rounded-xl"><Layers size={18}/></div>
                Insumos Utilizados
              </h3>
              <button type="button" onClick={addIngredient} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-chocolate rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-chocolate hover:text-white transition-all">
                <Plus size={14} /> Añadir Insumo
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {selectedIngredients.map((ing) => (
                <div key={ing.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50/50 p-4 rounded-2xl border border-slate-100 transition-all hover:border-chocolate/10">
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Material</label>
                    <select value={ing.material_id} onChange={e => updateIngredient(ing.id, 'material_id', e.target.value)} className="w-full p-2.5 bg-white rounded-xl border-none font-bold text-chocolate text-xs shadow-sm focus:ring-2 ring-chocolate/20" required>
                      <option value="">Elegir...</option>
                      {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Lote</label>
                    <select value={ing.batch_id} onChange={e => updateIngredient(ing.id, 'batch_id', e.target.value)} className="w-full p-2.5 bg-white rounded-xl border-none font-bold text-chocolate text-xs shadow-sm focus:ring-2 ring-chocolate/20" required>
                      <option value="">Elegir lote...</option>
                      {stock.filter(s => s.material_id === parseInt(ing.material_id)).map(s => (
                        <option key={s.batch_id} value={s.batch_id}>{s.lote} ({s.quantity} {s.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Cantidad</label>
                    <input type="number" step="0.01" value={ing.quantity} onChange={e => updateIngredient(ing.id, 'quantity', e.target.value)} placeholder="0.00" className="w-full p-2.5 bg-white rounded-xl border-none font-bold text-chocolate text-xs shadow-sm focus:ring-2 ring-chocolate/20" required />
                  </div>
                  <div className="md:col-span-1 flex justify-center pb-1">
                    <button type="button" onClick={() => removeIngredient(ing.id)} className="p-2 text-slate-300 hover:text-raspberry transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-chocolate/5 space-y-6">
            <h3 className="text-lg font-black text-chocolate tracking-tight uppercase flex items-center gap-3">
              <div className="p-2 bg-raspberry text-white rounded-xl shadow-lg shadow-raspberry/20"><PackageOpen size={18}/></div>
              Resultado (PT)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Producto</label>
                  <input name="pt_name" placeholder="Ej: Frambuesa Leche" className="w-full p-3.5 bg-slate-50 rounded-xl border-none font-bold text-chocolate text-xs focus:ring-2 ring-chocolate/20" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Lote Producción</label>
                  <input name="pt_lote" placeholder="Ej: FBL-001" className="w-full p-3.5 bg-slate-50 rounded-xl border-none font-bold text-chocolate text-xs focus:ring-2 ring-chocolate/20" required />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Cant.</label>
                    <input name="pt_quantity" type="number" step="0.01" placeholder="0" className="w-full p-3.5 bg-slate-50 rounded-xl border-none font-bold text-chocolate text-xs focus:ring-2 ring-chocolate/20" required />
                  </div>
                  <div className="w-24 space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Unidad</label>
                    <select name="pt_unit" className="w-full p-3.5 bg-slate-50 rounded-xl border-none font-bold text-chocolate text-xs">
                      <option value="Cajas">Cajas</option>
                      <option value="Kg">Kg</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Merma Crumble (KG)</label>
                  <input name="crumble_waste" type="number" step="0.01" placeholder="0.00" className="w-full p-3.5 bg-raspberry/5 rounded-xl border-none font-bold text-raspberry text-xs focus:ring-2 ring-raspberry/20" />
                </div>
              </div>
            </div>
            <button type="submit" className="w-full bg-chocolate text-white p-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-chocolate/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3">
              <Zap size={20} /> Registrar Producción
            </button>
          </div>
        </form>
      </section>

      {/* HISTORIAL SECTION */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
          <h3 className="text-lg font-black text-chocolate uppercase tracking-tight flex items-center gap-2"><History size={18} className="text-raspberry" /> Producciones del Mes</h3>
          <div className="flex gap-2 w-full md:w-auto">
            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2.5 bg-white border border-chocolate/5 rounded-xl text-[10px] font-bold shadow-sm outline-none flex-1 md:w-48" />
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="p-2.5 bg-white border border-chocolate/5 rounded-xl text-[10px] font-bold shadow-sm outline-none" />
          </div>
        </div>
        <div className="bg-white rounded-[2rem] shadow-xl shadow-chocolate/[0.05] border border-chocolate/5 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Fecha</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Producto</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Lote</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest text-right">Cant.</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Ingr.</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredHistory.map(prod => (
                <React.Fragment key={prod.id}>
                  <tr className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4 text-[10px] font-bold text-slate-400 whitespace-nowrap">{new Date(prod.date).toLocaleDateString()}</td>
                    <td className="p-4 text-xs font-black text-chocolate uppercase">{prod.pt_name}</td>
                    <td className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{prod.pt_lote}</td>
                    <td className="p-4 text-right font-black text-chocolate text-base">{prod.pt_quantity} <span className="text-[8px] opacity-30 uppercase">{prod.pt_unit}</span></td>
                    <td className="p-4 text-center">
                      <button onClick={() => setExpandedProd(expandedProd === prod.id ? null : prod.id)} className="px-3 py-1 bg-slate-100 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-500 hover:bg-chocolate hover:text-white transition-all">Ver</button>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openPrintModal(prod)} className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Printer size={16} /></button>
                        <button onClick={() => deleteProduction(prod.id)} className="p-2 text-slate-300 hover:text-raspberry hover:bg-raspberry/5 rounded-lg transition-all"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                  {expandedProd === prod.id && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={6} className="p-6">
                        <div className="bg-white rounded-2xl p-4 border border-chocolate/5 shadow-inner">
                          <h4 className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 flex items-center gap-2"><PlusCircle size={12}/> Insumos Consumidos</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {prod.ingredients?.map((ing, idx) => (
                              <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div>
                                  <p className="text-[10px] font-black text-chocolate uppercase">{ing.material_name}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase">Lote: {ing.lote}</p>
                                </div>
                                <p className="text-xs font-black text-raspberry">{ing.quantity} <span className="text-[9px] opacity-50 lowercase">{ing.unit}</span></p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* PRINT MODAL REDESIGN */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-chocolate/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-6 relative">
            <header className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-black text-chocolate tracking-tight uppercase leading-tight">Impresión Zebra</h3>
                <p className="text-slate-400 font-black uppercase text-[9px] tracking-widest">{printConfig.pt_name}</p>
              </div>
              <button onClick={() => setIsPrintModalOpen(false)} className="p-3 bg-slate-100 rounded-full text-slate-400 hover:text-raspberry transition-all"><X size={20} /></button>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Vista Previa</label>
                <div className="aspect-[4/3] bg-cream rounded-2xl border-2 border-dashed border-chocolate/10 flex items-center justify-center overflow-hidden p-4 relative shadow-inner">
                  {printConfig.loadingPreview ? <div className="flex flex-col items-center gap-2"><Loader2 className="animate-spin text-chocolate/20" size={32} /><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Generando...</p></div> : printConfig.zpl ? <img src={`https://api.labelary.com/v1/printers/8dpmm/labels/4x2.5/0/${encodeURIComponent(printConfig.zpl)}`} alt="Preview" className="max-w-full max-h-full drop-shadow-xl rounded-lg" /> : <div className="text-center opacity-20"><Printer size={32} className="mx-auto mb-2" /><p className="text-[10px] font-black uppercase tracking-widest">Sin vista previa</p></div>}
                </div>
              </div>
              <div className="flex flex-col justify-between space-y-6">
                <div className="space-y-6">
                  <div className="bg-chocolate p-4 rounded-2xl text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><Database size={48}/></div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">Configuración</p>
                    <p className="text-sm font-black uppercase leading-tight mb-2">{printConfig.pt_name}</p>
                    <div className="flex justify-between items-center text-[8px] font-black uppercase border-t border-white/10 pt-2 opacity-60"><span>Lote {printConfig.pt_lote}</span><span>{printConfig.prod_date}</span></div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase text-slate-400 block text-center">Etiquetas</label>
                    <div className="flex items-center justify-center gap-4">
                      <button onClick={() => setPrintConfig(p => ({ ...p, quantity: Math.max(1, p.quantity - 1) }))} className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-xl font-black text-chocolate hover:bg-chocolate hover:text-white transition-all">-</button>
                      <input type="number" value={printConfig.quantity} onChange={e => setPrintConfig(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} className="w-20 h-12 text-center text-2xl font-black text-chocolate bg-cream rounded-xl border-none focus:ring-4 ring-chocolate/5 shadow-inner" />
                      <button onClick={() => setPrintConfig(p => ({ ...p, quantity: p.quantity + 1 }))} className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-xl font-black text-chocolate hover:bg-chocolate hover:text-white transition-all">+</button>
                    </div>
                  </div>
                </div>
                <button onClick={handleFinalPrint} disabled={!printConfig.zpl || printConfig.loadingPreview} className="w-full bg-raspberry text-white py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-raspberry/20 flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-30">
                  <Printer size={20} /> Imprimir Copias
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
