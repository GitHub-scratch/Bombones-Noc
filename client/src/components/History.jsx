import React, { useState } from 'react';
import axios from 'axios';
import { History as HistoryIcon, Edit3, Trash2, Save, X, Zap, ChevronDown, ChevronUp, PackageOpen, Printer, Loader2, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoFrunar from '../Frunar.jpeg';
import firmaOmar from '../Firma Omar.png';

const API_URL = 'http://localhost:3001/api';

export default function History({ movements, productionHistory, fetchData, showToast }) {
  const [editingMovement, setEditingMovement] = useState(null);
  const [expandedProd, setExpandedProd] = useState(null);
  
  // Estados para Impresión
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printConfig, setPrintConfig] = useState({
    pt_name: '',
    pt_lote: '',
    quantity: 1,
    date: '',
    zpl: '',
    loadingPreview: false
  });

  const generateProductionReport = (prod) => {
    try {
      const doc = new jsPDF();
      const dateStr = new Date(prod.date).toLocaleDateString();

      // --- ENCABEZADO ---
      doc.setDrawColor(0);
      doc.setLineWidth(0.1);
      doc.rect(10, 10, 190, 25); // Recuadro principal encabezado

      // Logo Frunar
      doc.addImage(logoFrunar, 'JPEG', 12, 12, 45, 21);

      // Título Central
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('PRODUCCIÓN PRODUCTO TERMINADO', 105, 22, { align: 'center' });
      doc.text('Sistema De Gestión De Calidad', 105, 17, { align: 'center' });

      // Info Derecha
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Códigos.: R-BRCGS-6.1', 155, 17);
      doc.text('Fecha : 10-2025', 155, 22);
      doc.text('Versión: 02', 155, 27);

      let currentY = 40;

      // --- TABLA DE DATOS GENERALES ---
      autoTable(doc, {
        startY: currentY,
        body: [
          [
            { content: `Producto: ${prod.pt_name}`, colSpan: 2 },
            { content: `Fecha de Producción: ${dateStr}`, colSpan: 2 }
          ],
          [
            { content: `Lote: ${prod.pt_lote}`, colSpan: 1 },
            { content: `Cód. Desp. Interno MP. Frunar: `, colSpan: 1 },
            { content: `Código Recep PT. Frunar: `, colSpan: 2 }
          ],
          [
            { content: `Tarja: `, colSpan: 1 },
            { content: `Nombre del responsable de Calidad: Valeria Briones`, colSpan: 3 }
          ],
          [
            { content: `Operarios: `, colSpan: 2 },
            { content: `Hora Inicio: `, colSpan: 1 },
            { content: `Hora Termino: `, colSpan: 1 }
          ]
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0] },
        columnStyles: { 0: { width: 47.5 }, 1: { width: 47.5 }, 2: { width: 47.5 }, 3: { width: 47.5 } }
      });

      currentY = doc.lastAutoTable.finalY + 10;

      // --- TABLA DE INGREDIENTES ---
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumen del Producto Terminado', 105, currentY - 2, { align: 'center' });

      const ingredientRows = prod.ingredients.map(ing => [
        ing.material_name,
        ing.lote,
        ing.quantity,
        '', // Salida kg
        ''  // Mermas
      ]);

      // Añadir filas de Mermas y Procesos si existen
      if (prod.crumble_waste > 0) {
        ingredientRows.push(['Merma Crumble', prod.pt_lote, '', '', `${prod.crumble_waste} kg`]);
      }
      if (prod.kg_frambuesa_total > 0) {
        ingredientRows.push(['Frambuesa Utilizada', prod.pt_lote, `${prod.kg_frambuesa_total} kg`, '', '']);
      }

      // Filas de Totales
      const totalPotes = prod.pt_unit === 'Cajas' ? (parseFloat(prod.pt_quantity) * 24) : '';
      ingredientRows.push(['Total, potes', '', totalPotes, '', '']);
      ingredientRows.push(['Total, bolsas', '', '', '', '']);
      ingredientRows.push(['Total, cajas', '', prod.pt_quantity, '', '']);

      autoTable(doc, {
        startY: currentY,
        head: [['Materias Primas', 'Lote/Origen', 'Entrada a proceso kg', 'Salida de proceso kg', 'Mermas']],
        body: ingredientRows,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
        styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1 },
        columnStyles: { 
          0: { width: 50 }, 
          1: { width: 40 }, 
          2: { width: 35 }, 
          3: { width: 35 }, 
          4: { width: 30 } 
        }
      });

      currentY = doc.lastAutoTable.finalY + 10;

      // --- OBSERVACIONES ---
      doc.rect(10, currentY, 190, 25);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Observaciones:', 12, currentY + 5);

      currentY += 45;

      // --- FIRMA ---
      doc.addImage(firmaOmar, 'PNG', 82.5, currentY - 22, 45, 20); // Ajuste centrado y sobre la línea
      doc.line(75, currentY, 135, currentY);
      doc.setFontSize(9);
      doc.text('Firma Responsable', 105, currentY + 5, { align: 'center' });

      doc.save(`Reporte_Produccion_${prod.pt_lote}.pdf`);
      showToast('Reporte PDF generado');
    } catch (error) {
      console.error('Error al generar PDF:', error);
      showToast('Error al generar PDF', 'error');
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

  const deleteProduction = async (id) => {
    if (!window.confirm('¿Eliminar esta producción? El stock de materias primas se devolverá a los lotes originales y el stock de PT se eliminará.')) return;
    try {
      await axios.delete(`${API_URL}/production/${id}`);
      await fetchData();
      showToast('Producción eliminada y stock revertido');
    } catch (err) {
      showToast('Error al eliminar producción', 'error');
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

  // Abrir Modal de Impresión y cargar vista previa
  const openPrintModal = async (prod) => {
    setPrintConfig({
      ...printConfig,
      pt_name: prod.pt_name,
      pt_lote: prod.pt_lote,
      quantity: Math.ceil(prod.pt_quantity),
      date: prod.date,
      zpl: '',
      loadingPreview: true
    });
    setIsPrintModalOpen(true);

    try {
      const response = await axios.post(`${API_URL}/label-preview`, {
        pt_lote: prod.pt_lote,
        date: prod.date
      });
      setPrintConfig(prev => ({ ...prev, zpl: response.data.zpl, loadingPreview: false }));
    } catch (err) {
      showToast('Error al cargar vista previa', 'error');
      setPrintConfig(prev => ({ ...prev, loadingPreview: false }));
    }
  };

  const handleFinalPrint = async () => {
    try {
      showToast('Enviando a Zebra...', 'info');
      const response = await axios.post(`${API_URL}/print-labels`, {
        pt_lote: printConfig.pt_lote,
        pt_quantity: printConfig.quantity,
        custom_zpl: printConfig.zpl
      });
      showToast(response.data.message);
      setIsPrintModalOpen(false);
    } catch (err) {
      showToast(err.response?.data?.error || 'Error de impresión', 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h2 className="text-3xl font-black text-chocolate dark:text-cream uppercase tracking-tighter">Historial <span className="text-raspberry">General</span></h2>
        <p className="text-slate-400 dark:text-white/40 font-bold uppercase text-[9px] tracking-[0.3em] mt-1 ml-1">Registro detallado de todos los movimientos de Bombones Noc.</p>
      </header>

      {/* MODAL DE EDICIÓN DE MOVIMIENTO */}
      {editingMovement && (
        <div className="fixed inset-0 bg-chocolate/40 dark:bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 transition-colors">
          <form onSubmit={handleUpdate} className="bg-white dark:bg-[#3d1f16] p-6 rounded-[2rem] shadow-2xl w-full max-w-sm space-y-4 border border-white/5">
            <h3 className="text-xl font-black text-chocolate dark:text-cream flex items-center gap-2"><Edit3 size={20}/> Editar</h3>
            <div className="space-y-3">
              <input type="number" step="0.01" value={editingMovement.quantity} onChange={e => setEditingMovement({...editingMovement, quantity: parseFloat(e.target.value)})} className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-sm transition-colors" placeholder="Cantidad" required />
              <input value={editingMovement.lote} onChange={e => setEditingMovement({...editingMovement, lote: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-sm transition-colors" placeholder="Lote" required />
              <input value={editingMovement.description} onChange={e => setEditingMovement({...editingMovement, description: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-black/20 rounded-xl border-none font-bold text-chocolate dark:text-cream text-sm transition-colors" placeholder="Descripción" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-chocolate dark:bg-chocolate-light text-white p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"><Save size={16}/> Guardar</button>
              <button type="button" onClick={() => setEditingMovement(null)} className="flex-1 bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-white/40 p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"><X size={16}/> Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE IMPRESIÓN CON PREVIEW */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-chocolate/60 dark:bg-black/80 backdrop-blur-md z-[999] flex items-center justify-center p-4 transition-colors">
          <div className="bg-white dark:bg-[#231512] p-6 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto space-y-4 relative border border-white/5 transition-colors">
            <header className="flex justify-between items-center sticky top-0 bg-white dark:bg-[#231512] pb-3 z-10 border-b border-slate-50 dark:border-white/5 transition-colors">
              <div>
                <h3 className="text-xl font-black text-chocolate dark:text-cream leading-tight">Etiqueta Zebra</h3>
                <p className="text-slate-400 dark:text-white/40 font-bold uppercase text-[8px] tracking-widest">Lote: {printConfig.pt_lote}</p>
              </div>
              <button onClick={() => setIsPrintModalOpen(false)} className="p-2 bg-slate-100 dark:bg-white/5 rounded-full text-slate-300 dark:text-white/20 hover:text-raspberry transition-colors">
                <X size={18} />
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[8px] font-black uppercase text-slate-300 dark:text-white/20 tracking-widest block">Vista Previa</label>
                <div className="aspect-[4/3] bg-slate-50 dark:bg-black/20 rounded-2xl border-2 border-dashed border-slate-100 dark:border-white/10 flex items-center justify-center overflow-hidden p-4 relative shadow-inner">
                  {printConfig.loadingPreview ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="animate-spin text-chocolate/30 dark:text-white/20" size={24} />
                      <p className="text-[9px] font-bold text-slate-400 dark:text-white/40 uppercase">Cargando...</p>
                    </div>
                  ) : printConfig.zpl ? (
                    <img src={`https://api.labelary.com/v1/printers/8dpmm/labels/4x2.5/0/${encodeURIComponent(printConfig.zpl)}`} alt="Label Preview" className="max-w-full max-h-full object-contain drop-shadow-md rounded-md" />
                  ) : (
                    <p className="text-[9px] font-bold text-slate-300 dark:text-white/20 italic">Sin previa</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="bg-slate-50/50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                    <p className="text-base font-black text-chocolate dark:text-cream leading-tight mb-1">{printConfig.pt_name}</p>
                    <span className="inline-block px-2 py-0.5 bg-chocolate/10 dark:bg-white/10 rounded-md text-[8px] font-black text-chocolate dark:text-cream/60 uppercase">Lote: {printConfig.pt_lote}</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest block text-center">Cantidad</label>
                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => setPrintConfig(p => ({ ...p, quantity: Math.max(1, p.quantity - 1) }))} className="w-10 h-10 bg-slate-100 dark:bg-white/10 rounded-xl flex items-center justify-center text-xl font-black text-chocolate dark:text-cream shadow-sm">-</button>
                      <input type="number" value={printConfig.quantity} onChange={e => setPrintConfig(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} className="w-20 h-10 text-center text-xl font-black text-chocolate dark:text-cream bg-slate-50 dark:bg-black/20 rounded-xl border-none" />
                      <button onClick={() => setPrintConfig(p => ({ ...p, quantity: p.quantity + 1 }))} className="w-10 h-10 bg-slate-100 dark:bg-white/10 rounded-xl flex items-center justify-center text-xl font-black text-chocolate dark:text-cream shadow-sm">+</button>
                    </div>
                  </div>
                </div>
                <button onClick={handleFinalPrint} disabled={!printConfig.zpl || printConfig.loadingPreview} className="w-full bg-chocolate dark:bg-chocolate-light text-white py-4 rounded-xl font-black text-base shadow-lg flex items-center justify-center gap-2 hover:bg-chocolate/90 active:scale-95 transition-all disabled:opacity-30">
                  <Printer size={20} /> IMPRIMIR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HISTORIAL DE PRODUCCIONES */}
      <section className="space-y-4">
        <h3 className="text-lg font-black text-chocolate dark:text-cream flex items-center gap-2">
          <Zap size={18} className="text-raspberry" /> Historial de Producción
        </h3>
        <div className="bg-white dark:bg-[#231512] rounded-[2rem] shadow-xl border border-chocolate/5 dark:border-white/5 overflow-hidden transition-colors duration-500">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-white/5">
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest">Fecha</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest">Producto</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest">Lote</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest text-right">Cant.</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest text-center">Ingr.</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest text-center">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {productionHistory.length === 0 && (
                <tr><td colSpan="6" className="p-8 text-center text-slate-400 dark:text-white/20 font-bold italic text-xs">No hay producciones.</td></tr>
              )}
              {productionHistory.map((prod) => (
                <React.Fragment key={prod.id}>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                    <td className="p-4 text-[10px] font-bold text-slate-400 dark:text-white/30">{new Date(prod.date).toLocaleDateString()}</td>
                    <td className="p-4 text-xs font-black text-chocolate dark:text-cream/90 uppercase">{prod.pt_name}</td>
                    <td className="p-4 text-[10px] font-bold text-slate-500 dark:text-white/40 uppercase">{prod.pt_lote}</td>
                    <td className="p-4 text-right font-black text-chocolate dark:text-cream/80 text-xs">{prod.pt_quantity}</td>
                    <td className="p-4 text-center">
                      <button onClick={() => setExpandedProd(expandedProd === prod.id ? null : prod.id)} className="px-2 py-1 bg-slate-100 dark:bg-white/10 rounded-lg text-[8px] font-black uppercase text-slate-500 dark:text-white/40 hover:bg-chocolate dark:hover:bg-chocolate-light hover:text-white transition-all">Ver</button>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => generateProductionReport(prod)} title="Reporte PDF" className="p-2 text-slate-300 dark:text-white/10 hover:text-raspberry dark:hover:text-raspberry hover:bg-raspberry/5 rounded-lg transition-all"><FileText size={14}/></button>
                        <button onClick={() => openPrintModal(prod)} className="p-2 text-slate-300 dark:text-white/10 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"><Printer size={14}/></button>
                        <button onClick={() => deleteProduction(prod.id)} className="p-2 text-slate-300 dark:text-white/10 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                  {expandedProd === prod.id && (
                    <tr className="bg-slate-50/30 dark:bg-white/[0.02]">
                      <td colSpan="6" className="p-4">
                        <div className="bg-white dark:bg-black/20 rounded-xl p-4 border border-slate-100 dark:border-white/5 shadow-inner">
                          <h4 className="text-[8px] font-black uppercase text-slate-400 dark:text-white/30 tracking-[0.2em] mb-3 flex items-center gap-2">
                            <PackageOpen size={12}/> Insumos Consumidos
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {prod.ingredients?.map((ing, idx) => (
                              <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/5">
                                <div>
                                  <p className="text-[10px] font-black text-chocolate dark:text-cream/80 uppercase">{ing.material_name}</p>
                                  <p className="text-[8px] font-bold text-slate-400 dark:text-white/30 uppercase">Lote: {ing.lote}</p>
                                </div>
                                <p className="text-xs font-black text-raspberry">{ing.quantity} <span className="text-[8px] opacity-50 lowercase">{ing.unit}</span></p>
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

      {/* HISTORIAL DE MOVIMIENTOS MP */}
      <section className="space-y-4 pt-8 border-t border-slate-100 dark:border-white/5 transition-colors duration-500">
        <h3 className="text-lg font-black text-chocolate dark:text-cream flex items-center gap-2">
          <HistoryIcon size={18} className="text-chocolate dark:text-cream/60" /> Movimientos de Materia Prima
        </h3>
        <div className="bg-white dark:bg-[#231512] rounded-[2rem] shadow-xl border border-chocolate/5 dark:border-white/5 overflow-hidden transition-colors duration-500">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-white/5">
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest">Fecha</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest">Material</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest text-center">Tipo</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest text-right">Cant.</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest">Identificación</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 dark:text-white/40 tracking-widest text-center">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {movements.map((mov) => (
                <tr key={mov.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                  <td className="p-4 text-[10px] font-bold text-slate-400 dark:text-white/30 whitespace-nowrap">{new Date(mov.date).toLocaleString()}</td>
                  <td className="p-4 text-xs font-black text-chocolate dark:text-cream/90 uppercase">{mov.material_name}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                      mov.type === 'IN' ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-raspberry/10 dark:bg-raspberry/20 text-raspberry'
                    }`}>
                      {mov.type === 'IN' ? 'Entrada' : 'Salida'}
                    </span>
                  </td>
                  <td className="p-4 text-right font-black text-xs text-chocolate dark:text-cream/80">{mov.quantity} <span className="text-[9px] opacity-30">{mov.unit}</span></td>
                  <td className="p-4">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-white/40 uppercase">Lote: {mov.lote}</div>
                    <div className="text-[8px] text-slate-300 dark:text-white/20 font-black uppercase truncate max-w-[100px]">{mov.description}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      {mov.type !== 'PROD' ? (
                        <>
                          <button onClick={() => setEditingMovement(mov)} className="p-2 text-slate-200 dark:text-white/10 hover:text-chocolate dark:hover:text-cream hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"><Edit3 size={14}/></button>
                          <button onClick={() => handleDelete(mov.id)} className="p-2 text-slate-200 dark:text-white/10 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={14}/></button>
                        </>
                      ) : (
                        <span className="text-[7px] font-black text-slate-300 dark:text-white/20 uppercase tracking-tighter">Protegido</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
