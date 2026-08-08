import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowUpRight, ClipboardList, Download, PackageSearch, Trash2, Info, FileText } from 'lucide-react';
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

  // Productos únicos que tienen stock
  const uniqueProducts = [...new Set(ptBatches.map(b => b.pt_name))];

  const handleDispatch = async (e) => {
    e.preventDefault();
    const form = e.target;
    
    // Determinar empaque basado en la unidad del lote seleccionado
    const packagingType = selectedBatch.unit === 'Cajas' ? 'Cajas de Potes (24 un)' : 'Cajas de Granel';

    const data = {
      pt_name: selectedProduct,
      pt_lote: selectedBatch.pt_lote,
      quantity: parseFloat(form.quantity.value),
      unit: selectedBatch.unit,
      destination: form.destination.value || 'GUARDA',
      packaging: packagingType,
      movement_code: form.movement_code?.value || null
    };

    try {
      const response = await axios.post(`${API_URL}/pt_dispatch`, data);
      const dispatchId = response.data.id;
      
      // Generar Reporte de Salida con N° de Guía
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

      // HEADER PROFESIONAL (Estilo NOC)
      doc.setFillColor(61, 37, 20); // Chocolate
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

      // TABLA DE DATOS
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
          ['Estado', 'DESPACHADO']
        ],
        theme: 'grid',
        headStyles: { fillColor: [230, 57, 70], textColor: [255, 255, 255], fontStyle: 'bold' }, // Raspberry
        styles: { fontSize: 11, cellPadding: 8 },
        columnStyles: { 0: { fontStyle: 'bold', width: 60 } }
      });

      currentY = doc.lastAutoTable.finalY + 40;

      // SECCIÓN DE FIRMAS
      doc.setDrawColor(61, 37, 20);
      doc.setLineWidth(0.5);
      
      // Firma Despacha
      doc.line(30, currentY, 90, currentY);
      doc.setFontSize(9);
      doc.setTextColor(61, 37, 20);
      doc.text('Firma Despacha', 60, currentY + 5, { align: 'center' });
      doc.text('Responsable Producción', 60, currentY + 10, { align: 'center' });

      // Firma Recibe
      doc.line(120, currentY, 180, currentY);
      doc.text('Firma Recibe', 150, currentY + 5, { align: 'center' });
      doc.text('Responsable Bodega', 150, currentY + 10, { align: 'center' });

      // Footer
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
