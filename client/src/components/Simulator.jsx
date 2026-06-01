import React, { useState, useEffect } from 'react';
import { Calculator, Zap, Package, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function Simulator({ materials, stock, showToast, hideHeader = false }) {
  const [simulationType, setSimulationType] = useState('box'); // 'box' (Cajas) o 'kg' (Granel)
  const [coberturaType, setCoberturaType] = useState('amargo'); // 'leche', 'amargo' o 'rubi'
  const [targetQuantity, setTargetQuantity] = useState(10);
  const [results, setResults] = useState(null);

  const coberturaName = coberturaType === 'leche' ? 'Cobertura Leche' : coberturaType === 'rubi' ? 'Cobertura Rubí' : 'Cobertura Bitter';

  const RECIPE = {
    'Chocolate Blanco': 0.29,
    [coberturaName]: 0.28,
    'Frambuesa': 0.43
  };

  const KG_PER_BOX = 3.6; // 24 potes de 150g

  const findMaterial = (name) => {
    if (!materials) return null;
    const lowerName = name.toLowerCase();
    if (lowerName.includes('blanco') || lowerName.includes('white')) {
      return materials.find(m => m.name.toLowerCase().includes('blanco') || m.name.toLowerCase().includes('white'));
    }
    if (lowerName.includes('leche') || lowerName.includes('milk')) {
      return materials.find(m => m.name.toLowerCase().includes('leche') || m.name.toLowerCase().includes('milk'));
    }
    if (lowerName.includes('rubí') || lowerName.includes('rubi')) {
      return materials.find(m => m.name.toLowerCase().includes('rubí') || m.name.toLowerCase().includes('rubi'));
    }
    if (lowerName.includes('bitter') || lowerName.includes('amargo') || lowerName.includes('dark')) {
      return materials.find(m => m.name.toLowerCase().includes('amargo') || m.name.toLowerCase().includes('bitter') || m.name.toLowerCase().includes('dark'));
    }
    return materials.find(m => m.name.toLowerCase().includes(lowerName));
  };

  useEffect(() => {
    simulate();
  }, [targetQuantity, simulationType, stock, materials, coberturaType]);

  const simulate = () => {
    const totalKgNeeded = simulationType === 'box' ? targetQuantity * KG_PER_BOX : targetQuantity;
    
    const calculation = Object.entries(RECIPE).map(([name, factor]) => {
      const needed = totalKgNeeded * factor;
      const material = findMaterial(name);
      const available = stock
        .filter(s => s.material_id === material?.id)
        .reduce((sum, s) => sum + (s.quantity || 0), 0);
      
      return {
        name,
        needed,
        available,
        shortage: Math.max(0, needed - available),
        isOk: available >= needed
      };
    });

    const maxPossible = Math.min(
      ...Object.entries(RECIPE).map(([name, factor]) => {
        const material = findMaterial(name);
        const available = stock
          .filter(s => s.material_id === material?.id)
          .reduce((sum, s) => sum + (s.quantity || 0), 0);
        return available / (factor * (simulationType === 'box' ? KG_PER_BOX : 1));
      })
    );

    setResults({
      calculation,
      maxPossible: Math.floor(maxPossible),
      totalKgNeeded
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {!hideHeader && (
        <header>
          <h2 className="text-3xl font-black text-chocolate uppercase tracking-tighter">Simulador de <span className="text-raspberry">Producción</span></h2>
          <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.3em] mt-1 ml-1">Cálculo de factibilidad basado en stock actual</p>
        </header>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Controls */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-chocolate/5 shadow-xl space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-chocolate text-white rounded-2xl shadow-lg shadow-chocolate/20">
              <Calculator size={20} />
            </div>
            <h3 className="text-sm font-black text-chocolate uppercase">Parámetros</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Tipo de Meta</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setSimulationType('box')}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${simulationType === 'box' ? 'bg-chocolate text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >
                  Cajas (24 un)
                </button>
                <button 
                  onClick={() => setSimulationType('kg')}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${simulationType === 'kg' ? 'bg-chocolate text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >
                  Kilos (Granel)
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Tipo de Cobertura</label>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => setCoberturaType('leche')}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${coberturaType === 'leche' ? 'bg-chocolate text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >
                  Leche
                </button>
                <button 
                  onClick={() => setCoberturaType('amargo')}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${coberturaType === 'amargo' ? 'bg-chocolate text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >
                  Amargo
                </button>
                <button 
                  onClick={() => setCoberturaType('rubi')}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${coberturaType === 'rubi' ? 'bg-chocolate text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >
                  Rubí
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Cantidad a Simular</label>
              <input 
                type="number" 
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl text-sm font-bold text-chocolate outline-none focus:ring-2 focus:ring-chocolate/10"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-50">
            <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100/50 text-center space-y-2">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Capacidad Máxima</p>
              <p className="text-4xl font-black text-emerald-700 tracking-tighter">
                {results?.maxPossible}
              </p>
              <p className="text-[9px] font-bold text-emerald-600/60 uppercase">{simulationType === 'box' ? 'Cajas Disponibles' : 'Kilos Posibles'}</p>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-chocolate/5 shadow-xl">
            <h3 className="text-sm font-black text-chocolate uppercase mb-6 flex items-center gap-2">
              <Zap size={18} className="text-raspberry" /> Análisis de Insumos Requeridos
            </h3>

            <div className="space-y-4">
              {results?.calculation.map(res => (
                <div key={res.name} className="p-6 bg-slate-50/50 hover:bg-slate-50 rounded-3xl border border-slate-100/70 transition-all duration-300 space-y-4 group/card">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left Side: Ingredient Name & Status Badge */}
                    <div className="flex items-center gap-3">
                      <div className={`w-3.5 h-3.5 rounded-full shadow-sm flex-shrink-0 ${
                        res.name.toLowerCase().includes('blanco') ? 'bg-amber-50 border-2 border-amber-300' :
                        res.name.toLowerCase().includes('leche') ? 'bg-amber-800' :
                        res.name.toLowerCase().includes('rubí') || res.name.toLowerCase().includes('rubi') ? 'bg-pink-400' :
                        res.name.toLowerCase().includes('bitter') || res.name.toLowerCase().includes('amargo') ? 'bg-chocolate' : 'bg-raspberry'
                      }`} />
                      <div>
                        <h4 className="text-xs font-black text-chocolate uppercase tracking-tight">{res.name}</h4>
                        <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                          res.isOk ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {res.isOk ? '✓ Stock Suficiente' : `✗ Faltan ${res.shortage.toFixed(2)} KG`}
                        </span>
                      </div>
                    </div>

                    {/* Right Side: Numeric Comparison Cards */}
                    <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
                      {/* Required Card */}
                      <div className="bg-white p-3 rounded-2xl border border-slate-100 text-center md:text-right min-w-[100px] shadow-sm">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Requerido</p>
                        <p className="text-sm font-black text-chocolate mt-0.5">{res.needed.toFixed(2)} <span className="text-[9px] text-slate-400 font-bold">KG</span></p>
                      </div>

                      {/* Available Card */}
                      <div className={`p-3 rounded-2xl border text-center md:text-right min-w-[100px] shadow-sm transition-colors ${
                        res.isOk ? 'bg-emerald-50/50 border-emerald-100/50' : 'bg-rose-50/50 border-rose-100/50'
                      }`}>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">En Bodega</p>
                        <p className={`text-sm font-black mt-0.5 ${res.isOk ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {res.available.toFixed(2)} <span className="text-[9px] opacity-70 font-bold">KG</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar with Info */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 px-1">
                      <span className="uppercase tracking-widest text-[8px]">Progreso de Cobertura</span>
                      <span>{Math.min(100, Math.round((res.available / res.needed) * 100))}%</span>
                    </div>
                    <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 relative shadow-inner">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          res.isOk ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-raspberry to-rose-600'
                        }`}
                        style={{ width: `${Math.min(100, (res.available / res.needed) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips/Info */}
          <div className="bg-chocolate p-8 rounded-[2.5rem] text-white shadow-2xl flex items-start gap-4">
            <div className="p-3 bg-white/10 rounded-2xl">
              <Info size={24} className="text-cream" />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-tight">Nota sobre la Simulación</h4>
              <p className="text-[11px] text-white/60 font-medium leading-relaxed mt-2">
                Este cálculo se basa en la receta estándar de Bombones Noc. Considere que factores como la humedad, 
                temperatura y mermas en línea (crumble) pueden afectar el rendimiento real final. El simulador 
                utiliza el stock total disponible en todos los lotes de bodega.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
