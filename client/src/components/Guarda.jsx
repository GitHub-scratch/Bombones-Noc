import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowUpRight, ClipboardList, Trash2, Info, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoFrunar from '../Frunar.jpeg';
import firmaOmar from '../Firma Omar.png';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const RECIPE = {
  BLANCO_FACTOR: 0.29,
  COBERTURA_FACTOR: 0.28,
  FRAMBUESA_FACTOR: 0.43,
  KG_PER_24POTES: 3.6,
  KG_PER_10KG: 10
};

export default function Guarda({ fetchData, showToast, productionHistory = [], materials = [] }) {
  const [ptBatches, setPtBatches] = useState([]);
  const [ptHistory, setPtHistory] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [mpDispatchCode, setMpDispatchCode] = useState('');
  const [productionDateOverride, setProductionDateOverride] = useState('');

  const loadData = async () => {
    try {
      const [resBatches, resHistory] = await Promise.all([
        axios.get(`${API_URL}/pt_batches`),
        axios.get(`${API_URL}/pt_history`)
      ]);
      setPtBatches(resBatches.data || []);
      setPtHistory(resHistory.data || []);
    } catch (err) {
      console.error("Error loading PT data", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const uniqueProducts = [...new Set(ptBatches.map(b => b.pt_name))];

  const handleDispatch = async (e) => {
    e.preventDefault();
    const form = e.target;
    const packagingType = selectedBatch.unit === 'Cajas' ? 'Cajas de Potes (24 un)' : 'Cajas de Granel';
    const data = {
      pt_name: selectedProduct,
      pt_lote: selectedBatch.pt_lote,
      quantity: parseFloat(form.quantity.value),
      unit: selectedBatch.unit,
      destination: form.destination.value || 'GUARDA',
      packaging: packagingType,
      movement_code: form.movement_code?.value || null,
      reception_code: form.reception_code?.value || null,
      operators_count: form.operators_count?.value ? parseInt(form.operators_count.value) : null,
      tarja: form.tarja?.value || null,
      mp_dispatch_code: mpDispatchCode || null,
      production_date_override: productionDateOverride || null
    };
    try {
      const response = await axios.post(`${API_URL}/pt_dispatch`, data);
      const dispatchId = response.data.id;
      generateDispatchPDF({ ...data, id: dispatchId });
      form.reset();
      setSelectedProduct('');
      setSelectedBatch(null);
        setMpDispatchCode('');
        setProductionDateOverride('');
      await loadData();
      await fetchData();
      showToast('Despacho a Guarda registrado con éxito');
    } catch (err) {
      showToast(err.response?.data?.error || 'Error en despacho', 'error');
    }
  };

  const deleteDispatch = async (id) => {
    if (!window.confirm('¿Anular este despacho? El producto terminado regresará al stock de bodega.')) return;
    try {
      await axios.delete(`${API_URL}/pt_dispatch/${id}`);
      await loadData();
      await fetchData();
      showToast('Despacho anulado y stock retornado');
    } catch (err) {
      showToast('Error al anular despacho', 'error');
    }
  };

  // Busca la producción original (con sus insumos, mermas, etc.) que corresponde a un lote de PT
const findProductionByLote = (pt_lote) => {
      const matches = (productionHistory || []).filter(p => p.pt_lote === pt_lote);
      if (matches.length === 0) return null;
      // Combina ingredientes y campos numéricos de TODAS las sesiones de producción
      // que compartan el mismo pt_lote, para no perder materias primas si hubo más de una sesión.
      const merged = { ...matches[0] };
      merged.ingredients = matches.flatMap(m => m.ingredients || []);
      ['est1_final_est', 'est2_final_est', 'crumble_waste', 'kg_frambuesa_total'].forEach(field => {
        merged[field] = matches.reduce((sum, m) => sum + (parseFloat(m[field]) || 0), 0);
      });
      merged.frambuesa_movement_code = matches.map(m => m.frambuesa_movement_code).filter(Boolean).join(', ');
      merged.frambuesa_lote = matches.map(m => m.frambuesa_lote).filter(Boolean).join(', ');
      return merged;
    };
  
  // Genera el PDF con el formato oficial de Producción (usado antes al finalizar jornada),
  // combinando los datos de producción original con los datos del despacho a Guarda.
  const generateDispatchPDF = (dispatchData) => {
    try {
      const prod = findProductionByLote(dispatchData.pt_lote) || {};
      const doc = new jsPDF();
      const dateStr = new Date(dispatchData.production_date_override || prod.date || Date.now()).toLocaleDateString();

      // --- ENCABEZADO ---
      doc.setDrawColor(0);
      doc.setLineWidth(0.1);
      doc.rect(10, 10, 190, 25);
      doc.addImage(logoFrunar, 'JPEG', 12, 12, 45, 21);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('PRODUCCIÓN PRODUCTO TERMINADO', 105, 22, { align: 'center' });
      doc.text('Sistema De Gestión De Calidad', 105, 17, { align: 'center' });
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Códigos.: R-BRCGS-6.1', 155, 17);
      doc.text('Fecha : 10-2025', 155, 22);
      doc.text('Versión: 02', 155, 27);

      let currentY = 40;

      // --- TABLA DE DATOS GENERALES (con datos de producción + despacho a Guarda) ---
      autoTable(doc, {
        startY: currentY,
        body: [
          [
            { content: `Producto: ${dispatchData.pt_name}`, colSpan: 2 },
            { content: `Fecha de Producción: ${dateStr}`, colSpan: 2 }
          ],
          [
            { content: `Lote: ${dispatchData.pt_lote}`, colSpan: 1 },
            { content: `Cód. Desp. Interno MP. Frunar: ${dispatchData.mp_dispatch_code || ''}`, colSpan: 1 },
            { content: `Código Recep PT. Frunar: ${dispatchData.reception_code || ''}`, colSpan: 2 }
          ],
          [
            { content: `Tarja: ${dispatchData.tarja || ''}`, colSpan: 1 },
            { content: `Nombre del responsable de Calidad: Valeria Briones`, colSpan: 3 }
          ],
          [
            { content: `Operarios: ${dispatchData.operators_count || ''}`, colSpan: 2 },
            { content: `Código de Guía: ${dispatchData.movement_code || 'N/A'}`, colSpan: 1 },
            { content: `Bodega Destino: ${dispatchData.destination || 'GUARDA'}`, colSpan: 1 }
          ]
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0] },
        columnStyles: { 0: { width: 47.5 }, 1: { width: 47.5 }, 2: { width: 47.5 }, 3: { width: 47.5 } }
      });

      currentY = doc.lastAutoTable.finalY + 10;

      // --- TABLA DE INGREDIENTES (tomados de la producción original, si existe) ---
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumen del Producto Terminado', 105, currentY - 2, { align: 'center' });

      const ingredientes = prod.ingredients || [];
      const frambuesaIng = ingredientes.find(ing => {
        const name = (ing.material_name || '').toLowerCase();
        return name.includes('frambuesa') || name.includes('raspberry');
      });
      const loteFrambuesa = prod.frambuesa_lote || frambuesaIng?.lote || 'S/L';
      const chocolateBaseIng = ingredientes.find(ing => {
        const name = (ing.material_name || '').toLowerCase();
        return name.includes('blanco') || name.includes('white');
      });
      const chocolateCoberturaIng = ingredientes.find(ing => {
        const name = (ing.material_name || '').toLowerCase();
        return (name.includes('leche') || name.includes('milk') || name.includes('amargo') || name.includes('dark') || name.includes('rub') || name.includes('cobertura'));
      });

      const est1Recuperado = parseFloat(prod.est1_final_est) || 0;
      const est2Recuperado = parseFloat(prod.est2_final_est) || 0;
      const chocolateBaseCargado = parseFloat(chocolateBaseIng?.quantity) || 0;
      const chocolateCoberturaCargado = parseFloat(chocolateCoberturaIng?.quantity) || 0;
      const totalPtKgReport = (parseFloat(dispatchData.quantity) || 0) * (dispatchData.unit === 'Granel' ? RECIPE.KG_PER_10KG : RECIPE.KG_PER_24POTES);
      const usadoBaseReport = totalPtKgReport * RECIPE.BLANCO_FACTOR;
      const usadoCoberturaReport = totalPtKgReport * RECIPE.COBERTURA_FACTOR;
      const deberiaQuedarBase = Math.max(0, chocolateBaseCargado - usadoBaseReport);
      const deberiaQuedarCobertura = Math.max(0, chocolateCoberturaCargado - usadoCoberturaReport);
      const mermaChocolateBase = Math.max(0, deberiaQuedarBase - est1Recuperado);
      const mermaChocolateCobertura = Math.max(0, deberiaQuedarCobertura - est2Recuperado);

      const ingredientRows = ingredientes.map(ing => {
        const esChocolateBase = ing.material_name === chocolateBaseIng?.material_name && ing.lote === chocolateBaseIng?.lote;
        const esChocolateCobertura = ing.material_name === chocolateCoberturaIng?.material_name && ing.lote === chocolateCoberturaIng?.lote;
        let salidaProceso = '';
        let merma = '';
        if (esChocolateBase) {
          salidaProceso = `${est1Recuperado.toFixed(2)} kg`;
          merma = `${mermaChocolateBase.toFixed(2)} kg`;
        }
        if (esChocolateCobertura) {
          salidaProceso = `${est2Recuperado.toFixed(2)} kg`;
          merma = `${mermaChocolateCobertura.toFixed(2)} kg`;
        }
        return [ing.material_name, ing.lote, `${(parseFloat(ing.quantity) || 0).toFixed(2)} kg`, salidaProceso, merma];
      });

      if (prod.crumble_waste > 0) {
        ingredientRows.push(['Merma Crumble', loteFrambuesa, '', '', `${prod.crumble_waste} kg`]);
      }
      if (prod.kg_frambuesa_total > 0) {
        ingredientRows.push(['Frambuesa Utilizada', loteFrambuesa, `${prod.kg_frambuesa_total} kg`, '', '']);
      }

      const totalPotes = dispatchData.unit === 'Cajas' ? (parseFloat(dispatchData.quantity) * 24) : '';
      ingredientRows.push(['Total, potes', '', totalPotes, '', '']);
      ingredientRows.push(['Total, bolsas', '', '', '', '']);
      ingredientRows.push(['Total, cajas', '', dispatchData.quantity, '', '']);

      autoTable(doc, {
        startY: currentY,
        head: [['Materias Primas', 'Lote/Origen', 'Entrada a proceso kg', 'Salida de proceso kg', 'Mermas']],
        body: ingredientRows,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
        styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1 },
        columnStyles: { 0: { width: 50 }, 1: { width: 40 }, 2: { width: 35 }, 3: { width: 35 }, 4: { width: 30 } }
      });

      currentY = doc.lastAutoTable.finalY + 10;

      // --- OBSERVACIONES ---
      doc.rect(10, currentY, 190, 25);
      doc.setFontSize(8);

      // --- CODIGOS DE GUIA EXTERNA ---
      if (dispatchData.movement_code || prod.storage_movement_code) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        if (dispatchData.movement_code) {
          doc.text(`Código Guía Envío a Guarda: ${dispatchData.movement_code}`, 12, currentY);
          currentY += 5;
        }
        if (dispatchData.reception_code) {
          doc.text(`Código de Recepción: ${dispatchData.reception_code}`, 12, currentY);
          currentY += 5;
        }
        currentY += 3;
      }

      doc.setFont('helvetica', 'bold');
      doc.text('Observaciones:', 12, currentY + 5);
      currentY += 45;

      // --- FIRMA ---
      doc.addImage(firmaOmar, 'PNG', 82.5, currentY - 22, 45, 20);
      doc.line(75, currentY, 135, currentY);
      doc.setFontSize(9);
      doc.text('Firma Responsable', 105, currentY + 5, { align: 'center' });

      doc.save(`Reporte_Despacho_${dispatchData.pt_lote}.pdf`);
      showToast('Reporte PDF generado');
    } catch (error) {
      console.error('Error al generar PDF:', error);
      showToast('Error al generar PDF de despacho', 'error');
    }
  };

  const dispatchHistory = ptHistory.filter(h => h.type === 'OUT');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-black text-chocolate dark:text-cream tracking-tight">Despacho a Guarda</h2>
        <p className="text-xs font-bold text-slate-400">Salida de producto terminado a bodega externa.</p>
      </div>

      <form onSubmit={handleDispatch} className="bg-white dark:bg-white/5 p-6 rounded-[2rem] shadow-sm space-y-4">
        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Producto</label>
          <select
            className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2 focus:ring-chocolate/20 transition-colors"
            value={selectedProduct}
            onChange={(e) => { setSelectedProduct(e.target.value); setSelectedBatch(null); }}
            required
          >
            <option value="">Seleccionar Producto...</option>
            {uniqueProducts.map((name, idx) => (
              <option key={idx} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {selectedProduct && (
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Lote Disponible</label>
            <select
              className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2 focus:ring-chocolate/20 transition-colors"
              onChange={(e) => setSelectedBatch(ptBatches.find(b => b.pt_lote === e.target.value && b.pt_name === selectedProduct))}
              required
            >
              <option value="">Seleccionar Lote...</option>
              {ptBatches.filter(b => b.pt_name === selectedProduct).map((b, idx) => (
                <option key={idx} value={b.pt_lote}>{b.pt_lote} ({b.total_quantity} {b.unit})</option>
              ))}
            </select>
          </div>
        )}

        {selectedBatch && (
          <div className="text-xs font-bold text-slate-400">
            Formato: {selectedBatch.unit === 'Cajas' ? 'Cajas de Potes (24 un)' : 'Cajas de Granel'}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Cantidad a Despachar</label>
          <div className="flex gap-2">
            <input name="quantity" type="number" step="0.01" placeholder="0.00" className="flex-1 p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2 focus:ring-chocolate/20 transition-colors" required />
            <span className="p-3 text-xs font-black text-slate-400">{selectedBatch?.unit || '---'}</span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Bodega Destino</label>
          <input name="destination" placeholder="Ej: Bodega Central" className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2 focus:ring-chocolate/20 transition-colors" />
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Código de Guía (Bodega Externa)</label>
          <input name="movement_code" placeholder="Ej: GUIA-00123" className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2" />
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Código de Recepción</label>
          <input name="reception_code" placeholder="Ej: REC-00123" className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2" />
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-400 ml-2">N° de Operarios</label>
          <input name="operators_count" type="number" placeholder="Ej: 2" className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2" />
        </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Cód. Desp. Interno MP. Frunar</label>
            <input value={mpDispatchCode} onChange={(e) => setMpDispatchCode(e.target.value)} placeholder="Ej: DESP-00123" className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2 focus:ring-chocolate/20 transition-colors" />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Fecha de Producción (opcional)</label>
            <input value={productionDateOverride} onChange={(e) => setProductionDateOverride(e.target.value)} type="date" className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2 focus:ring-chocolate/20 transition-colors" />
          </div>

        <div className="space-y-1">
          <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Tarja</label>
          <input name="tarja" placeholder="Ej: T-00123" className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2" />
        </div>

        <button type="submit" className="w-full bg-raspberry text-white p-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2">
          <ArrowUpRight size={18} /> Despachar a Guarda
        </button>
      </form>

      <div className="bg-white dark:bg-white/5 p-6 rounded-[2rem] shadow-sm">
        <h3 className="text-sm font-black text-chocolate dark:text-cream uppercase tracking-widest mb-4">Historial de Despachos</h3>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-white/5">
              <th className="p-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">N° Guía</th>
              <th className="p-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">Fecha</th>
              <th className="p-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">Producto</th>
              <th className="p-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">Lote</th>
              <th className="p-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">Destino</th>
              <th className="p-3 text-[9px] font-black uppercase text-slate-400 tracking-widest text-right">Cant.</th>
              <th className="p-3 text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Acc.</th>
            </tr>
          </thead>
          <tbody>
            {dispatchHistory.length === 0 && (
              <tr><td colSpan={7} className="p-4 text-center text-xs font-bold text-slate-300">No hay despachos registrados.</td></tr>
            )}
            {dispatchHistory.map((h) => (
              <tr key={h.id} className="border-t border-slate-100 dark:border-white/5">
                <td className="p-3 text-xs font-bold text-chocolate dark:text-cream">G-{String(h.id).padStart(5, '0')}</td>
                <td className="p-3 text-xs font-bold text-slate-400">{new Date(h.date).toLocaleDateString()}</td>
                <td className="p-3 text-xs font-bold text-chocolate dark:text-cream">{h.pt_name}</td>
                <td className="p-3 text-xs font-bold text-slate-400">{h.pt_lote}</td>
                <td className="p-3 text-xs font-bold text-slate-400">{h.destination || 'GUARDA'}</td>
                <td className="p-3 text-xs font-black text-raspberry text-right">-{h.quantity} {h.unit}</td>
                <td className="p-3 text-center">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => generateDispatchPDF({
                        id: h.id,
                        pt_name: h.pt_name,
                        pt_lote: h.pt_lote,
                        quantity: h.quantity,
                        unit: h.unit,
                        destination: h.destination,
                        packaging: h.unit === 'Cajas' ? 'Cajas de Potes (24 un)' : 'Cajas de Granel',
                        movement_code: h.movement_code,
                        reception_code: h.reception_code,
                        operators_count: h.operators_count,
                        tarja: h.tarja,
              mp_dispatch_code: h.mp_dispatch_code,
              production_date_override: h.production_date_override
                      })}
                      className="p-2 text-slate-300 dark:text-white/10 hover:text-chocolate dark:hover:text-cream hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                      title="Reimprimir Guía PDF"
                    >
                      <FileText size={16} />
                    </button>
                    <button
                      onClick={() => deleteDispatch(h.id)}
                      className="p-2 text-slate-300 dark:text-white/10 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                      title="Anular Despacho"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
