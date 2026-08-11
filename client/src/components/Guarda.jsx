import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowUpRight, ClipboardList, Trash2, Info, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function Guarda({ fetchData, showToast }) {
  const [ptBatches, setPtBatches] = useState([]);
  const [ptHistory, setPtHistory] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);

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
      tarja: form.tarja?.value || null
    };
    try {
      const response = await axios.post(`${API_URL}/pt_dispatch`, data);
      const dispatchId = response.data.id;
      generateDispatchPDF({ ...data, id: dispatchId });
      form.reset();
      setSelectedProduct('');
      setSelectedBatch(null);
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

  const generateDispatchPDF = (data) => {
    try {
      const doc = new jsPDF();
      const dateStr = new Date().toLocaleString();
      const guideNumber = `G-${String(data.id || '---').padStart(5, '0')}`;
      doc.setFillColor(61, 37, 20);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('BOMBONES NOC', 15, 20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('GUÍA DE DESPACHO INTERNO - GUARDA', 15, 28);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`N° GUÍA: ${guideNumber}`, 140, 20);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Fecha: ${dateStr}`, 140, 28);
      let currentY = 55;
      autoTable(doc, {
        startY: currentY,
        head: [['Concepto', 'Detalle']],
        body: [
          ['Producto', data.pt_name],
          ['Lote de Producción', data.pt_lote],
          ['Cantidad Despachada', `${data.quantity} ${data.unit}`],
          ['Formato de Empaque', data.packaging],
          ['Bodega Destino', data.destination],
          ['Código de Guía Externa', data.movement_code || 'N/A'],
          ['Estado', 'DESPACHADO'],
          ['Código de Recepción', data.reception_code || 'N/A'],
          ['N° Operarios', data.operators_count || 'N/A'],
          ['Tarja', data.tarja || 'N/A']
        ],
        theme: 'grid',
        headStyles: { fillColor: [230, 57, 70], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 11, cellPadding: 8 },
        columnStyles: { 0: { fontStyle: 'bold', width: 60 } }
      });
      currentY = doc.lastAutoTable.finalY + 40;
      doc.setDrawColor(61, 37, 20);
      doc.setLineWidth(0.5);
      doc.line(30, currentY, 90, currentY);
      doc.setFontSize(9);
      doc.setTextColor(61, 37, 20);
      doc.text('Firma Despacha', 60, currentY + 5, { align: 'center' });
      doc.text('Responsable Producción', 60, currentY + 10, { align: 'center' });
      doc.line(120, currentY, 180, currentY);
      doc.text('Firma Recibe', 150, currentY + 5, { align: 'center' });
      doc.text('Responsable Bodega', 150, currentY + 10, { align: 'center' });
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Guía de Control Interno N° ${guideNumber} - Documento no válido para traslado externo.`, 105, 285, { align: 'center' });
      doc.save(`Guia_Despacho_${guideNumber}_${data.pt_lote}.pdf`);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      showToast('Error al generar PDF de despacho', 'error');
    }
  };

  const dispatchHistory = ptHistory.filter(h => h.type === 'OUT');

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h2 className="text-3xl font-black text-chocolate dark:text-cream uppercase tracking-tighter">Despacho a <span className="text-raspberry">Guarda</span></h2>
        <p className="text-slate-400 dark:text-white/40 font-bold uppercase text-[9px] tracking-[0.3em] mt-1 ml-1">Salida de producto terminado a bodega externa.</p>
      </header>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1">
          <form onSubmit={handleDispatch} className="bg-white dark:bg-[#231512] p-6 rounded-[2rem] shadow-xl border border-chocolate/5 dark:border-white/5 space-y-4 sticky top-8 transition-colors duration-500">
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 dark:text-white/40 uppercase tracking-widest ml-2">Producto</label>
                <select
                  className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2 focus:ring-chocolate/20 transition-colors"
                  value={selectedProduct}
                  onChange={(e) => {
                    setSelectedProduct(e.target.value);
                    setSelectedBatch(null);
                  }}
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
                  <label className="text-[9px] font-black text-slate-400 dark:text-white/40 uppercase tracking-widest ml-2">Lote Disponible</label>
                  <select
                    className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2 focus:ring-chocolate/20 transition-colors"
                    onChange={(e) => setSelectedBatch(ptBatches.find(b => b.pt_lote === e.target.value && b.pt_name === selectedProduct))}
                    required
                  >
                    <option value="">Seleccionar Lote...</option>
                    {ptBatches.filter(b => b.pt_name === selectedProduct).map((b, idx) => (
                      <option key={idx} value={b.pt_lote}>
                        {b.pt_lote} ({b.total_quantity} {b.unit})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {selectedBatch && (
                <div className="p-3 bg-chocolate/5 dark:bg-white/5 rounded-xl border border-chocolate/10 dark:border-white/10 flex items-center gap-3">
                  <Info className="text-chocolate dark:text-cream/60" size={16} />
                  <div>
                    <p className="text-[8px] font-black uppercase text-chocolate/40 dark:text-white/30 tracking-widest">Formato</p>
                    <p className="text-xs font-black text-chocolate dark:text-cream">
                      {selectedBatch.unit === 'Cajas' ? 'Cajas de Potes (24 un)' : 'Cajas de Granel'}
                    </p>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 dark:text-white/40 uppercase tracking-widest ml-2">Cantidad a Despachar</label>
                <div className="flex gap-2">
                  <input
                    name="quantity"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="flex-1 p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2 focus:ring-chocolate/20 transition-colors"
                    required
                  />
                  <div className="w-16 flex items-center justify-center bg-slate-100 dark:bg-white/5 rounded-xl font-black text-slate-400 dark:text-white/20 text-[10px] uppercase">
                    {selectedBatch?.unit || '---'}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 dark:text-white/40 uppercase tracking-widest ml-2">Bodega Destino</label>
                <input
                  name="destination"
                  placeholder="Ej: Bodega Central"
                  className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2 focus:ring-chocolate/20 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 dark:text-white/40 uppercase tracking-widest ml-2">Código de Guía (Bodega Externa)</label>
              <input
                name="movement_code"
                placeholder="Ej: GUIA-00123"
                className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 dark:text-white/40 uppercase tracking-widest ml-2">Código de Recepción</label>
              <input
                name="reception_code"
                placeholder="Ej: REC-00123"
                className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 dark:text-white/40 uppercase tracking-widest ml-2">N° de Operarios</label>
              <input
                name="operators_count"
                type="number"
                placeholder="Ej: 2"
                className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 dark:text-white/40 uppercase tracking-widest ml-2">Tarja</label>
              <input
                name="tarja"
                placeholder="Ej: T-00123"
                className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-xs focus:ring-2"
              />
            </div>
            <button
              type="submit"
              disabled={!selectedBatch}
              className="w-full bg-raspberry text-white p-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl shadow-raspberry/20 hover:scale-[1.01] disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center gap-2"
            >
              <ArrowUpRight size={18} /> DESPACHAR A GUARDA
            </button>
          </form>
        </div>

        <div className="xl:col-span-2 space-y-4">
          <h3 className="text-lg font-black text-chocolate dark:text-cream flex items-center gap-2">
            <ClipboardList size={18} className="text-raspberry" /> Historial de Despachos
          </h3>
          <div className="bg-white dark:bg-[#231512] rounded-[2rem] shadow-xl border border-chocolate/5 dark:border-white/5 overflow-hidden transition-colors duration-500">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-white/5">
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest">N° Guía</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest">Fecha</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest">Producto</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest">Lote</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest text-center">Destino</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest text-right">Cant.</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest text-center">Acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                {dispatchHistory.length === 0 && (
                  <tr><td colSpan="7" className="p-8 text-center text-slate-400 dark:text-white/20 font-bold italic text-xs">No hay despachos registrados.</td></tr>
                )}
                {dispatchHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                    <td className="p-4">
                      <span className="text-[10px] font-black text-raspberry bg-raspberry/5 dark:bg-raspberry/10 px-2 py-1 rounded-md">
                        G-{String(h.id).padStart(5, '0')}
                      </span>
                    </td>
                    <td className="p-4 text-[10px] font-bold text-slate-400 dark:text-white/30">{new Date(h.date).toLocaleDateString()}</td>
                    <td className="p-4 text-xs font-black text-chocolate dark:text-cream/90 uppercase">{h.pt_name}</td>
                    <td className="p-4 text-[10px] font-bold text-slate-500 dark:text-white/40">{h.pt_lote}</td>
                    <td className="p-4 text-center">
                      <span className="bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase">
                        {h.destination || 'GUARDA'}
                      </span>
                    </td>
                    <td className="p-4 text-right font-black text-orange-600 dark:text-orange-400 text-xs">
                      -{h.quantity} <span className="text-[9px] opacity-50">{h.unit}</span>
                    </td>
                    <td className="p-4 text-center flex items-center justify-center gap-2">
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
                          tarja: h.tarja
                        })}
                        className="p-2 text-slate-300 dark:text-white/10 hover:text-chocolate dark:hover:text-cream hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                        title="Reimprimir Guía PDF"
                      >
                        <FileText size={14}/>
                      </button>
                      <button onClick={() => deleteDispatch(h.id)} className="p-2 text-slate-300 dark:text-white/10 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all">
                        <Trash2 size={14}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
