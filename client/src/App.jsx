import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Production from './components/Production';
import Guarda from './components/Guarda';
import Settings from './components/Settings';
import History from './components/History';
import Valuation from './components/Valuation';
import Simulator from './components/Simulator';
import Sidebar from './components/Sidebar';
import Login from './components/Login';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-3xl shadow-2xl text-sm font-black tracking-widest uppercase transition-all animate-in slide-in-from-top-10
      ${type === 'error' ? 'bg-raspberry text-white' : 'bg-chocolate text-white'}`}>
      {message}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [materials, setMaterials] = useState([]);
  const [stock, setStock] = useState([]);
  const [ptStock, setPtStock] = useState([]);
  const [ptBatches, setPtBatches] = useState([]);
  const [productionHistory, setProductionHistory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [permisos, setPermisos] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('noc_token');
    const savedUser = localStorage.getItem('noc_user');
    if (savedToken && savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        setToken(savedToken);
        setPermisos(u.permisos);
        axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      } catch (e) {
        localStorage.removeItem('noc_user');
        localStorage.removeItem('noc_token');
      }
    }
  }, []);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const fetchData = async () => {
    try {
      const [matsRes, stockRes, ptStockRes, ptBatchesRes, histRes, movsRes, sessRes] = await Promise.allSettled([
        axios.get(`${API_URL}/materials`),
        axios.get(`${API_URL}/stock`),
        axios.get(`${API_URL}/pt_stock`),
        axios.get(`${API_URL}/pt_batches`),
        axios.get(`${API_URL}/production`),
        axios.get(`${API_URL}/movements`),
        axios.get(`${API_URL}/production/sessions`),
      ]);

      const mats = matsRes.status === 'fulfilled' ? matsRes.value.data : [];
      const stk  = stockRes.status === 'fulfilled' ? stockRes.value.data : [];
      const pts  = ptStockRes.status === 'fulfilled' ? ptStockRes.value.data : [];
      const ptb  = ptBatchesRes.status === 'fulfilled' ? ptBatchesRes.value.data : [];
      const hist = histRes.status === 'fulfilled' ? histRes.value.data : [];
      const movs = movsRes.status === 'fulfilled' ? movsRes.value.data : [];
      const sess = sessRes.status === 'fulfilled' ? sessRes.value.data : [];

      setMaterials(mats);
      setStock(stk);
      setPtStock(pts);
      setPtBatches(ptb);
      setProductionHistory(hist);
      setMovements(movs);
      setActiveSessions(sess);

      const low = mats.filter(m => {
        const total = stk
          .filter(s => s.material_id === m.id)
          .reduce((acc, curr) => acc + curr.quantity, 0);
        return total <= m.min_stock;
      }).length;
      setLowStockCount(low);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const handleLogin = (userData, userToken) => {
    setUser(userData); localStorage.setItem('noc_user', JSON.stringify(userData));
    setToken(userToken); localStorage.setItem('noc_token', userToken);
    setPermisos(userData.permisos);
    axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
  };

  const handleLogout = () => {
    setUser(null); localStorage.removeItem('noc_token'); localStorage.removeItem('noc_user');
    setToken(null);
    setPermisos(null);
    delete axios.defaults.headers.common['Authorization'];
    setActiveTab('dashboard');
  };

  if (!user) {
    return (
      <div className="bg-cream min-h-screen">
        <Login onLogin={handleLogin} />
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-cream font-sans text-chocolate selection:bg-raspberry selection:text-white">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lowStockCount={lowStockCount}
        currentUser={user}
        onLogout={handleLogout}
        permisos={permisos}
      />

      <main className="flex-1 overflow-y-auto px-8 md:px-12 py-12 bg-cream/50">
        <div className="max-w-7xl mx-auto pb-12">
          {activeTab === 'dashboard' && (
            <Dashboard
              materials={materials}
              stock={stock}
              ptStock={ptStock}
              ptBatches={ptBatches}
              productionHistory={productionHistory}
              fetchData={fetchData}
              showToast={showToast}
            />
          )}
          {activeTab === 'inventory' && (
            <Inventory 
              materials={materials} 
              stock={stock} 
              ptStock={ptStock}
              productionHistory={productionHistory}
              movements={movements} 
              fetchData={fetchData} 
              showToast={showToast} 
              userPermisos={permisos} 
            />
          )}
          {activeTab === 'production' && (
            <Production materials={materials} stock={stock} productionHistory={productionHistory} activeSessions={activeSessions} fetchData={fetchData} showToast={showToast} /> 
          )}
          {activeTab === 'guarda' && (
            <Guarda fetchData={fetchData} showToast={showToast} />
          )}
          {activeTab === 'history' && (
            <History 
              movements={movements} 
              productionHistory={productionHistory} 
              fetchData={fetchData} 
              showToast={showToast} 
            />
          )}
          {activeTab === 'valuation' && (
            <Valuation materials={materials} stock={stock} showToast={showToast} />
          )}
          {activeTab === 'simulator' && (
            <Simulator materials={materials} stock={stock} showToast={showToast} />
          )}
          {activeTab === 'settings' && (
            <Settings
              materials={materials}
              fetchData={fetchData}
              showToast={showToast}
              user={user}
              token={token}
            />
          )}
        </div>
      </main>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}