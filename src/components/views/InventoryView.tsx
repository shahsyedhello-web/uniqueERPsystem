import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { formatSmartUnit } from '../../utils/unitConversion';
import {
  Product,
  InventoryLedger,
  Warehouse,
  Unit,
  StockBatch,
  GoodsReceipt,
  StockTransfer,
  Supplier,
  InventoryAudit,
} from '../../types/pos';
import {
  Boxes,
  PlusCircle,
  ArrowRightLeft,
  AlertTriangle,
  Search,
  X,
  Trash2,
  Building2,
  Scale,
  Package,
  Clock,
  TrendingUp,
  FileText,
  Plus,
  Edit2,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Truck,
  ShieldCheck,
  DollarSign,
  Download,
  Upload,
  Printer,
  QrCode,
  Barcode,
  Layers,
  Tag,
  Filter,
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'DASHBOARD' | 'PRODUCTS' | 'LEDGER' | 'WAREHOUSES' | 'UNITS' | 'GRN' | 'BATCHES' | 'TRANSFERS' | 'LOW_STOCK' | 'AUDIT'
  >('DASHBOARD');

  const [ledger, setLedger] = useState<InventoryLedger[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [grns, setGrns] = useState<GoodsReceipt[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [audits, setAudits] = useState<InventoryAudit[]>([]);

  const [dashboardData, setDashboardData] = useState<{
    totalInventoryValue: number;
    totalStock: number;
    outOfStockCount: number;
    lowStockCount: number;
    expiredCount: number;
    nearExpiryCount: number;
    warehouseSummary: any[];
    stockValueByCategory: any[];
    topMovingProducts: any[];
    slowMovingProducts: any[];
  } | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('');

  // Notification Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // --- MODALS STATE ---
  // Stock Adjustment
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [adjustWarehouseId, setAdjustWarehouseId] = useState('');
  const [adjustBatchNo, setAdjustBatchNo] = useState('');
  const [adjustType, setAdjustType] = useState<'ADD' | 'SUBTRACT' | 'EXPIRED' | 'DAMAGED' | 'CORRECTION' | 'LOST'>('ADD');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Warehouse Modal
  const [showWhModal, setShowWhModal] = useState(false);
  const [editingWhId, setEditingWhId] = useState<string | null>(null);
  const [whFormData, setWhFormData] = useState({
    name: '',
    code: '',
    type: 'MAIN' as Warehouse['type'],
    location: '',
  });
  const [deletingWh, setDeletingWh] = useState<Warehouse | null>(null);
  const [deletingWhError, setDeletingWhError] = useState<string | null>(null);

  // Unit Modal
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [unitFormData, setUnitFormData] = useState({ name: '', code: '', symbol: '', description: '' });
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null);
  const [deletingUnitError, setDeletingUnitError] = useState<string | null>(null);

  // Goods Receipt Modal
  const [showGrnModal, setShowGrnModal] = useState(false);
  const [grnSupplierId, setGrnSupplierId] = useState('');
  const [grnWarehouseId, setGrnWarehouseId] = useState('');
  const [grnPurchaseRef, setGrnPurchaseRef] = useState('');
  const [grnNotes, setGrnNotes] = useState('');
  const [grnItems, setGrnItems] = useState<
    { productId: string; receivedQuantity: number; purchasePrice: number; batchNo?: string; expiryDate?: string }[]
  >([]);

  // Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [trfFromWhId, setTrfFromWhId] = useState('');
  const [trfToWhId, setTrfToWhId] = useState('');
  const [trfNotes, setTrfNotes] = useState('');
  const [trfItems, setTrfItems] = useState<{ productId: string; quantity: number }[]>([]);

  // Barcode & QR Label Modal
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [labelCount, setLabelCount] = useState(12);

  // CSV Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFileContent, setImportFileContent] = useState('');
  const [importing, setImporting] = useState(false);

  // Delete Log Confirmation
  const [deletingLog, setDeletingLog] = useState<InventoryLedger | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loadAllData = async () => {
    try {
      const [led, prods, whs, uns, bts, grnList, trfList, supps, audList, dash] = await Promise.all([
        apiFetch<InventoryLedger[]>('/inventory/ledger').catch(() => []),
        apiFetch<Product[]>('/products').catch(() => []),
        apiFetch<Warehouse[]>('/inventory/warehouses').catch(() => []),
        apiFetch<Unit[]>('/inventory/units').catch(() => []),
        apiFetch<StockBatch[]>('/inventory/batches').catch(() => []),
        apiFetch<GoodsReceipt[]>('/inventory/grn').catch(() => []),
        apiFetch<StockTransfer[]>('/inventory/transfers').catch(() => []),
        apiFetch<Supplier[]>('/suppliers').catch(() => []),
        apiFetch<InventoryAudit[]>('/inventory/audit').catch(() => []),
        apiFetch<any>('/inventory/dashboard').catch(() => ({})),
      ]);

      setLedger(Array.isArray(led) ? led : []);
      setProducts(Array.isArray(prods) ? prods : []);
      setWarehouses(Array.isArray(whs) ? whs : []);
      setUnits(Array.isArray(uns) ? uns : []);
      setBatches(Array.isArray(bts) ? bts : []);
      setGrns(Array.isArray(grnList) ? grnList : []);
      setTransfers(Array.isArray(trfList) ? trfList : []);
      setSuppliers(Array.isArray(supps) ? supps : []);
      setAudits(Array.isArray(audList) ? audList : []);
      setDashboardData(dash && !dash.error ? dash : null);
    } catch (e) {
      console.error('Failed to load inventory data:', e);
      setLedger([]);
      setProducts([]);
      setWarehouses([]);
      setUnits([]);
      setBatches([]);
      setGrns([]);
      setTransfers([]);
      setSuppliers([]);
      setAudits([]);
      setDashboardData(null);
    }
  };

  // --- HANDLERS ---
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !adjustQty || Number(adjustQty) <= 0) {
      alert('Please select a product and enter a valid quantity.');
      return;
    }

    try {
      await apiFetch('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProductId,
          warehouseId: adjustWarehouseId || undefined,
          batchNo: adjustBatchNo || undefined,
          type: adjustType,
          quantity: Number(adjustQty),
          reason: adjustReason || 'Manual adjustment',
        }),
      });
      setShowAdjustModal(false);
      setSelectedProductId('');
      setAdjustWarehouseId('');
      setAdjustBatchNo('');
      setAdjustQty('');
      setAdjustReason('');
      showToast('Stock adjusted successfully.');
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to adjust stock');
    }
  };

  const handleWhSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingWhId) {
        await apiFetch(`/inventory/warehouses/${editingWhId}`, {
          method: 'PUT',
          body: JSON.stringify(whFormData),
        });
        showToast('Warehouse updated successfully.');
      } else {
        await apiFetch('/inventory/warehouses', {
          method: 'POST',
          body: JSON.stringify(whFormData),
        });
        showToast('Warehouse created successfully.');
      }
      setShowWhModal(false);
      setEditingWhId(null);
      setWhFormData({ name: '', code: '', type: 'MAIN', location: '' });
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to save warehouse');
    }
  };

  const confirmDeleteWh = async () => {
    if (!deletingWh) return;
    try {
      await apiFetch(`/inventory/warehouses/${deletingWh.id}`, { method: 'DELETE' });
      showToast(`Warehouse "${deletingWh.name}" removed successfully.`);
      setDeletingWh(null);
      setDeletingWhError(null);
      loadAllData();
    } catch (err: any) {
      setDeletingWhError(err.message || 'Failed to delete warehouse');
    }
  };

  const handleUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUnitId) {
        await apiFetch(`/inventory/units/${editingUnitId}`, {
          method: 'PUT',
          body: JSON.stringify(unitFormData),
        });
        showToast('Unit updated successfully.');
      } else {
        await apiFetch('/inventory/units', {
          method: 'POST',
          body: JSON.stringify(unitFormData),
        });
        showToast('Unit created successfully.');
      }
      setShowUnitModal(false);
      setEditingUnitId(null);
      setUnitFormData({ name: '', code: '', symbol: '', description: '' });
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to save unit');
    }
  };

  const confirmDeleteUnit = async () => {
    if (!deletingUnit) return;
    try {
      await apiFetch(`/inventory/units/${deletingUnit.id}`, { method: 'DELETE' });
      showToast(`Unit "${deletingUnit.name}" deleted successfully.`);
      setDeletingUnit(null);
      setDeletingUnitError(null);
      loadAllData();
    } catch (err: any) {
      setDeletingUnitError(err.message || 'Failed to delete unit');
    }
  };

  const handleGrnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grnSupplierId || !grnWarehouseId || grnItems.length === 0) {
      alert('Please select supplier, warehouse, and add at least one product item.');
      return;
    }

    try {
      await apiFetch('/inventory/grn', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: grnSupplierId,
          warehouseId: grnWarehouseId,
          purchaseRef: grnPurchaseRef,
          notes: grnNotes,
          items: grnItems,
        }),
      });
      showToast('Goods Receipt (GRN) created successfully and stock updated.');
      setShowGrnModal(false);
      setGrnSupplierId('');
      setGrnWarehouseId('');
      setGrnPurchaseRef('');
      setGrnNotes('');
      setGrnItems([]);
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to process Goods Receipt.');
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trfFromWhId || !trfToWhId || trfItems.length === 0) {
      alert('Please select source and destination warehouse, and add transfer items.');
      return;
    }
    if (trfFromWhId === trfToWhId) {
      alert('Source and destination warehouse cannot be the same.');
      return;
    }

    try {
      await apiFetch('/inventory/transfers', {
        method: 'POST',
        body: JSON.stringify({
          fromWarehouseId: trfFromWhId,
          toWarehouseId: trfToWhId,
          items: trfItems,
          notes: trfNotes,
        }),
      });
      showToast('Stock transfer completed successfully.');
      setShowTransferModal(false);
      setTrfFromWhId('');
      setTrfToWhId('');
      setTrfNotes('');
      setTrfItems([]);
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to process stock transfer.');
    }
  };

  const confirmDeleteLog = async () => {
    if (!deletingLog) return;
    try {
      await apiFetch(`/inventory/ledger/${deletingLog.id}`, { method: 'DELETE' });
      showToast('Inventory log entry removed.');
      setDeletingLog(null);
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete inventory log entry.');
    }
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    const safeProducts = Array.isArray(products) ? products : [];
    if (safeProducts.length === 0) return;
    const headers = ['SKU', 'Barcode', 'Product Name', 'Category', 'Unit', 'Purchase Price', 'Sale Price', 'Current Stock', 'Min Stock', 'Stock Value'];
    const rows = safeProducts.map((p) => [
      `"${p.sku}"`,
      `"${p.barcode}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.categoryName || ''}"`,
      `"${p.unit}"`,
      p.purchasePrice,
      p.salePrice,
      p.currentStock,
      p.minStock,
      p.currentStock * (p.costPrice || p.purchasePrice || p.averageCost || 0),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Inventory report CSV downloaded.');
  };

  // CSV Import Submission Handler
  const handleCsvImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFileContent.trim()) {
      alert('Please paste CSV data or select a valid CSV file.');
      return;
    }

    try {
      setImporting(true);
      const lines = importFileContent.trim().split('\n');
      if (lines.length < 2) {
        alert('CSV file must contain a header row and at least one data row.');
        setImporting(false);
        return;
      }

      const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim().toLowerCase());
      const parsedProducts = lines.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.replace(/"/g, '').trim());
        const getCol = (names: string[]) => {
          const idx = headers.findIndex((h) => names.includes(h));
          return idx !== -1 ? cols[idx] : '';
        };

        return {
          sku: getCol(['sku']),
          barcode: getCol(['barcode']),
          name: getCol(['product name', 'name', 'productname']),
          category: getCol(['category', 'category name']),
          unit: getCol(['unit', 'uom']) || 'pcs',
          purchasePrice: Number(getCol(['purchase price', 'purchaseprice', 'cost', 'cost price'])) || 0,
          salePrice: Number(getCol(['sale price', 'saleprice', 'price', 'retail price'])) || 0,
          currentStock: Number(getCol(['current stock', 'currentstock', 'opening stock', 'stock', 'qty'])) || 0,
          minStock: Number(getCol(['min stock', 'minstock', 'reorder level'])) || 5,
        };
      });

      const res = await apiFetch<any>('/inventory/import-bulk', {
        method: 'POST',
        body: JSON.stringify({ products: parsedProducts }),
      });

      showToast(res.message || 'Bulk inventory imported successfully.');
      setShowImportModal(false);
      setImportFileContent('');
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to import CSV data.');
    } finally {
      setImporting(false);
    }
  };

  // Handle Print Slips (GRN, Transfer, Adjustment, Report)
  const handlePrintSlip = (title: string, contentHtml: string) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: monospace, sans-serif; padding: 20px; color: #000; font-size: 12px; }
            h1 { font-size: 18px; margin-bottom: 5px; border-bottom: 2px solid #000; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
            th { background-color: #f0f0f0; }
            .header-info { display: flex; justify-content: space-between; margin-bottom: 15px; }
            .footer { margin-top: 30px; font-size: 10px; border-top: 1px solid #ccc; padding-top: 5px; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          ${contentHtml}
          <div class="footer">Unique Sweets & Bakers - Enterprise ERP System | Printed: ${new Date().toLocaleString()}</div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredLedger = ledger.filter((l) => {
    const matchSearch =
      l.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.referenceNo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchWh = !selectedWarehouseFilter || l.warehouseId === selectedWarehouseFilter;
    return matchSearch && matchWh;
  });

  const safeProducts = Array.isArray(products) ? products : [];
  const lowStockProducts = safeProducts.filter((p) => p.currentStock <= (p.minStock || p.reorderLevel || 5));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* SUCCESS TOAST */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-purple-400" />
            <span>Enterprise Inventory Management</span>
          </h1>
          <p className="text-xs text-slate-400">Multi-warehouse stock control, GRN receipting, batch tracking & valuation ledger</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center space-x-1 border border-slate-700"
            title="Export CSV Inventory Report"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center space-x-1 border border-slate-700"
            title="Import Products & Stock from CSV"
          >
            <Upload className="w-3.5 h-3.5 text-purple-400" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => {
              const rows = safeProducts.map((p) => `<tr><td>${p.sku}</td><td>${p.barcode}</td><td>${p.name}</td><td>${p.categoryName || ''}</td><td>${p.currentStock} ${p.unit}</td><td>Rs. ${(p.costPrice || p.purchasePrice || p.averageCost || 0).toLocaleString()}</td><td>Rs. ${(p.currentStock * (p.costPrice || p.purchasePrice || p.averageCost || 0)).toLocaleString()}</td></tr>`).join('');
              handlePrintSlip('Inventory Valuation & Stock Report', `
                <div class="header-info"><div>Total Items: ${safeProducts.length}</div><div>Valuation: Rs. ${(dashboardData?.totalInventoryValue || 0).toLocaleString()}</div></div>
                <table><thead><tr><th>SKU</th><th>Barcode</th><th>Product Name</th><th>Category</th><th>Current Stock</th><th>Unit Cost</th><th>Total Value</th></tr></thead><tbody>${rows}</tbody></table>
              `);
            }}
            className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center space-x-1 border border-slate-700"
            title="Print Full Inventory Stock Report"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-400" />
            <span>Print Report</span>
          </button>

          <button
            onClick={() => {
              if (warehouses.length > 0) setGrnWarehouseId(warehouses[0].id);
              if (suppliers.length > 0) setGrnSupplierId(suppliers[0].id);
              setGrnItems([{ productId: safeProducts[0]?.id || '', receivedQuantity: 1, purchasePrice: safeProducts[0]?.purchasePrice || 0 }]);
              setShowGrnModal(true);
            }}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1 shadow-lg shadow-emerald-600/20"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Goods Receipt (GRN)</span>
          </button>

          <button
            onClick={() => {
              if (warehouses.length > 0) setTrfFromWhId(warehouses[0].id);
              if (warehouses.length > 1) setTrfToWhId(warehouses[1].id);
              setTrfItems([{ productId: safeProducts[0]?.id || '', quantity: 1 }]);
              setShowTransferModal(true);
            }}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1 shadow-lg shadow-blue-600/20"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Transfer Stock</span>
          </button>

          <button
            onClick={() => {
              if (safeProducts.length > 0) setSelectedProductId(safeProducts[0].id);
              setShowAdjustModal(true);
            }}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1 shadow-lg shadow-purple-600/20"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Stock Adjustment</span>
          </button>
        </div>
      </div>

      {/* SUMMARY STATS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inventory Value</p>
          <p className="text-base font-extrabold text-slate-100 font-mono">
            Rs. {(dashboardData?.totalInventoryValue || 0).toLocaleString()}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Products</p>
          <p className="text-base font-extrabold text-purple-400 font-mono">{safeProducts.length} Items</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Warehouses</p>
          <p className="text-base font-extrabold text-blue-400 font-mono">{warehouses.length} Active</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Low Stock</p>
          <p className="text-base font-extrabold text-amber-400 font-mono">{dashboardData?.lowStockCount || lowStockProducts.length}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Out of Stock</p>
          <p className="text-base font-extrabold text-red-400 font-mono">{dashboardData?.outOfStockCount || 0}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expired / Near</p>
          <p className="text-base font-extrabold text-orange-400 font-mono">
            {(dashboardData?.expiredCount || 0) + (dashboardData?.nearExpiryCount || 0)} Batches
          </p>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('DASHBOARD')}
          className={`px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'DASHBOARD' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          Overview & KPI
        </button>
        <button
          onClick={() => setActiveTab('PRODUCTS')}
          className={`px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'PRODUCTS' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          Product Master ({safeProducts.length})
        </button>
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'LEDGER' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          Stock Audit Ledger ({ledger.length})
        </button>
        <button
          onClick={() => setActiveTab('WAREHOUSES')}
          className={`px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'WAREHOUSES' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          Warehouses ({warehouses.length})
        </button>
        <button
          onClick={() => setActiveTab('UNITS')}
          className={`px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'UNITS' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          Measurement Units ({units.length})
        </button>
        <button
          onClick={() => setActiveTab('GRN')}
          className={`px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'GRN' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          Goods Receipts GRN ({grns.length})
        </button>
        <button
          onClick={() => setActiveTab('BATCHES')}
          className={`px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'BATCHES' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          Stock Batches ({batches.length})
        </button>
        <button
          onClick={() => setActiveTab('TRANSFERS')}
          className={`px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'TRANSFERS' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          Transfers ({transfers.length})
        </button>
        <button
          onClick={() => setActiveTab('LOW_STOCK')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1 ${
            activeTab === 'LOW_STOCK' ? 'bg-amber-600 text-white' : 'bg-slate-900 text-amber-400 hover:text-amber-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Low Stock ({lowStockProducts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`px-3.5 py-2 rounded-xl transition-all ${
            activeTab === 'AUDIT' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          Audit Logs ({audits.length})
        </button>
      </div>

      {/* OVERVIEW DASHBOARD */}
      {activeTab === 'DASHBOARD' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Warehouse Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>Warehouse Stock Valuation</span>
            </h2>
            <div className="space-y-3">
              {(dashboardData?.warehouseSummary || []).map((w: any) => (
                <div key={w.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-200">{w.name} <span className="font-mono text-purple-400 text-[10px]">({w.code})</span></p>
                    <p className="text-slate-400 text-[11px]">{w.productCount} Product Lines Assigned</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold font-mono text-emerald-400">Rs. {(w.totalValue || 0).toLocaleString()}</p>
                    <p className="text-slate-400 text-[11px] font-mono">{w.totalStock} Total Qty</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Valuation */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <Package className="w-4 h-4 text-purple-400" />
              <span>Category Stock Distribution</span>
            </h2>
            <div className="space-y-3">
              {(dashboardData?.stockValueByCategory || []).map((c: any) => (
                <div key={c.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-200">{c.name}</p>
                    <p className="text-slate-400 text-[11px]">{c.productCount} Unique Items</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold font-mono text-purple-300">Rs. {(c.totalValue || 0).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT MASTER TABLE */}
      {activeTab === 'PRODUCTS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Barcode, SKU, Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedWarehouseFilter}
                onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
              >
                <option value="">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Product & SKU</th>
                  <th className="p-3.5">Barcode</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Warehouse</th>
                  <th className="p-3.5">Unit / Weight</th>
                  <th className="p-3.5">Stock Breakdown</th>
                  <th className="p-3.5">Prices & Margin</th>
                  <th className="p-3.5">Stock Value</th>
                  <th className="p-3.5 text-right">Label Print</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {products
                  .filter((p) => {
                    const matchSearch =
                      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.barcode.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchWh = !selectedWarehouseFilter || p.warehouseId === selectedWarehouseFilter;
                    return matchSearch && matchWh;
                  })
                  .map((p) => {
                    const margin = p.salePrice > 0 ? (((p.salePrice - (p.purchasePrice || p.costPrice || 0)) / p.salePrice) * 100).toFixed(1) : '0';
                    const totalVal = p.currentStock * (p.purchasePrice || p.costPrice || 0);
                    const formattedSmart = formatSmartUnit(p.currentStock, p.unit);

                    return (
                      <tr key={p.id} className="hover:bg-slate-800/40">
                        <td className="p-3.5">
                          <p className="font-bold text-slate-100">{p.name}</p>
                          <p className="font-mono text-[10px] text-purple-400">SKU: {p.sku}</p>
                        </td>
                        <td className="p-3.5 font-mono text-slate-300 text-[11px]">{p.barcode}</td>
                        <td className="p-3.5 text-slate-400">{p.categoryName || 'General'}</td>
                        <td className="p-3.5 text-slate-400">{p.warehouseName || 'Main Store'}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-blue-300 font-mono">
                            {p.unit}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-100 font-mono">
                              {p.currentStock} {p.unit}
                            </p>
                            {formattedSmart && <p className="text-[10px] text-emerald-400 font-mono">({formattedSmart})</p>}
                            <div className="flex gap-2 text-[10px] text-slate-400">
                              <span>Min: {p.minStock}</span>
                              <span>Available: {p.availableStock ?? p.currentStock}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <p className="text-slate-300 font-mono">Cost: Rs. {p.purchasePrice || p.costPrice || 0}</p>
                          <p className="font-bold text-emerald-400 font-mono">Sale: Rs. {p.salePrice}</p>
                          <p className="text-[10px] text-purple-400">Margin: {margin}%</p>
                        </td>
                        <td className="p-3.5 font-bold font-mono text-purple-300">
                          Rs. {totalVal.toLocaleString()}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => {
                              setBarcodeProduct(p);
                              setShowBarcodeModal(true);
                            }}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded-lg flex items-center space-x-1 ml-auto border border-slate-700"
                            title="Print Barcode & QR Label Sheet"
                          >
                            <Barcode className="w-3.5 h-3.5 text-purple-400" />
                            <span>Print Label</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STOCK AUDIT LEDGER */}
      {activeTab === 'LEDGER' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search product or ref #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <select
              value={selectedWarehouseFilter}
              onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Date & Time</th>
                  <th className="p-3.5">Product</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Qty Change</th>
                  <th className="p-3.5">Previous -&gt; New Stock</th>
                  <th className="p-3.5">Reference #</th>
                  <th className="p-3.5">Warehouse</th>
                  <th className="p-3.5">Reason / User</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredLedger.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3.5 font-bold text-slate-100">{log.productName}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.type === 'SALE'
                            ? 'bg-red-500/10 text-red-400'
                            : log.type === 'PURCHASE' || log.type === 'GRN'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-blue-500/10 text-blue-400'
                        }`}
                      >
                        {log.type}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold font-mono">
                      {log.type === 'SALE' ? `-${log.quantity}` : `+${log.quantity}`}
                    </td>
                    <td className="p-3.5 text-slate-400 font-mono">
                      {log.previousStock} -&gt; <span className="text-slate-100 font-bold">{log.newStock}</span>
                    </td>
                    <td className="p-3.5 text-blue-400 font-mono">{log.referenceNo}</td>
                    <td className="p-3.5 text-slate-400">{log.warehouseName || 'Main Store'}</td>
                    <td className="p-3.5 text-slate-400">{log.reason || log.createdByName}</td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setDeletingLog(log)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg transition-colors"
                        title="Delete Log Entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredLedger.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-500">
                      No stock ledger records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WAREHOUSES MANAGEMENT */}
      {activeTab === 'WAREHOUSES' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-400">Manage store locations, cold storage, and raw material warehouses</p>
            <button
              onClick={() => {
                setEditingWhId(null);
                setWhFormData({ name: '', code: '', type: 'MAIN', location: '' });
                setShowWhModal(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Warehouse</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Warehouse Name</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Location / Floor</th>
                  <th className="p-3.5">Stock Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {warehouses.map((w) => {
                  const wStock = safeProducts.filter((p) => p.warehouseId === w.id).reduce((sum, p) => sum + p.currentStock, 0);
                  return (
                    <tr key={w.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono text-purple-400 font-bold">{w.code}</td>
                      <td className="p-3.5 font-bold text-slate-100 flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                        <span>{w.name}</span>
                        {w.isMain && <span className="bg-purple-500/10 text-purple-400 text-[10px] px-1.5 py-0.5 rounded font-bold">MAIN</span>}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                          {w.type}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400">{w.location || '-'}</td>
                      <td className="p-3.5 font-bold text-emerald-400 font-mono">{wStock} Total Qty</td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingWhId(w.id);
                            setWhFormData({
                              name: w.name,
                              code: w.code,
                              type: w.type,
                              location: w.location || '',
                            });
                            setShowWhModal(true);
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg"
                          title="Edit Warehouse"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setDeletingWh(w);
                            setDeletingWhError(null);
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg"
                          title="Delete Warehouse"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* UNITS MANAGEMENT */}
      {activeTab === 'UNITS' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-400">Configure standard measurement units (Kg, Gram, Piece, Liter, Packet, Tray, Box)</p>
            <button
              onClick={() => {
                setEditingUnitId(null);
                setUnitFormData({ name: '', code: '', symbol: '', description: '' });
                setShowUnitModal(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Unit</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Unit Name</th>
                  <th className="p-3.5">Symbol</th>
                  <th className="p-3.5">Description</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {units.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-mono text-purple-400 font-bold">{u.code}</td>
                    <td className="p-3.5 font-bold text-slate-100 flex items-center space-x-2">
                      <Scale className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{u.name}</span>
                    </td>
                    <td className="p-3.5 font-bold text-amber-400 font-mono">{u.symbol}</td>
                    <td className="p-3.5 text-slate-400">{u.description || '-'}</td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingUnitId(u.id);
                          setUnitFormData({
                            name: u.name,
                            code: u.code,
                            symbol: u.symbol,
                            description: u.description || '',
                          });
                          setShowUnitModal(true);
                        }}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setDeletingUnit(u);
                          setDeletingUnitError(null);
                        }}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GOODS RECEIPTS (GRN) */}
      {activeTab === 'GRN' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">GRN #</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Supplier</th>
                <th className="p-3.5">Warehouse</th>
                <th className="p-3.5">Items Received</th>
                <th className="p-3.5">Total Cost</th>
                <th className="p-3.5">Received By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {grns.map((g) => (
                <tr key={g.id} className="hover:bg-slate-800/40">
                  <td className="p-3.5 font-mono text-emerald-400 font-bold">{g.grnNo}</td>
                  <td className="p-3.5 text-slate-400">{g.receiveDate}</td>
                  <td className="p-3.5 font-bold text-slate-100">{g.supplierName}</td>
                  <td className="p-3.5 text-slate-300">{g.warehouseName}</td>
                  <td className="p-3.5 text-slate-300">
                    {g.items.map((i) => `${i.productName} (${i.receivedQuantity} ${i.unit})`).join(', ')}
                  </td>
                  <td className="p-3.5 font-bold font-mono text-emerald-400">Rs. {g.totalAmount.toLocaleString()}</td>
                  <td className="p-3.5 text-slate-400">{g.createdByName}</td>
                </tr>
              ))}
              {grns.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No Goods Receipt Notes processed yet. Click "Goods Receipt (GRN)" to receive inventory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* STOCK BATCHES */}
      {activeTab === 'BATCHES' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Batch #</th>
                <th className="p-3.5">Product</th>
                <th className="p-3.5">Warehouse</th>
                <th className="p-3.5">Expiry Date</th>
                <th className="p-3.5">Initial / Current Qty</th>
                <th className="p-3.5">Unit Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {batches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-800/40">
                  <td className="p-3.5 font-mono text-amber-400 font-bold">{b.batchNo}</td>
                  <td className="p-3.5 font-bold text-slate-100">{b.productName}</td>
                  <td className="p-3.5 text-slate-400">{b.warehouseName || 'Main Store'}</td>
                  <td className="p-3.5 font-mono text-slate-300">{b.expiryDate || '-'}</td>
                  <td className="p-3.5 font-mono">
                    {b.initialQuantity} -&gt; <span className="text-emerald-400 font-bold">{b.currentQuantity}</span>
                  </td>
                  <td className="p-3.5 font-bold font-mono text-slate-100">Rs. {b.costPrice}</td>
                </tr>
              ))}
              {batches.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    No batch tracking records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TRANSFERS */}
      {activeTab === 'TRANSFERS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Transfer #</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">From Location</th>
                <th className="p-3.5">To Location</th>
                <th className="p-3.5">Transferred Items</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {transfers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/40">
                  <td className="p-3.5 font-mono text-blue-400 font-bold">{t.transferNo}</td>
                  <td className="p-3.5 text-slate-400 text-[11px]">{new Date(t.createdAt).toLocaleString()}</td>
                  <td className="p-3.5 font-bold text-slate-200">{t.fromWarehouseName || t.fromBranch}</td>
                  <td className="p-3.5 font-bold text-emerald-400">{t.toWarehouseName || t.toBranch}</td>
                  <td className="p-3.5 text-slate-300">
                    {t.items.map((i) => `${i.productName} (x${i.quantity})`).join(', ')}
                  </td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
              {transfers.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    No inter-warehouse or branch stock transfers logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* LOW STOCK */}
      {activeTab === 'LOW_STOCK' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Product Name</th>
                <th className="p-3.5">SKU</th>
                <th className="p-3.5">Current Stock</th>
                <th className="p-3.5">Min Stock Threshold</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {lowStockProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/40">
                  <td className="p-3.5 font-bold text-slate-100">{p.name}</td>
                  <td className="p-3.5 font-mono text-slate-400">{p.sku}</td>
                  <td className="p-3.5 font-mono font-bold text-red-400">{p.currentStock} {p.unit}</td>
                  <td className="p-3.5 font-mono text-slate-400">{p.minStock || p.reorderLevel || 5} {p.unit}</td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400">
                      {p.currentStock <= 0 ? 'OUT OF STOCK' : 'LOW STOCK ALERT'}
                    </span>
                  </td>
                </tr>
              ))}
              {lowStockProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    All product inventory levels are currently healthy!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* AUDIT LOGS */}
      {activeTab === 'AUDIT' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Ref #</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Product</th>
                <th className="p-3.5">Old -&gt; New Stock</th>
                <th className="p-3.5">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {audits.map((a) => (
                <tr key={a.id} className="hover:bg-slate-800/40">
                  <td className="p-3.5 text-slate-400 text-[11px]">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="p-3.5 font-mono text-purple-400 font-bold">{a.referenceNo}</td>
                  <td className="p-3.5 font-bold text-slate-100">{a.action}</td>
                  <td className="p-3.5 text-slate-300">{a.productName || '-'}</td>
                  <td className="p-3.5 font-mono text-slate-400">
                    {a.oldValue || '-'} -&gt; <span className="text-emerald-400 font-bold">{a.newValue || '-'}</span>
                  </td>
                  <td className="p-3.5 text-slate-400">{a.userName}</td>
                </tr>
              ))}
              {audits.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    No audit records logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* STOCK ADJUSTMENT MODAL */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">Perform Stock Adjustment</h2>
              <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Product *</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                >
                  {safeProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) - Current: {p.currentStock} {p.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Warehouse</label>
                <select
                  value={adjustWarehouseId}
                  onChange={(e) => setAdjustWarehouseId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                >
                  <option value="">Default Warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Adjustment Type *</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                >
                  <option value="ADD">Increase Stock (Purchase / Found)</option>
                  <option value="SUBTRACT">Decrease Stock (Correction)</option>
                  <option value="DAMAGED">Damaged Goods</option>
                  <option value="EXPIRED">Expired Product</option>
                  <option value="LOST">Lost / Missing Stock</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Quantity *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Reason for Audit *</label>
                <textarea
                  required
                  rows={2}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Provide audit compliance reason..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl">
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WAREHOUSE MODAL */}
      {showWhModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">
                {editingWhId ? 'Edit Warehouse' : 'Add New Warehouse'}
              </h2>
              <button onClick={() => setShowWhModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleWhSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Warehouse Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cold Storage Room 1"
                  value={whFormData.name}
                  onChange={(e) => setWhFormData({ ...whFormData, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Warehouse Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WH-COLD-1"
                  value={whFormData.code}
                  onChange={(e) => setWhFormData({ ...whFormData, code: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono uppercase focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Store Type *</label>
                <select
                  value={whFormData.type}
                  onChange={(e) => setWhFormData({ ...whFormData, type: e.target.value as any })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                >
                  <option value="MAIN">Main Store</option>
                  <option value="RAW_MATERIAL">Raw Material Store</option>
                  <option value="FINISHED_GOODS">Finished Goods Store</option>
                  <option value="COLD_STORAGE">Cold Storage</option>
                  <option value="PRODUCTION">Production / Kitchen Floor</option>
                  <option value="BRANCH">Branch Warehouse</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Location / Floor</label>
                <input
                  type="text"
                  placeholder="e.g. Ground Floor, Sector 2"
                  value={whFormData.location}
                  onChange={(e) => setWhFormData({ ...whFormData, location: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowWhModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl">
                  Save Warehouse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UNIT MODAL */}
      {showUnitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">
                {editingUnitId ? 'Edit Measurement Unit' : 'Add Measurement Unit'}
              </h2>
              <button onClick={() => setShowUnitModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUnitSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Unit Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kilogram"
                  value={unitFormData.name}
                  onChange={(e) => setUnitFormData({ ...unitFormData, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Unit Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KG"
                  value={unitFormData.code}
                  onChange={(e) => setUnitFormData({ ...unitFormData, code: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono uppercase focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Symbol *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. kg"
                  value={unitFormData.symbol}
                  onChange={(e) => setUnitFormData({ ...unitFormData, symbol: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Unit usage details..."
                  value={unitFormData.description}
                  onChange={(e) => setUnitFormData({ ...unitFormData, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowUnitModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl">
                  Save Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GOODS RECEIPT MODAL */}
      {showGrnModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Truck className="w-4 h-4 text-emerald-400" />
                <span>Process Goods Receipt Note (GRN)</span>
              </h2>
              <button onClick={() => setShowGrnModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGrnSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Supplier *</label>
                  <select
                    required
                    value={grnSupplierId}
                    onChange={(e) => setGrnSupplierId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Target Warehouse *</label>
                  <select
                    required
                    value={grnWarehouseId}
                    onChange={(e) => setGrnWarehouseId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Purchase Invoice Ref #</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-99881"
                    value={grnPurchaseRef}
                    onChange={(e) => setGrnPurchaseRef(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2 border border-slate-800 p-3 rounded-xl bg-slate-950">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-slate-200 text-xs">Incoming Products</p>
                  <button
                    type="button"
                    onClick={() =>
                      setGrnItems([
                        ...grnItems,
                        { productId: products[0]?.id || '', receivedQuantity: 1, purchasePrice: products[0]?.purchasePrice || 0 },
                      ])
                    }
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold rounded-lg text-[11px] flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {grnItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-5 gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[11px] items-center">
                      <div className="sm:col-span-2">
                        <select
                          value={item.productId}
                          onChange={(e) => {
                            const p = safeProducts.find((prod) => prod.id === e.target.value);
                            const updated = [...grnItems];
                            updated[idx].productId = e.target.value;
                            if (p) updated[idx].purchasePrice = p.purchasePrice;
                            setGrnItems(updated);
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none"
                        >
                          {safeProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <input
                          type="number"
                          step="0.01"
                          required
                          min="0.01"
                          placeholder="Qty"
                          value={item.receivedQuantity}
                          onChange={(e) => {
                            const updated = [...grnItems];
                            updated[idx].receivedQuantity = Number(e.target.value);
                            setGrnItems(updated);
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none font-mono"
                        />
                      </div>

                      <div>
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder="Unit Cost"
                          value={item.purchasePrice}
                          onChange={(e) => {
                            const updated = [...grnItems];
                            updated[idx].purchasePrice = Number(e.target.value);
                            setGrnItems(updated);
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none font-mono"
                        />
                      </div>

                      <div className="flex items-center space-x-1">
                        <input
                          type="text"
                          placeholder="Batch #"
                          value={item.batchNo || ''}
                          onChange={(e) => {
                            const updated = [...grnItems];
                            updated[idx].batchNo = e.target.value;
                            setGrnItems(updated);
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none font-mono text-[10px]"
                        />
                        {grnItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setGrnItems(grnItems.filter((_, i) => i !== idx))}
                            className="p-1 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Receipt Notes</label>
                <textarea
                  rows={2}
                  placeholder="Delivery condition or comments..."
                  value={grnNotes}
                  onChange={(e) => setGrnNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowGrnModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl">
                  Process GRN & Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-400" />
                <span>Inter-Warehouse Stock Transfer</span>
              </h2>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Source Warehouse *</label>
                  <select
                    required
                    value={trfFromWhId}
                    onChange={(e) => setTrfFromWhId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Destination Warehouse *</label>
                  <select
                    required
                    value={trfToWhId}
                    onChange={(e) => setTrfToWhId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2 border border-slate-800 p-3 rounded-xl bg-slate-950">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-slate-200 text-xs">Transfer Items</p>
                  <button
                    type="button"
                    onClick={() => setTrfItems([...trfItems, { productId: products[0]?.id || '', quantity: 1 }])}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold rounded-lg text-[11px] flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {trfItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800 text-[11px] items-center">
                      <div className="col-span-2">
                        <select
                          value={item.productId}
                          onChange={(e) => {
                            const updated = [...trfItems];
                            updated[idx].productId = e.target.value;
                            setTrfItems(updated);
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none"
                        >
                          {safeProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Stock: {p.currentStock} {p.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          step="0.01"
                          required
                          min="0.01"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => {
                            const updated = [...trfItems];
                            updated[idx].quantity = Number(e.target.value);
                            setTrfItems(updated);
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none font-mono"
                        />
                        {trfItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setTrfItems(trfItems.filter((_, i) => i !== idx))}
                            className="p-1 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Transfer Notes</label>
                <textarea
                  rows={2}
                  placeholder="Reason or instructions for transfer..."
                  value={trfNotes}
                  onChange={(e) => setTrfNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl">
                  Confirm Stock Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE WAREHOUSE MODAL */}
      {deletingWh && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-600 border-b border-slate-100 pb-3">
              <AlertCircle className="w-6 h-6 shrink-0 text-red-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-800">Confirm Warehouse Delete</h2>
                <p className="text-[11px] text-slate-500 font-medium">Enterprise Warehouse Management</p>
              </div>
            </div>

            {deletingWhError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs space-y-2">
                <div className="font-bold flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>Cannot Delete Warehouse</span>
                </div>
                <p className="leading-relaxed">{deletingWhError}</p>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <p>
                  Are you sure you want to delete warehouse{' '}
                  <strong className="text-slate-900 font-bold">"{deletingWh.name}"</strong> (Code:{' '}
                  <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-purple-600 font-bold">{deletingWh.code}</code>
                  )?
                </p>
                <p className="text-slate-500 text-[11px]">
                  Warehouses containing active product stock or stock batches cannot be deleted to ensure audit integrity.
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingWh(null);
                  setDeletingWhError(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                {deletingWhError ? 'Close' : 'Cancel'}
              </button>
              {!deletingWhError && (
                <button
                  type="button"
                  onClick={confirmDeleteWh}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/30 text-xs transition-all active:scale-95"
                >
                  Confirm Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE UNIT MODAL */}
      {deletingUnit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-600 border-b border-slate-100 pb-3">
              <AlertCircle className="w-6 h-6 shrink-0 text-red-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-800">Confirm Unit Delete</h2>
                <p className="text-[11px] text-slate-500 font-medium">Measurement Standard</p>
              </div>
            </div>

            {deletingUnitError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs space-y-2">
                <div className="font-bold flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>Cannot Delete Unit</span>
                </div>
                <p className="leading-relaxed">{deletingUnitError}</p>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <p>
                  Are you sure you want to delete unit{' '}
                  <strong className="text-slate-900 font-bold">"{deletingUnit.name}"</strong> ({deletingUnit.symbol})?
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingUnit(null);
                  setDeletingUnitError(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                {deletingUnitError ? 'Close' : 'Cancel'}
              </button>
              {!deletingUnitError && (
                <button
                  type="button"
                  onClick={confirmDeleteUnit}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs"
                >
                  Confirm Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE LOG MODAL */}
      {deletingLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-600 border-b border-slate-100 pb-3">
              <AlertTriangle className="w-6 h-6 shrink-0 text-red-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-800">Confirm Log Delete</h2>
                <p className="text-[11px] text-slate-500 font-medium">Inventory Audit Record</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove log entry for{' '}
              <strong className="text-slate-900 font-bold">"{deletingLog.productName}"</strong> (Ref:{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-blue-600 font-bold">{deletingLog.referenceNo}</code>)?
            </p>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeletingLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteLog}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BARCODE & QR LABEL MODAL */}
      {showBarcodeModal && barcodeProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-purple-600">
                <Barcode className="w-5 h-5" />
                <h2 className="text-sm font-bold text-slate-900">Print Product Labels Sheet</h2>
              </div>
              <button onClick={() => setShowBarcodeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <p className="font-bold text-slate-900">{barcodeProduct.name}</p>
              <div className="flex gap-4 font-mono text-slate-600 text-[11px]">
                <span>SKU: {barcodeProduct.sku}</span>
                <span>Barcode: {barcodeProduct.barcode}</span>
                <span>Price: Rs. {barcodeProduct.salePrice}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Number of Stickers to Print</label>
              <input
                type="number"
                min="1"
                max="100"
                value={labelCount}
                onChange={(e) => setLabelCount(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none"
              />
            </div>

            {/* Sticker Preview Grid */}
            <div className="p-3 bg-slate-100 rounded-xl border border-slate-300 max-h-48 overflow-y-auto grid grid-cols-2 gap-2 text-center text-[10px]">
              {Array.from({ length: Math.min(6, labelCount) }).map((_, i) => (
                <div key={i} className="bg-white p-2 border border-slate-300 rounded shadow-sm space-y-1 font-mono">
                  <p className="font-bold text-slate-900 text-[11px] truncate">{barcodeProduct.name}</p>
                  <div className="bg-black text-white py-1 font-mono font-bold tracking-widest text-[9px]">
                    ||| {barcodeProduct.barcode} |||
                  </div>
                  <p className="text-emerald-700 font-bold">Rs. {barcodeProduct.salePrice}</p>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowBarcodeModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const stickerBoxes = Array.from({ length: labelCount })
                    .map(
                      () => `
                      <div style="border: 1px solid #000; padding: 8px; text-align: center; font-family: monospace; width: 140px; height: 80px; box-sizing: border-box; display: inline-block; margin: 4px;">
                        <div style="font-weight: bold; font-size: 11px; white-space: nowrap; overflow: hidden;">${barcodeProduct.name}</div>
                        <div style="background: #000; color: #fff; font-size: 10px; margin: 4px 0; font-weight: bold;">||| ${barcodeProduct.barcode} |||</div>
                        <div style="font-size: 10px;">Rs. ${barcodeProduct.salePrice}</div>
                      </div>
                    `
                    )
                    .join('');

                  handlePrintSlip(
                    `Barcode Stickers - ${barcodeProduct.name}`,
                    `<div style="display: flex; flex-wrap: wrap;">${stickerBoxes}</div>`
                  );
                  setShowBarcodeModal(false);
                }}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-600/30 text-xs flex items-center space-x-1"
              >
                <Printer className="w-4 h-4" />
                <span>Print Sticker Sheet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV BULK IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-purple-600">
                <Upload className="w-5 h-5" />
                <h2 className="text-sm font-bold text-slate-900">Bulk CSV Inventory Import</h2>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p>
                Paste your CSV data below or upload a CSV file with header format:
              </p>
              <div className="p-2.5 bg-slate-100 rounded-lg font-mono text-[11px] text-slate-800 overflow-x-auto border border-slate-200">
                SKU, Barcode, Product Name, Category, Unit, Purchase Price, Sale Price, Current Stock, Min Stock
              </div>
            </div>

            <form onSubmit={handleCsvImportSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Select File or Paste Content</label>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setImportFileContent((event.target?.result as string) || '');
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
              </div>

              <div className="space-y-1">
                <textarea
                  rows={6}
                  placeholder={`SKU,Barcode,Product Name,Category,Unit,Purchase Price,Sale Price,Current Stock,Min Stock
SKU-001,BAR-001,Fresh Bread 400g,Bakery,pcs,80,120,50,10
SKU-002,BAR-002,Chocolate Cake 1kg,Cakes,pcs,800,1200,15,5`}
                  value={importFileContent}
                  onChange={(e) => setImportFileContent(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 font-mono focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importing}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-600/30 text-xs flex items-center space-x-1 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>{importing ? 'Importing Data...' : 'Import CSV Data'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
