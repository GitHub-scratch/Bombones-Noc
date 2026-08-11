import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, ChevronDown, ChevronUp, PackageOpen, History, Printer, X, Loader2, RefreshCw, PlusCircle, Database, Play } from 'lucide-react';
import Simulator from './Simulator';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const VerticalTank = ({ percent, current, total, label, material, colorClass, secondaryColorClass }) => {
  const displayPercent = isNaN(percent) ? 0 : Math.min(100, Math.max(0, percent));
  return (
    <div className="flex flex-col items-center group">
      <div className="relative w-24 h-48 bg-slate-100 rounded-t-2xl rounded-b-[2rem] border-4 border-slate-200 shadow-xl overflow-hidden mb-3">
        {/* Liquid */}
        <div 
          className={`absolute bottom-0 w-full transition-all duration-1000 ease-in-out ${colorClass} z-10`}
          style={{ height: `${displayPercent}%` }}
        >
          <div className="absolute top-0 left-0 w-[200%] h-4 bg-white/20 -translate-y-1/2 animate-wave rounded-[100%]" />
        </div>
      </div>

      <div className="text-center">
        <span className={`text-[8px] font-black uppercase tracking-widest ${secondaryColorClass}`}>{label}</span>
        <h4 className="text-[10px] font-black text-chocolate uppercase truncate max-w-[100px]">{material}</h4>
        <div className="flex items-baseline justify-center gap-0.5">
          <span className="text-lg font-black text-chocolate">{current.toFixed(1)}</span>
          <span className="text-[8px] font-bold text-slate-300">KG</span>
        </div>
      </div>
    </div>
  );
};

