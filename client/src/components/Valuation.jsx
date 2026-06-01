import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Coins, TrendingUp, Download, PieChart, BarChart3, ArrowUpRight } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

export default function Valuation({ materials, stock, showToast }) {
  const [valuationData, setValuationData] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadValuation = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/business/valuation`);
      setValuationData(Number(data.total_valuation) || 0);
    } catch (e) {
      console.error("Error loading valuation", e);
      showToast('Error al cargar valorización', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadValuation();
  }, []);

  // Calcular valorización por categoría
  const categoryValuation = materials.reduce((acc, mat) => {
    const matStock = stock.filter(s => s.material_id === mat.id);
    const totalQty = matStock.reduce((sum, s) => sum + (s.quantity || 0), 0);
    const avgCost = matStock.length > 0 ? matStock[0].cost_per_unit || 0 : 0;
    const value = totalQty * avgCost;
    
    const cat = mat.category || 'OTRO';
    acc[cat] = (acc[cat] || 0) + value;
    return acc;
  }, {});

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h2 className="text-3xl font-black text-chocolate uppercase tracking-tighter">Valorización de <span className="text-raspberry">Negocio</span></h2>
        <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.3em] mt-1 ml-1">Análisis financiero del inventario actual</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Card */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-chocolate/5 shadow-xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 text-emerald-600 group-hover:scale-110 transition-transform duration-700">
            <Coins size={120} />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
              <Coins size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Total de Bodega</p>
              <p className="text-4xl font-black text-chocolate tracking-tighter mt-1">
                ${valuationData.toLocaleString('es-CL')}
              </p>
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black uppercase">
                <ArrowUpRight size={10} /> Activo Circulante
              </span>
            </div>
          </div>
        </div>

        {/* Categories Analysis */}
        <div className="md:col-span-2 bg-white p-8 rounded-[2.5rem] border border-chocolate/5 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-black text-chocolate uppercase flex items-center gap-2">
              <PieChart size={18} className="text-raspberry" /> Desglose por Categoría
            </h3>
            <button onClick={loadValuation} className="text-[9px] font-black uppercase text-slate-300 hover:text-raspberry transition-colors">Actualizar</button>
          </div>
          
          <div className="space-y-4">
            {Object.entries(categoryValuation).map(([cat, val]) => {
              const percentage = valuationData > 0 ? (val / valuationData) * 100 : 0;
              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-tight">
                    <span className="text-slate-400">{cat}</span>
                    <span className="text-chocolate">${val.toLocaleString('es-CL')} ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
                    <div 
                      className="h-full bg-chocolate transition-all duration-1000" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* detailed Table */}
      <section className="bg-white rounded-[2.5rem] border border-chocolate/5 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
          <h3 className="text-sm font-black text-chocolate uppercase flex items-center gap-2">
            <BarChart3 size={18} className="text-chocolate/40" /> Detalle de Activos por Insumo
          </h3>
          <button className="p-2 bg-chocolate text-white rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all">
            <Download size={16} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Insumo</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Categoría</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest text-right">Stock Actual</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest text-right">Costo Promedio</th>
                <th className="p-4 text-[9px] font-black uppercase text-slate-400 tracking-widest text-right">Valorizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {materials.map(mat => {
                const matStock = stock.filter(s => s.material_id === mat.id);
                const totalQty = matStock.reduce((sum, s) => sum + (s.quantity || 0), 0);
                const avgCost = matStock.length > 0 ? matStock[0].cost_per_unit || 0 : 0;
                const value = totalQty * avgCost;

                if (totalQty === 0) return null;

                return (
                  <tr key={mat.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="p-4 text-xs font-black text-chocolate uppercase">{mat.name}</td>
                    <td className="p-4 text-[10px] font-bold text-slate-400 uppercase">{mat.category || 'OTRO'}</td>
                    <td className="p-4 text-right text-xs font-bold text-slate-500">{totalQty} {mat.unit}</td>
                    <td className="p-4 text-right text-xs font-bold text-slate-500">${avgCost.toLocaleString('es-CL')}</td>
                    <td className="p-4 text-right text-xs font-black text-chocolate">${value.toLocaleString('es-CL')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
