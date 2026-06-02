import React, { useState } from 'react';
import { 
  Package, CheckCircle2, RotateCw, 
  Coins, Grape, Cookie, AlertTriangle, ChevronDown, ChevronUp, Layers, TrendingUp,
  AlertCircle, Box, Info, Download
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const cn = (...classes) => classes.filter(Boolean).join(' ');

export default function Dashboard({ materials = [], stock = [], ptStock = [], ptBatches = [], productionHistory = [], fetchData, showToast }) {
  const [expandedMaterials, setExpandedMaterials] = useState({});
  const [expandedPTs, setExpandedPTs] = useState({});
  const [isExporting, setIsExporting] = useState(false);

  // RECETA MAESTRA (F:430, B:290, C:280)
  const RECIPE = {
    BLANCO_FACTOR: 0.29,
    COBERTURA_FACTOR: 0.28,
    FRAMBUESA_FACTOR: 0.43
  };

  // Eficiencia / Merma
  const totalCrumbleWaste = Array.isArray(productionHistory) 
    ? productionHistory.reduce((acc, curr) => acc + (curr.crumble_waste || 0), 0) 
    : 0;

  // Cálculo de Eficiencia basado en Receta Óptima
  const dailyEfficiency = Array.isArray(productionHistory) ? productionHistory.reduce((acc, prod) => {
    const dateKey = new Date(prod.date).toISOString().split('T')[0];
    if (!acc[dateKey]) {
      acc[dateKey] = { 
        dateKey, 
        ptReal: 0,
        blancoReal: 0,
        coberturaReal: 0,
        frambuesaReal: 0,
        coberturaNames: new Set()
      };
    }
    
    // Sumar consumos reales de la jornada
    if (prod.ingredients) {
      prod.ingredients.forEach(ing => {
        const name = (ing.material_name || "").toLowerCase();
        if (name.includes('blanco')) {
          acc[dateKey].blancoReal += (ing.quantity || 0);
        } else if (name.includes('leche') || name.includes('amargo') || name.includes('rub')) {
          acc[dateKey].coberturaReal += (ing.quantity || 0);
          acc[dateKey].coberturaNames.add(ing.material_name);
        }
      });
    }

    // Restar lo que sobró en los estanques al final
    acc[dateKey].blancoReal -= (prod.est1_final_est || 0);
    acc[dateKey].coberturaReal -= (prod.est2_final_est || 0);
    
    acc[dateKey].ptReal += (prod.pt_quantity || 0);
    acc[dateKey].frambuesaReal += (prod.kg_frambuesa_total || 0);
    
    return acc;
  }, {}) : {};

  const efficiencyList = Object.values(dailyEfficiency)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .map(eff => {
      // Cálculo de Desviación respecto a la Receta Óptima
      const blancoTeorico = eff.ptReal * RECIPE.BLANCO_FACTOR;
      const coberturaTeorica = eff.ptReal * RECIPE.COBERTURA_FACTOR;
      
      const rendBlanco = eff.blancoReal > 0 ? (blancoTeorico / eff.blancoReal) : 1;
      const rendCobertura = eff.coberturaReal > 0 ? (coberturaTeorica / eff.coberturaReal) : 1;
      
      const rendGlobal = (rendBlanco + rendCobertura) / 2;

      return { 
        ...eff, 
        rendBlanco: parseFloat((rendBlanco * 100).toFixed(1)), 
        rendCobertura: parseFloat((rendCobertura * 100).toFixed(1)), 
        rendGlobal: parseFloat((rendGlobal * 100).toFixed(1)),
        coberturaDisplay: Array.from(eff.coberturaNames).join(', ') || 'Cobertura'
      };
    });

  const efficiencyDisplayList = [...efficiencyList].sort((a, b) => b.dateKey.localeCompare(a.dateKey)).slice(0, 5);
  
  const getMaterialIcon = (name = "") => {
    const n = String(name).toLowerCase();
    if (n.includes('chocolate') || n.includes('cacao') || n.includes('choc.')) return <Coins />;
    if (n.includes('frambuesa') || n.includes('berry') || n.includes('crumble')) return <Grape />;
    return <Package />;
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

  const exportToPDF = () => {
    setIsExporting(true);
    showToast('Generando reporte PDF profesional...', 'info');

    try {
      const doc = new jsPDF();
      const dateStr = new Date().toLocaleString();

      // HEADER PROFESIONAL
      doc.setFillColor(61, 37, 20); // Chocolate
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('BOMBONES NOC', 15, 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('REPORTE INTEGRAL DE INVENTARIO Y PRODUCCIÓN', 15, 28);
      doc.text(`Fecha de Emisión: ${dateStr}`, 140, 20);

      let currentY = 50;

      // SECCIÓN 1: PRODUCTO TERMINADO
      doc.setTextColor(61, 37, 20);
      doc.setFontSize(14);
      doc.text('1. INVENTARIO DE PRODUCTO TERMINADO', 15, currentY);
      currentY += 10;

      const ptRows = [];
      ptStock.filter(p => p.pt_name !== 'Merma Crumble').forEach(p => {
        ptRows.push([
          { content: p.pt_name, styles: { fontStyle: 'bold', fillColor: [248, 245, 240] } },
          { content: 'TOTAL', styles: { fontStyle: 'bold', fillColor: [248, 245, 240] } },
          { content: `${p.total_quantity} ${p.unit}`, styles: { fontStyle: 'bold', fillColor: [248, 245, 240], halign: 'right' } }
        ]);

        const currentBatches = ptBatches.filter(b => b.pt_name === p.pt_name && b.total_quantity > 0);
        currentBatches.forEach(b => {
          ptRows.push([
            `   - Lote: ${b.pt_lote}`,
            '',
            `${b.total_quantity} ${p.unit}`
          ]);
        });
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Producto / Detalle Lote', '', 'Cantidad']],
        body: ptRows,
        theme: 'striped',
        headStyles: { fillColor: [230, 57, 70], textColor: [255, 255, 255] },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 2: { halign: 'right' } }
      });

      currentY = doc.lastAutoTable.finalY + 15;

      // SECCIÓN 2: MATERIAS PRIMAS
      doc.setTextColor(61, 37, 20);
      doc.setFontSize(14);
      doc.text('2. BODEGA DE INSUMOS (MATERIAS PRIMAS)', 15, currentY);
      currentY += 10;

      const materialRows = [];
      
      // Agregar Merma Crumble al inicio de Insumos
      const mermaCrumblePT = ptStock.find(p => p.pt_name === 'Merma Crumble');
      if (mermaCrumblePT) {
        materialRows.push([
          { content: 'MERMA CRUMBLE (DE PRODUCCIÓN)', styles: { fontStyle: 'bold', fillColor: [255, 241, 242] } },
          { content: 'TOTAL', styles: { fontStyle: 'bold', fillColor: [255, 241, 242] } },
          { content: `${mermaCrumblePT.total_quantity} KG`, styles: { fontStyle: 'bold', fillColor: [255, 241, 242], halign: 'right' } }
        ]);
        
        const mermaBatches = ptBatches.filter(b => b.pt_name === 'Merma Crumble' && b.total_quantity > 0);
        mermaBatches.forEach(b => {
          materialRows.push([
            `   - Lote: ${b.pt_lote}`,
            '',
            `${b.total_quantity} KG`
          ]);
        });
      }

      materials.forEach(m => {
        const materialStock = stock.filter(s => s.material_id === m.id);
        const total = materialStock.reduce((a, c) => a + (Number(c.quantity) || 0), 0);
        const isLow = total <= m.min_stock;

        materialRows.push([
          { content: `${m.name}${isLow ? ' (BAJO STOCK)' : ''}`, styles: { fontStyle: 'bold', fillColor: [248, 245, 240] } },
          { content: 'TOTAL', styles: { fontStyle: 'bold', fillColor: [248, 245, 240] } },
          { content: `${total.toFixed(1)} ${m.unit}`, styles: { fontStyle: 'bold', fillColor: [248, 245, 240], halign: 'right' } }
        ]);

        materialStock.filter(s => s.batch_id !== null).forEach(s => {
          materialRows.push([
            `   - Lote: ${s.lote}`,
            `Vence: ${s.expiry_date || 'N/A'}`,
            `${Number(s.quantity).toFixed(1)} ${m.unit}`
          ]);
        });
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Insumo / Lote', 'Información', 'Cantidad']],
        body: materialRows,
        theme: 'grid',
        headStyles: { fillColor: [61, 37, 20], textColor: [255, 255, 255] },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 2: { halign: 'right' } }
      });

      currentY = doc.lastAutoTable.finalY + 15;

      // SECCIÓN 3: RENDIMIENTO Y EFICIENCIA
      doc.setTextColor(61, 37, 20);
      doc.setFontSize(14);
      doc.text('3. INDICADORES DE CUMPLIMIENTO DE RECETA (%)', 15, currentY);
      currentY += 10;

      const efficiencyRows = efficiencyDisplayList.map(eff => [
        eff.dateKey,
        eff.rendBlanco.toFixed(1) + '%',
        eff.rendCobertura.toFixed(1) + '%',
        eff.rendGlobal.toFixed(1) + '%'
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Jornada', 'Cumpl. Blanco', 'Cumpl. Cobertura', 'Eficiencia Global']],
        body: efficiencyRows,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
        styles: { fontSize: 9, cellPadding: 3 }
      });

      // Pie de página
      const pageCount = doc.internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Bombones NOC - Sistema de Gestión de Inventario - Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
      }

      doc.save(`Reporte_Inventario_NOC_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast('Reporte exportado con éxito');
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      showToast('Error al generar PDF', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const mermaInStock = ptStock.find(p => p.pt_name === 'Merma Crumble')?.total_quantity || 0;

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-[2rem] border border-chocolate/5 shadow-sm gap-4">
        <div>
          <h2 className="text-3xl font-black text-chocolate tracking-tight uppercase">Panel de <span className="text-raspberry">Control</span></h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestión integral de producción y stock</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="group relative">
            <button onClick={exportToPDF} disabled={isExporting} className="p-3.5 bg-raspberry text-white rounded-2xl shadow-xl shadow-raspberry/10 hover:scale-110 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50">
              {isExporting ? <RotateCw size={20} className="animate-spin" /> : <Download size={20} />}
            </button>
          </div>
          <div className="group relative">
            <button onClick={fetchData} className="p-3.5 bg-chocolate text-white rounded-2xl shadow-xl shadow-chocolate/10 hover:scale-110 active:scale-95 transition-all flex items-center justify-center">
              <RotateCw size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* SECCIÓN 1: RENDIMIENTO DE INSUMOS */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-4">
          <div className="p-2 bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-500/20">
            <TrendingUp size={20} />
          </div>
          <h3 className="text-xl font-black text-chocolate uppercase tracking-tight">Rendimiento de Materias Primas</h3>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white p-6 rounded-[2.5rem] border border-chocolate/5 shadow-sm min-h-[400px]">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Consumo Real vs Receta (El 100% es el uso ideal de chocolate)</p>
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={efficiencyList}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="dateKey" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} dy={10} />
                <YAxis fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} domain={[0, 120]} />
                <Tooltip 
                  formatter={(value) => `${value}%`}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} 
                />
                <Legend iconType="circle" verticalAlign="top" height={36}/>
                <Line type="monotone" dataKey="rendGlobal" stroke="#3d2514" strokeWidth={4} dot={{ r: 4, fill: '#3d2514', strokeWidth: 2, stroke: '#fff' }} name="Rendimiento Total" />
                <Line type="monotone" dataKey="rendBlanco" stroke="#e63946" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Chocolate Blanco" />
                <Line type="monotone" dataKey="rendCobertura" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Chocolate Cobertura" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-chocolate/5 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50/50 border-b border-chocolate/5">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumen últimas jornadas</p>
            </div>
            <div className="flex-1 overflow-auto">
              <div className="overflow-x-auto w-full"><table className="w-full text-left border-collapse min-w-[350px]">
                <tbody className="divide-y divide-slate-50">
                  {efficiencyDisplayList.map((eff) => (
                    <tr key={eff.dateKey} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <p className="text-[10px] font-black text-chocolate uppercase">{eff.dateKey}</p>
                        <div className="flex flex-col gap-0.5 mt-1">
                          <span className="text-[8px] font-bold text-raspberry uppercase tracking-tighter">Blanco: {eff.rendBlanco}%</span>
                          <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-tighter">{eff.coberturaDisplay}: {eff.rendCobertura}%</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-sm",
                            eff.rendGlobal >= 95 ? "bg-emerald-500 text-white" : "bg-chocolate text-white"
                          )}>
                            {eff.rendGlobal}%
                          </span>
                          <span className="text-[7px] font-bold text-slate-300 mt-1 uppercase">Promedio</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 2: PRODUCTO TERMINADO */}
      <section className="space-y-6 pt-6 border-t border-chocolate/5">
        <div className="flex items-center gap-3 px-4">
          <div className="p-2 bg-raspberry text-white rounded-lg shadow-lg shadow-raspberry/20">
            <Cookie size={20} />
          </div>
          <h3 className="text-xl font-black text-chocolate uppercase tracking-tight">Producto Terminado en Bodega</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {ptStock.filter(p => p.pt_name !== 'Merma Crumble').map(p => {
            const currentBatches = ptBatches.filter(b => b.pt_name === p.pt_name && b.total_quantity > 0);
            return (
              <div key={p.pt_name} className="bg-white p-6 rounded-[2.5rem] border border-chocolate/5 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                <div className="absolute -right-4 -top-4 opacity-5 text-chocolate group-hover:scale-110 transition-transform">
                  <Layers size={80} />
                </div>
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-chocolate/5 text-chocolate rounded-2xl group-hover:bg-chocolate group-hover:text-white transition-colors">
                    <Layers size={24} />
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black text-chocolate tracking-tighter">{p.total_quantity}</p>
                    <p className="text-[10px] font-black text-chocolate/30 uppercase tracking-widest">{p.unit}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-black text-chocolate uppercase leading-tight truncate pr-4">{p.pt_name}</h4>
                  <button onClick={() => setExpandedPTs(prev => ({ ...prev, [p.pt_name]: !prev[p.pt_name] }))} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 transition-all">
                    {expandedPTs[p.pt_name] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
                {expandedPTs[p.pt_name] && (
                  <div className="space-y-2 mt-4 pt-4 border-t border-chocolate/5 animate-in slide-in-from-top-1">
                    <div className="max-h-48 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-chocolate/10">
                      {currentBatches.map(b => {
                        // Fallback: buscar fecha en historial si el servidor no se ha reiniciado
                        const batchDate = b.date || productionHistory.find(ph => ph.pt_lote === b.pt_lote)?.date;
                        return (
                          <div key={b.pt_lote} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl border border-slate-100/50">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Lote {b.pt_lote}</span>
                              <span className="text-[8px] font-black text-slate-300 uppercase">
                                Fecha de Producción: {batchDate ? new Date(batchDate).toLocaleDateString() : 'N/A'}
                              </span>                            </div>
                            <span className="text-xs font-black text-chocolate">{b.total_quantity}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* SECCIÓN 3: BODEGA DE INSUMOS */}
      <section className="space-y-6 pt-6 border-t border-chocolate/5">
        <div className="flex items-center gap-3 px-4">
          <div className="p-2 bg-chocolate text-white rounded-lg shadow-lg shadow-chocolate/20">
            <Coins size={20} />
          </div>
          <h3 className="text-xl font-black text-chocolate uppercase tracking-tight">Bodega de Insumos</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* MERMA CRUMBLE */}
          <div className="p-6 rounded-[2.5rem] border border-raspberry/20 bg-raspberry/[0.02] shadow-sm relative overflow-hidden group">
            <div className="absolute -right-2 -top-2 opacity-5 text-raspberry group-hover:scale-110 transition-transform"><AlertTriangle size={60} /></div>
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-raspberry text-white rounded-2xl"><AlertTriangle size={20} /></div>
              <div className="flex-1 overflow-hidden">
                <h4 className="text-[11px] font-black text-chocolate uppercase leading-tight truncate">Merma Crumble</h4>
                <p className="text-[9px] font-bold uppercase text-raspberry">Pérdida Acumulada</p>
              </div>
            </div>
            <div className="flex justify-between items-end">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tighter text-raspberry">{totalCrumbleWaste.toFixed(1)}</span>
                <span className="text-[10px] font-bold text-slate-300 uppercase">KG</span>
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
              <div key={m.id} className={cn("p-6 rounded-[2.5rem] border transition-all duration-300 relative overflow-hidden", isLow ? "bg-raspberry/[0.02] border-raspberry/20 animate-pulse" : "bg-white border-chocolate/5 shadow-sm")}>
                {isLow && <div className="absolute top-4 right-4 animate-bounce"><AlertCircle size={18} className="text-raspberry" /></div>}
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-4 mb-4">
                    <div className={cn("p-3 rounded-2xl", isLow ? "bg-raspberry text-white" : "bg-chocolate/5 text-chocolate")}>{getMaterialIcon(m.name)}</div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="text-[11px] font-black text-chocolate uppercase leading-tight truncate">{m.name}</h4>
                    </div>
                  </div>
                  <div className="mt-auto flex justify-between items-end">
                    <div className="flex items-baseline gap-2">
                      <span className={cn("text-3xl font-black tracking-tighter", isLow ? "text-raspberry" : "text-chocolate")}>{total.toFixed(1)}</span>
                      <span className="text-[10px] font-bold text-slate-300 uppercase">{m.unit}</span>
                    </div>
                    <button onClick={() => setExpandedMaterials(prev => ({ ...prev, [m.id]: !prev[m.id] }))} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-400 transition-all">
                      {expandedMaterials[m.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                  {expandedMaterials[m.id] && (
                    <div className="mt-6 pt-4 border-t border-chocolate/5 space-y-3 animate-in slide-in-from-top-1">
                      <div className="max-h-56 overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-chocolate/10">
                        {actualBatches.map(s => {
                          const alert = getExpiryAlert(s.expiry_date);
                          return (
                            <div key={s.batch_id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl text-[10px] border border-transparent hover:border-chocolate/10 transition-colors">
                              <div><p className="font-black text-chocolate uppercase">Lote {s.lote}</p><p className="text-[8px] text-slate-400 font-bold uppercase">Vence: {s.expiry_date || 'N/A'}</p></div>
                              <div className="text-right"><p className="font-black text-chocolate">{Number(s.quantity).toFixed(1)}</p>{alert && <span className={cn("text-[7px] font-black px-1.5 py-0.5 rounded mt-1 inline-block uppercase", alert.color)}>{alert.label}</span>}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