export default function Production({ materials, stock, productionHistory, activeSessions, fetchData, showToast }) {
  const [productionTab, setProductionTab] = useState('carga'); // 'carga', 'finalizar' o 'simulator'
  const [sessionForm, setSessionForm] = useState({
    productName: '',
    format: '24 POTES', // '24 POTES' o '10 KG'
    description: ''
  });
  const [selectedIngredients, setSelectedIngredients] = useState([
    { id: 'estanque1', material_id: '', batch_id: '', quantity: '', label: 'Chocolate Base (E1)' },
    { id: 'estanque2', material_id: '', batch_id: '', quantity: '', label: 'Chocolate Cobertura (E2)' }
  ]);
  const [finishingSession, setFinishingSession] = useState(null);
  const [refillSession, setRefillSession] = useState(null);
  const [refillTarget, setRefillTarget] = useState(null); // 'estanque1' o 'estanque2'
  const [refillIngredients, setRefillIngredients] = useState([
    { id: 'refill-init', material_id: '', batch_id: '', quantity: '' }
  ]);
  const [expandedProd, setExpandedProd] = useState(null);
const [iqfForm, setIqfForm] = useState({ material_id: '', batch_id: '', quantity: '' });
const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [recoverE1, setRecoverE1] = useState(false);
  const [recoverE2, setRecoverE2] = useState(false);
  const [printConfig, setPrintConfig] = useState({
    pt_name: '', pt_lote: '', quantity: 1, prod_date: '', exp_date: '', zpl: '', loadingPreview: false
  });
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('download');
  const [zebraStatus, setZebraStatus] = useState('checking');

  // Sincronizar sesión seleccionada con los datos frescos de las props
  useEffect(() => {
    if (finishingSession) {
      const updated = activeSessions.find(s => s.id === finishingSession.id);
      if (updated) setFinishingSession(updated);
    }
  }, [activeSessions]);

  // Limpiar checkboxes al cambiar de sesión
  useEffect(() => {
    setRecoverE1(false);
    setRecoverE2(false);
  }, [finishingSession?.id]);

  // RECETA MAESTRA: Por cada 1000g de producto terminado:
  // 430g Frambuesa (0.43)
  // 290g Blanco (0.29)
  // 280g Cobertura (0.28)
  const RECIPE = {
    BLANCO_FACTOR: 0.29,
    COBERTURA_FACTOR: 0.28,
    FRAMBUESA_FACTOR: 0.43,
    KG_PER_24POTES: 3.6,   // 24 potes de 150g
    KG_PER_10KG: 10        // 10 kilos por granel
  };

  const handleProgress = async (sessionId, quantity, unit, extra = {}) => {
  let finalQty = parseFloat(quantity);
  try {
    await axios.post(`${API_URL}/production/sessions/progress`, {
      session_id: sessionId,
      quantity: finalQty,
      unit,
      material_id: extra.material_id ? parseInt(extra.material_id) : null,
      batch_id: extra.batch_id ? parseInt(extra.batch_id) : null,
      lote: extra.lote || null
    });
    await fetchData();
    showToast(`Avance de ${quantity} ${unit} registrado`);
  } catch (err) {
    showToast(err.response?.data?.error || 'Error al registrar avance', 'error');
  }
};

  const calculateTanks = (session) => {
    let initialBlanco = 0;
    let initialCobertura = 0;
    let initialFrambuesa = 0;

    if (!session) return { blanco: { total: 0, current: 0, percent: 0 }, cobertura: { total: 0, current: 0, percent: 0 }, frambuesa: { total: 0, current: 0, percent: 0 }, ptTotal: 0, frambuesaTotal: 0, boxesTotal: 0 };

    (session.ingredients || []).forEach(ing => {
      const name = ing.material_name?.toLowerCase() || '';
      const qty = parseFloat(ing.quantity) || 0;
      if (name.includes('blanco') || name.includes('white')) initialBlanco += qty;
      else if (name.includes('leche') || name.includes('milk') || name.includes('amargo') || name.includes('dark') || name.includes('rub') || name.includes('cobertura')) initialCobertura += qty;
      else if (name.includes('frambuesa') || name.includes('raspberry')) initialFrambuesa += qty;
    });

    let totalPtKg = 0;
    let totalBoxes = 0;
    let totalFrambuesaReported = 0;
    const kgPerUnit = session.format === '10 KG' ? RECIPE.KG_PER_10KG : RECIPE.KG_PER_24POTES;

    (session.progress || []).forEach(p => {
      const qty = parseFloat(p.quantity) || 0;
      if (p.unit === 'Cajas') {
        totalPtKg += qty * kgPerUnit;
        totalBoxes += qty;
      }
      else if (p.unit === 'Frambuesa') totalFrambuesaReported += qty;
      else totalPtKg += qty;
    });

    const consumedBlanco = totalPtKg * RECIPE.BLANCO_FACTOR;
    const consumedCobertura = totalPtKg * RECIPE.COBERTURA_FACTOR;

    return {
      blanco: {
        total: initialBlanco,
        current: Math.max(0, initialBlanco - consumedBlanco),
        percent: initialBlanco > 0 ? Math.max(0, ((initialBlanco - consumedBlanco) / initialBlanco) * 100) : 0
      },
      cobertura: {
        total: initialCobertura,
        current: Math.max(0, initialCobertura - consumedCobertura),
        percent: initialCobertura > 0 ? Math.max(0, ((initialCobertura - consumedCobertura) / initialCobertura) * 100) : 0
      },
      frambuesa: {
        total: initialFrambuesa,
        current: Math.max(0, initialFrambuesa - totalFrambuesaReported),
        percent: initialFrambuesa > 0 ? Math.max(0, ((initialFrambuesa - totalFrambuesaReported) / initialFrambuesa) * 100) : 0
      },
      ptTotal: totalPtKg,
      boxesTotal: totalBoxes,
      frambuesaTotal: totalFrambuesaReported
    };
  };

  const addIngredient = () => setSelectedIngredients([...selectedIngredients, { id: Date.now(), material_id: '', batch_id: '', quantity: '' }]);
  const removeIngredient = (id) => selectedIngredients.length > 1 && setSelectedIngredients(selectedIngredients.filter(ing => ing.id !== id));
  const updateIngredient = (id, field, value) => setSelectedIngredients(selectedIngredients.map(ing => ing.id === id ? { ...ing, [field]: value } : ing));

  const addRefillIngredient = () => setRefillIngredients([...refillIngredients, { id: Date.now(), material_id: '', batch_id: '', quantity: '' }]);
  const removeRefillIngredient = (id) => refillIngredients.length > 1 && setRefillIngredients(refillIngredients.filter(ing => ing.id !== id));
  const updateRefillIngredient = (id, field, value) => setRefillIngredients(refillIngredients.map(ing => ing.id === id ? { ...ing, [field]: value } : ing));

  const handleRefill = async (e) => {
    e.preventDefault();
    const ingredients = refillIngredients.map(ing => ({ batch_id: parseInt(ing.batch_id), quantity: parseFloat(ing.quantity) }));
    try {
      await axios.post(`${API_URL}/production/sessions/refill`, {
        session_id: refillSession.id,
        ingredients
      });
      setRefillSession(null);
      setRefillIngredients([{ id: Date.now(), material_id: '', batch_id: '', quantity: '' }]);
      await fetchData();
      showToast('Recarga registrada con éxito');
    } catch (err) {
      showToast(err.response?.data?.error || 'Error en recarga', 'error');
    }
  };

  const handleStartSession = async (e) => {
    e.preventDefault();
    const ingredients = selectedIngredients.filter(ing => ing.batch_id && ing.quantity);
    if (ingredients.length === 0) return showToast('Agregue al menos un chocolate', 'error');

    try {
      await axios.post(`${API_URL}/production/sessions/start`, {
        ingredients: ingredients.map(ing => ({ batch_id: parseInt(ing.batch_id), quantity: parseFloat(ing.quantity) })),
        product_name: sessionForm.productName,
        format: sessionForm.format,
        description: sessionForm.description || `Producción de ${sessionForm.productName}`
      });
      setSessionForm({ productName: '', format: '24 POTES', description: '' });
      setSelectedIngredients([
        { id: 'estanque1', material_id: '', batch_id: '', quantity: '', label: 'Chocolate Base (E1)' },
        { id: 'estanque2', material_id: '', batch_id: '', quantity: '', label: 'Chocolate Cobertura (E2)' }
      ]);
      await fetchData();
      showToast('Carga enviada a producción');
      setProductionTab('finalizar');
    } catch (err) {
      showToast(err.response?.data?.error || 'Error al iniciar sesión', 'error');
    }
  };

  const handleFinishSession = async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await axios.post(`${API_URL}/production/sessions/finish`, {
        session_id: finishingSession.id,
        pt_name: finishingSession.product_name,
        pt_lote: form.pt_lote.value,
        pt_quantity: parseFloat(form.pt_quantity.value),
        pt_unit: finishingSession.format === '10 KG' ? 'Granel' : 'Cajas',
        crumble_waste: parseFloat(form.crumble_waste.value) || 0,
        est1_final_est: parseFloat(form.est1_final_est.value) || 0,
        est2_final_est: parseFloat(form.est2_final_est.value) || 0,
        kg_frambuesa_total: parseFloat(form.kg_frambuesa_total.value) || 0,
        recover_e1: recoverE1,
        recover_e2: recoverE2,
        frambuesa_movement_code: form.frambuesa_movement_code?.value || null,
        storage_movement_code: form.storage_movement_code?.value || null
      });
      setFinishingSession(null);
      setRecoverE1(false);
      setRecoverE2(false);
      await fetchData();
      showToast('Jornada finalizada y stock actualizado');
    } catch (err) {
      showToast(err.response?.data?.error || 'Error al finalizar jornada', 'error');
    }
  };

  const cancelSession = async (id) => {
    if (!window.confirm('¿Cancelar esta carga? Los insumos volverán al stock.')) return;
    try {
      await axios.delete(`${API_URL}/production/sessions/${id}`);
      await fetchData();
      showToast('Carga cancelada e insumos retornados');
    } catch (err) {
      showToast('Error al cancelar carga', 'error');
    }
  };


  const deleteProduction = async (id) => {
    if (!window.confirm('¿Eliminar esta producción registrada? Se devolverán los insumos al stock.')) return;
    try {
      await axios.delete(`${API_URL}/production/${id}`);
      await fetchData();
      showToast('Producción eliminada y stock revertido');
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

    // Detectar impresoras locales a través de Zebra Browser Print
    setZebraStatus('checking');
    try {
      const pRes = await axios.get('http://localhost:9100/available', { timeout: 1500 });
      if (pRes.data && pRes.data.printers && pRes.data.printers.length > 0) {
        setPrinters(pRes.data.printers);
        setSelectedPrinter(JSON.stringify(pRes.data.printers[0]));
        setZebraStatus('detected');
      } else {
        setPrinters([]);
        setSelectedPrinter('download');
        setZebraStatus('not_detected');
      }
    } catch (err) {
      setPrinters([]);
      setSelectedPrinter('download');
      setZebraStatus('not_detected');
    }

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
      const qty = printConfig.quantity || 1;
      let finalZpl = printConfig.zpl;
      if (qty > 1) {
        finalZpl = finalZpl.replace(/\^PQ\d+/, `^PQ${qty}`);
      }

      if (selectedPrinter === 'download') {
        const blob = new Blob([finalZpl], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `etiqueta_${printConfig.pt_lote}.zpl`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Archivo ZPL descargado con éxito');
        setIsPrintModalOpen(false);
      } else if (selectedPrinter === 'copy') {
        await navigator.clipboard.writeText(finalZpl);
        showToast('Código ZPL copiado al portapapeles');
        setIsPrintModalOpen(false);
      } else if (selectedPrinter === 'local-server') {
        showToast('Enviando a la impresora local del servidor...', 'info');
        const { data } = await axios.post(`${API_URL}/print-labels`, { pt_lote: printConfig.pt_lote, pt_quantity: printConfig.quantity, custom_zpl: printConfig.zpl });
        showToast(data.message);
        setIsPrintModalOpen(false);
      } else {
        // Enviar a impresora Zebra física detectada localmente
        const printerObj = JSON.parse(selectedPrinter);
        showToast(`Imprimiendo ${qty} etiquetas en ${printerObj.name}...`, 'info');
        await axios.post('http://localhost:9100/write', {
          device: printerObj,
          data: finalZpl
        });
        showToast('Impresión enviada con éxito');
        setIsPrintModalOpen(false);
      }
    } catch (err) {
      console.error(err);
      showToast('Error al imprimir: ' + (err.response?.data?.error || err.message || err), 'error');
    }
  };

  const filteredHistory = productionHistory.filter(p => (p.pt_name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.pt_lote?.toLowerCase().includes(searchTerm.toLowerCase())) && (!dateFilter || p.date.startsWith(dateFilter)));

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-chocolate tracking-tighter uppercase">Línea de <span className="text-raspberry">Producción</span></h2>
          <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.3em] mt-1 ml-1">Gestión de insumos y producto terminado</p>
        </div>
        
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-chocolate/5 gap-1.5">
          <button 
            onClick={() => setProductionTab('carga')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${productionTab === 'carga' ? 'bg-chocolate text-white shadow-lg shadow-chocolate/20' : 'text-slate-400 hover:text-chocolate'}`}
          >
            1. Cargar Insumos
          </button>
          <button 
            onClick={() => setProductionTab('finalizar')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${productionTab === 'finalizar' ? 'bg-raspberry text-white shadow-lg shadow-raspberry/20' : 'text-slate-400 hover:text-raspberry'}`}
          >
            2. Finalizar PT
            {activeSessions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-raspberry border-2 border-white text-white text-[8px] flex items-center justify-center rounded-full animate-bounce">
                {activeSessions.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setProductionTab('simulator')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${productionTab === 'simulator' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:text-amber-500'}`}
          >
            3. Simulador
          </button>
        </div>
      </header>

      {productionTab === 'carga' ? (
        /* VISTA DE CARGA DE INSUMOS */
        <section className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-chocolate/5 relative overflow-hidden group">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-chocolate/[0.02] rounded-full blur-3xl group-hover:bg-raspberry/[0.02] transition-all duration-1000" />
          
          <form onSubmit={handleStartSession} className="space-y-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {/* DATOS DE LA JORNADA */}
               <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-chocolate text-white rounded-2xl shadow-lg shadow-chocolate/20"><PackageOpen size={20}/></div>
                    <h3 className="text-lg font-black text-chocolate tracking-tight uppercase">Datos de Jornada</h3>
                  </div>

                  <div className="space-y-4 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nombre del Producto</label>
                      <input 
                        value={sessionForm.productName} 
                        onChange={e => setSessionForm({...sessionForm, productName: e.target.value})}
                        placeholder="Ej: Frambuesa Choc Leche" 
                        className="w-full p-4 bg-white rounded-2xl border-none font-bold text-chocolate text-xs shadow-sm focus:ring-2 ring-chocolate/20" 
                        required 
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Formato de Salida</label>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-white rounded-2xl shadow-sm">
                        <button 
                          type="button"
                          onClick={() => setSessionForm({...sessionForm, format: '24 POTES'})}
                          className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${sessionForm.format === '24 POTES' ? 'bg-raspberry text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                          24 Potes (3.6kg)
                        </button>
                        <button 
                          type="button"
                          onClick={() => setSessionForm({...sessionForm, format: '10 KG'})}
                          className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${sessionForm.format === '10 KG' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                          Granel (10kg)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Descripción (Opcional)</label>
                      <textarea 
                        value={sessionForm.description} 
                        onChange={e => setSessionForm({...sessionForm, description: e.target.value})}
                        placeholder="Notas adicionales..." 
                        className="w-full p-4 bg-white rounded-2xl border-none font-bold text-chocolate text-xs shadow-sm focus:ring-2 ring-chocolate/20 h-20"
                      />
                    </div>
                  </div>
               </div>

               {/* CARGA DE CHOCOLATES */}
               <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/20"><TrendingUp size={20}/></div>
                    <h3 className="text-lg font-black text-chocolate tracking-tight uppercase">Carga de Chocolates</h3>
                  </div>

                  <div className="space-y-4">
                    {selectedIngredients.map((ing) => (
                      <div key={ing.id} className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-chocolate tracking-widest bg-white px-3 py-1 rounded-full shadow-sm">{ing.label}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Material</label>
                            <select value={ing.material_id} onChange={e => updateIngredient(ing.id, 'material_id', e.target.value)} className="w-full p-3 bg-white rounded-xl border-none font-bold text-chocolate text-xs shadow-sm" required>
                              <option value="">Elegir chocolate...</option>
                              {materials.filter(m => m.category && m.category.toLowerCase() === 'chocolate').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Lote</label>
                            <select value={ing.batch_id} onChange={e => updateIngredient(ing.id, 'batch_id', e.target.value)} className="w-full p-3 bg-white rounded-xl border-none font-bold text-chocolate text-xs shadow-sm" required>
                              <option value="">Elegir lote...</option>
                              {stock.filter(s => s.material_id === parseInt(ing.material_id)).map(s => (
                                <option key={s.batch_id} value={s.batch_id}>{s.lote} ({s.quantity} {s.unit})</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Cantidad a Cargar (KG)</label>
                          <input type="number" step="0.1" value={ing.quantity} onChange={e => updateIngredient(ing.id, 'quantity', e.target.value)} placeholder="0.0" className="w-full p-3 bg-white rounded-xl border-none font-black text-chocolate text-xs shadow-sm" required />
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>

            <button type="submit" className="w-full bg-chocolate text-white p-6 rounded-[2rem] font-black text-sm uppercase tracking-[0.4em] shadow-2xl shadow-chocolate/30 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-4">
              <Play size={24} /> Iniciar Proceso de Producción
            </button>
          </form>
        </section>
      ) : productionTab === 'finalizar' ? (
        /* VISTA DE FINALIZAR PT */
        <section className="space-y-6">
          {/* BARRA SUPERIOR DE SESIONES ACTIVAS (HORIZONTAL Y COMPACTA) */}
          <div className="bg-white/80 backdrop-blur-md p-3 rounded-[2rem] shadow-sm border border-chocolate/5 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-3">
               <div className="px-4 border-r border-slate-100 flex items-center gap-2 whitespace-nowrap">
                  <RefreshCw size={14} className="text-raspberry animate-spin-slow" />
                  <span className="text-[10px] font-black text-chocolate uppercase">Sesiones Activas:</span>
               </div>
               <div className="flex gap-2">
                 {activeSessions.length === 0 ? (
                    <p className="text-[10px] font-bold text-slate-300 uppercase italic py-2">No hay cargas en línea</p>
                 ) : (
                    activeSessions.map(sess => (
                      <button 
                        key={sess.id}
                        onClick={() => setFinishingSession(sess)}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${finishingSession?.id === sess.id ? 'bg-chocolate text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                      >
                        {sess.product_name || `ID #${sess.id}`}
                      </button>
                    ))
                 )}
               </div>
            </div>
          </div>

          {finishingSession ? (
            <div className="space-y-6">
              {/* MONITOREO Y ACCIONES (COMPACTO Y SIMÉTRICO) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {/* ESTANQUES (A LA IZQUIERDA) */}
                <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-chocolate/5 flex flex-col items-center justify-center space-y-8 relative overflow-hidden min-h-[340px]">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-chocolate to-raspberry opacity-20" />
                    <div className="grid grid-cols-2 gap-12 w-full max-w-sm">
                       {(() => {
                         const tanks = calculateTanks(finishingSession);
                         return (
                           <>
                             <div className="flex flex-col items-center gap-4">
                                <button 
                                  onClick={() => { setRefillSession(finishingSession); setRefillTarget('estanque1'); }}
                                  className="w-10 h-10 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center hover:bg-amber-100 transition-all border border-amber-100 shadow-sm"
                                  title="Recargar Estanque 1"
                                >
                                  <Plus size={20}/>
                                </button>
                                <VerticalTank 
                                  percent={tanks.blanco.percent}
                                  current={tanks.blanco.current}
                                  total={tanks.blanco.total}
                                  label="E1"
                                  material="Base"
                                  colorClass="bg-gradient-to-t from-amber-100 to-amber-200"
                                  secondaryColorClass="text-amber-600"
                                />
                             </div>
                             <div className="flex flex-col items-center gap-4">
                                <button 
                                  onClick={() => { setRefillSession(finishingSession); setRefillTarget('estanque2'); }}
                                  className="w-10 h-10 bg-chocolate/5 text-chocolate/60 rounded-full flex items-center justify-center hover:bg-chocolate/10 transition-all border border-chocolate/10 shadow-sm"
                                  title="Recargar Estanque 2"
                                >
                                  <Plus size={20}/>
                                </button>
                                <VerticalTank 
                                  percent={tanks.cobertura.percent}
                                  current={tanks.cobertura.current}
                                  total={tanks.cobertura.total}
                                  label="E2"
                                  material="Cobertura"
                                  colorClass="bg-gradient-to-t from-chocolate to-chocolate-light"
                                  secondaryColorClass="text-chocolate/40"
                                />
                             </div>
                           </>
                         );
                       })()}
                    </div>
                </div>

                {/* BOTONES DE ACCIÓN (A LA DERECHA) */}
                <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-chocolate/5 flex flex-col justify-between min-h-[340px] relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-chocolate rotate-12"><TrendingUp size={140} /></div>
                   
                   <div className="flex justify-between items-start mb-6 relative z-10">
                      <div>
                        <h3 className="text-lg font-black text-chocolate uppercase tracking-tighter leading-tight">{finishingSession.product_name}</h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Control de Proceso | ID #{finishingSession.id}</p>
                      </div>
                      <button onClick={() => cancelSession(finishingSession.id)} className="p-2.5 bg-slate-50 text-slate-300 rounded-2xl hover:bg-raspberry/10 hover:text-raspberry transition-all shadow-sm">
                         <Trash2 size={18} />
                      </button>
                   </div>

                   <div className="grid grid-cols-2 gap-5 relative z-10">
                      {/* FORMULARIO CAJAS PRODUCIDAS (DINÁMICO) */}
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const val = e.target.qty.value;
                        handleProgress(finishingSession.id, val === '' ? 1 : val, 'Cajas');
                        e.target.reset();
                      }} className="flex gap-2 h-28">
                         <div className="flex-1 flex flex-col bg-slate-50/50 rounded-[2.5rem] border border-slate-200/50 shadow-inner p-4 hover:bg-white transition-all group">
                            <p className="text-[9px] font-black text-slate-400 uppercase text-center mb-1.5 tracking-widest group-hover:text-raspberry transition-colors">Reportar Cajas</p>
                            <input name="qty" type="number" step="1" placeholder="1" className="w-full flex-1 bg-transparent text-center text-2xl font-black text-chocolate outline-none placeholder:text-slate-300" />
                            <p className="text-[7px] font-bold text-slate-300 uppercase text-center mt-1">
                               {finishingSession.format === '10 KG' ? 'Granel 10kg' : '24 Potes 3.6kg'}
                            </p>
                         </div>
                         <button type="submit" className="h-full px-5 bg-chocolate text-white rounded-[2.5rem] shadow-xl shadow-chocolate/20 flex flex-col items-center justify-center hover:bg-chocolate-light transition-all hover:scale-105 active:scale-95">
                            <Plus size={24}/>
                            <span className="text-[9px] font-black uppercase">Sumar</span>
                         </button>
                      </form>

                      {/* FORMULARIO VERTIDO IQF (DINÁMICO) */}
                      <form
  onSubmit={(e) => {
    e.preventDefault();
    if (!iqfForm.material_id || !iqfForm.batch_id || !iqfForm.quantity) {
      return showToast('Selecciona frambuesa, lote y cantidad', 'error');
    }

    const loteSeleccionado = stock.find(
      s => s.batch_id === parseInt(iqfForm.batch_id)
    );

    handleProgress(finishingSession.id, iqfForm.quantity, 'Frambuesa', {
      material_id: iqfForm.material_id,
      batch_id: iqfForm.batch_id,
      lote: loteSeleccionado?.lote || null
    });

    setIqfForm({ material_id: '', batch_id: '', quantity: '' });
  }}
  className="bg-blue-50/50 rounded-[2.5rem] border border-blue-100/50 shadow-inner p-4 hover:bg-white transition-all group space-y-3"
>
  <p className="text-[9px] font-black text-blue-400 uppercase text-center tracking-widest group-hover:text-blue-600 transition-colors">
    Vertido IQF
  </p>

  <select
    value={iqfForm.material_id}
    onChange={e => setIqfForm({ ...iqfForm, material_id: e.target.value, batch_id: '' })}
    className="w-full p-3 bg-white rounded-xl border-none font-bold text-blue-600 text-xs shadow-sm"
    required
  >
    <option value="">Elegir frambuesa...</option>
    {materials
      .filter(m => {
        const name = (m.name || '').toLowerCase();
        const cat = (m.category || '').toLowerCase();
        return name.includes('frambuesa') || name.includes('raspberry') || cat.includes('frambuesa');
      })
      .map(m => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
  </select>

  <select
    value={iqfForm.batch_id}
    onChange={e => setIqfForm({ ...iqfForm, batch_id: e.target.value })}
    className="w-full p-3 bg-white rounded-xl border-none font-bold text-blue-600 text-xs shadow-sm"
    required
  >
    <option value="">Elegir lote...</option>
    {stock
      .filter(s => s.material_id === parseInt(iqfForm.material_id))
      .map(s => (
        <option key={s.batch_id} value={s.batch_id}>
          {s.lote} ({s.quantity} {s.unit})
        </option>
      ))}
  </select>

  <div className="flex gap-2">
    <input
      name="qty"
      type="number"
      step="0.1"
      value={iqfForm.quantity}
      onChange={e => setIqfForm({ ...iqfForm, quantity: e.target.value })}
      placeholder="1.0"
      className="w-full flex-1 p-3 bg-white rounded-xl border-none text-center text-xl font-black text-blue-600 outline-none placeholder:text-blue-300 shadow-sm"
      required
    />
    <button
      type="submit"
      className="px-5 bg-blue-500 text-white rounded-2xl shadow-xl shadow-blue-200 flex flex-col items-center justify-center hover:bg-blue-600 transition-all hover:scale-105 active:scale-95"
    >
      <Plus size={24}/>
      <span className="text-[9px] font-black uppercase">KG</span>
    </button>
  </div>
</form>
                   </div>

                   <div className="grid grid-cols-3 gap-6 mt-6 pt-6 border-t border-slate-100 relative z-10">
                      <div className="text-center">
                         <p className="text-[8px] font-black text-slate-300 uppercase mb-1.5 tracking-widest">Cajas</p>
                         <p className="text-2xl font-black text-chocolate leading-none">{calculateTanks(finishingSession).boxesTotal}</p>
                      </div>
                      <div className="text-center border-x border-slate-100 px-2">
                         <p className="text-[8px] font-black text-slate-300 uppercase mb-1.5 tracking-widest">Frambuesa</p>
                         <div className="flex items-baseline justify-center gap-0.5">
                            <p className="text-2xl font-black text-blue-600 leading-none">{calculateTanks(finishingSession).frambuesaTotal.toFixed(1)}</p>
                            <span className="text-[10px] font-black text-blue-300">KG</span>
                         </div>
                      </div>
                      <div className="text-center">
                         <p className="text-[8px] font-black text-slate-300 uppercase mb-1.5 tracking-widest">Teórico</p>
                         <div className="flex items-baseline justify-center gap-0.5">
                            <p className="text-2xl font-black text-raspberry leading-none">{calculateTanks(finishingSession).ptTotal.toFixed(1)}</p>
                            <span className="text-[10px] font-black text-raspberry/30">KG</span>
                         </div>
                      </div>
                   </div>
                </div>
              </div>

              {/* FORMULARIO DE CIERRE (3 COLUMNAS - MÁS COMPACTO) */}
              <div className="bg-white p-6 rounded-[3rem] shadow-2xl border border-chocolate/5 relative overflow-hidden">
                <form onSubmit={handleFinishSession} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* COLUMNA 1 */}
                  <div className="space-y-3 bg-slate-50/50 p-5 rounded-[2.5rem] border border-slate-100">
                     <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 bg-chocolate rounded-full" />
                        <h5 className="text-[9px] font-black text-chocolate uppercase tracking-widest">1. Datos de Salida</h5>
                     </div>
                     <div className="space-y-1">
                       <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Lote PT</label>
                       <input name="pt_lote" placeholder="Lote..." className="w-full p-3 bg-white rounded-xl border-none font-bold text-chocolate text-xs shadow-sm" required />
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Cajas Totales</label>
                          <input name="pt_quantity" defaultValue={calculateTanks(finishingSession).boxesTotal} type="number" step="0.01" className="w-full p-3 bg-white rounded-xl border-none font-black text-chocolate text-xs shadow-sm" required />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Formato Salida</label>
                          <div className="w-full p-3 bg-white rounded-xl border border-slate-100 font-black text-chocolate text-[11px] uppercase text-center flex items-center justify-center">
                             {finishingSession.format}
                          </div>
                        </div>
                     </div>
                  </div>

                  {/* COLUMNA 2 */}
                  <div className="space-y-3 bg-blue-50/30 p-5 rounded-[2.5rem] border border-blue-100/50">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                        <h5 className="text-[9px] font-black text-blue-600 uppercase tracking-widest">2. Ajustes Reales</h5>
                    </div>
                    <div className="space-y-1">
                       <label className="text-[8px] font-black uppercase text-blue-500 ml-2">Frambuesa Procesada (KG)</label>
                       <input name="kg_frambuesa_total" defaultValue={calculateTanks(finishingSession).frambuesaTotal.toFixed(1)} type="number" step="0.1" className="w-full p-3 bg-white rounded-xl border-none font-black text-blue-600 text-xs shadow-sm" required />
                     </div>
                    <div className="grid grid-cols-2 gap-2">
                        {(() => {
                          const tanks = calculateTanks(finishingSession);
                          // Buscar materiales por palabras clave para identificar qué hay en cada estanque
                          const e1 = finishingSession.ingredients?.find(i => {
                            const n = (i.material_name || '').toLowerCase();
                            return n.includes('blanco') || n.includes('white');
                          });
                          const e2 = finishingSession.ingredients?.find(i => {
                            const n = (i.material_name || '').toLowerCase();
                            return i.material_name !== e1?.material_name && (n.includes('leche') || n.includes('cobertura') || n.includes('amargo') || n.includes('dark') || n.includes('rub') || n.includes('choc'));
                          });

                          return (
                            <>
                              <div className="space-y-2">
                                <div className="relative group">
                                   <label className="text-[7px] font-black text-amber-600 uppercase ml-2 block mb-1 truncate">{e1?.material_name || 'Estanque 1'}</label>
                                   <input name="est1_final_est" defaultValue={tanks.blanco.current.toFixed(1)} type="number" step="0.1" className="w-full p-3 bg-white rounded-xl border-none font-bold text-amber-700 text-xs shadow-sm" />
                                   <span className="absolute right-3 bottom-3 text-[7px] font-black text-amber-200">E1</span>
                                </div>
                                {e1 && (
                                  <label className="flex items-center gap-2 px-3 py-1.5 bg-white/50 rounded-lg cursor-pointer hover:bg-white transition-colors">
                                    <input type="checkbox" checked={recoverE1} onChange={e => setRecoverE1(e.target.checked)} className="rounded text-amber-500 focus:ring-amber-500" />
                                    <span className="text-[7px] font-black text-amber-600 uppercase">Recuperar a Bodega</span>
                                  </label>
                                )}
                              </div>
                              <div className="space-y-2">
                                <div className="relative group">
                                   <label className="text-[7px] font-black text-chocolate uppercase ml-2 block mb-1 truncate">{e2?.material_name || 'Estanque 2'}</label>
                                   <input name="est2_final_est" defaultValue={tanks.cobertura.current.toFixed(1)} type="number" step="0.1" className="w-full p-3 bg-white rounded-xl border-none font-bold text-chocolate text-xs shadow-sm" />
                                   <span className="absolute right-3 bottom-3 text-[7px] font-black text-chocolate/20">E2</span>
                                </div>
                                {e2 && (
                                  <label className="flex items-center gap-2 px-3 py-1.5 bg-white/50 rounded-lg cursor-pointer hover:bg-white transition-colors">
                                    <input type="checkbox" checked={recoverE2} onChange={e => setRecoverE2(e.target.checked)} className="rounded text-chocolate focus:ring-chocolate" />
                                    <span className="text-[7px] font-black text-chocolate uppercase">Recuperar a Bodega</span>
                                  </label>
                                )}
                              </div>
                            </>
                          );
                        })()}
                    </div>
                  </div>

                  {/* COLUMNA 3 */}
                  <div className="space-y-3 bg-raspberry/[0.02] p-5 rounded-[2.5rem] border border-raspberry/5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                          <div className="w-1.5 h-1.5 bg-raspberry rounded-full" />
                          <h5 className="text-[9px] font-black text-raspberry uppercase tracking-widest">3. Mermas y Cierre</h5>
                      </div>
                      <input name="crumble_waste" type="number" step="0.1" placeholder="Merma (KG)..." className="w-full p-3 bg-white rounded-xl border-none font-bold text-raspberry text-xs shadow-sm" />
                    </div>
            <input name="frambuesa_movement_code" type="text" placeholder="Código Guía Retiro Frambuesa..." className="w-full p-3 bg-white rounded-xl border-none font-bold text-xs shadow-sm mt-2" />
            <input name="storage_movement_code" type="text" placeholder="Código Guía Envío a Guarda..." className="w-full p-3 bg-white rounded-xl border-none font-bold text-xs shadow-sm mt-2" />
                    <button type="submit" className="w-full bg-raspberry text-white py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-raspberry/30 hover:scale-[1.02] active:scale-95 transition-all">
                       Finalizar Todo
                    </button>
</div>
                </form>
              </div>
            </div>
          ) : (
            <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-[2.5rem] h-64 flex flex-col items-center justify-center p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                <PackageOpen size={32} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecciona una sesión de la barra superior para operar</p>
            </div>
          )}
        </section>
      ) : (
        /* VISTA DE SIMULADOR */
        <Simulator materials={materials} stock={stock} showToast={showToast} hideHeader={true} />
      )}

      {/* HISTORIAL SECTION - ONLY VISIBLE ON FINISH PT TAB */}
      {productionTab === 'finalizar' && (
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
            <h3 className="text-lg font-black text-chocolate uppercase tracking-tight flex items-center gap-2"><History size={18} className="text-raspberry" /> Historial de Producción</h3>
            <div className="flex gap-2 w-full md:w-auto">
              <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2.5 bg-white border border-chocolate/5 rounded-xl text-[10px] font-bold shadow-sm outline-none flex-1 md:w-48" />
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="p-2.5 bg-white border border-chocolate/5 rounded-xl text-[10px] font-bold shadow-sm outline-none" />
            </div>
          </div>
          <div className="bg-white rounded-[2rem] shadow-xl shadow-chocolate/[0.05] border border-chocolate/5 overflow-hidden">
            <div className="overflow-x-auto">
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
                                                                      <button onClick={() => openPrintModal(prod)} className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Imprimir Etiqueta"><Printer size={16} /></button>
                            <button onClick={() => deleteProduction(prod.id)} className="p-2 text-slate-300 hover:text-raspberry hover:bg-raspberry/5 rounded-lg transition-all"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                      {expandedProd === prod.id && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={6} className="p-6">
                            <div className="bg-white rounded-2xl p-4 border border-chocolate/5 shadow-inner">
                              <div className="flex justify-between items-center mb-4">
                                <h4 className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2"><PlusCircle size={12}/> Insumos Consumidos</h4>
                                <div className="flex gap-4">
                                  {prod.kg_frambuesa_total > 0 && <span className="text-[8px] font-black text-blue-500 uppercase">Frambuesa: {prod.kg_frambuesa_total} KG</span>}
                                  {prod.est1_final_est > 0 && <span className="text-[8px] font-black text-amber-600 uppercase">E1 (Blanco) Rest: {prod.est1_final_est} KG</span>}
                                  {prod.est2_final_est > 0 && <span className="text-[8px] font-black text-chocolate uppercase">E2 (Cobertura) Rest: {prod.est2_final_est} KG</span>}
                                </div>
                              </div>
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
          </div>
        </section>
      )}

      {/* MODAL DE RECARGA ESPECÍFICA */}
      {refillSession && (
        <div className="fixed inset-0 bg-chocolate/60 backdrop-blur-md z-[999] flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/20">
              <div className="p-8 bg-gradient-to-br from-chocolate to-chocolate-light text-white relative">
                <div className="absolute top-0 right-0 p-8 opacity-10"><RefreshCw size={80} className="animate-spin-slow"/></div>
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter">Recarga de Insumos</h3>
                    <p className="text-white/60 font-bold uppercase text-[9px] tracking-widest mt-1">Añadiendo chocolate a {refillTarget === 'estanque1' ? 'Estanque 1 (Base)' : 'Estanque 2 (Cobertura)'}</p>
                  </div>
                  <button type="button" onClick={() => { setRefillSession(null); setRefillTarget(null); }} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all"><X size={20}/></button>
                </div>
              </div>

              <form onSubmit={handleRefill} className="p-8 space-y-6">
                <div className="space-y-4">
                  {refillIngredients.map((ing) => (
                    <div key={ing.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                      <div className="md:col-span-12 space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Material</label>
                              <select 
                                value={ing.material_id} 
                                onChange={e => updateRefillIngredient(ing.id, 'material_id', e.target.value)} 
                                className="w-full p-3 bg-white rounded-xl border-none font-bold text-chocolate text-xs shadow-sm" 
                                required
                              >
                                <option value="">Elegir material...</option>
                                {materials
                                  .filter(m => {
                                    const name = m.name.toLowerCase();
                                    if (refillTarget === 'estanque1') return name.includes('blanco') || name.includes('white');
                                    return name.includes('leche') || name.includes('milk') || name.includes('amargo') || name.includes('dark') || name.includes('rub') || name.includes('cobertura');
                                  })
                                  .map(m => <option key={m.id} value={m.id}>{m.name}</option>)
                                }
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Lote</label>
                              <select 
                                value={ing.batch_id} 
                                onChange={e => updateRefillIngredient(ing.id, 'batch_id', e.target.value)} 
                                className="w-full p-3 bg-white rounded-xl border-none font-bold text-chocolate text-xs shadow-sm" 
                                required
                              >
                                <option value="">Elegir lote...</option>
                                {stock.filter(s => s.material_id === parseInt(ing.material_id)).map(s => (
                                  <option key={s.batch_id} value={s.batch_id}>{s.lote} ({s.quantity} {s.unit})</option>
                                ))}
                              </select>
                            </div>
                         </div>
                         <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Cantidad a Añadir (KG)</label>
                            <input 
                              type="number" 
                              step="0.1" 
                              value={ing.quantity} 
                              onChange={e => updateRefillIngredient(ing.id, 'quantity', e.target.value)} 
                              placeholder="0.0" 
                              className="w-full p-3 bg-white rounded-xl border-none font-black text-chocolate text-xs shadow-sm" 
                              required 
                            />
                         </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                   <button type="button" onClick={() => { setRefillSession(null); setRefillTarget(null); }} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                   <button type="submit" className="flex-[2] py-4 bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-amber-500/20 hover:scale-[1.02] transition-all">Confirmar Recarga</button>
                </div>
              </form>
           </div>
        </div>
      )}

      {/* PRINT MODAL REDESIGN */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-chocolate/80 backdrop-blur-xl z-[999] flex items-center justify-center p-4">
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
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-slate-400 block ml-2">Destino de Impresión</label>
                    <select 
                      value={selectedPrinter} 
                      onChange={e => setSelectedPrinter(e.target.value)}
                      className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-black text-chocolate text-xs uppercase tracking-wide focus:outline-none focus:ring-4 ring-chocolate/5 transition-all"
                    >
                      {zebraStatus === 'checking' && (
                        <option disabled>Buscando impresoras locales...</option>
                      )}
                      {zebraStatus === 'detected' && printers.map((pr, idx) => (
                        <option key={idx} value={JSON.stringify(pr)}>
                          🖨️ {pr.name} ({pr.connection})
                        </option>
                      ))}
                      <option value="download">💾 Descargar archivo .ZPL</option>
                      <option value="copy">📋 Copiar código ZPL al portapapeles</option>
                      <option value="local-server">💻 Impresora local del Servidor (Zebra PC-NOC)</option>
                    </select>
                    {zebraStatus === 'not_detected' && (
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-normal mt-1.5 px-1 text-center">
                        ⚠️ No se detectó "Zebra Browser Print" en tu PC. Se seleccionó la descarga por defecto.
                      </p>
                    )}
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
                  <Printer size={20} /> Ejecutar Acción
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
