import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { printBridgeService, PrintEnvironmentState } from '../../services/printBridgeService';
import { BusinessSettings, Branch, PaymentMethodConfig } from '../../types/pos';
import { useAuth } from '../../context/AuthContext';
import { BarcodeImage } from '../common/BarcodeImage';
import {
  Settings as SettingsIcon,
  Save,
  CheckCircle,
  Store,
  Plus,
  Trash2,
  Edit,
  X,
  Building2,
  Shield,
  Power,
  AlertTriangle,
  Printer,
  DollarSign,
  Package,
  ShoppingCart,
  CreditCard,
  FileText,
  Users,
  Bell,
  Database,
  Lock,
  Upload,
  RefreshCw,
  Monitor,
  Info,
  Terminal,
  Copy,
  Eye,
  CheckCircle2,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { user, refreshBranches } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'general' | 'inventory' | 'sales' | 'register' | 'payments' | 'receipt' | 'products' | 'customer' | 'security' | 'notifications' | 'branches' | 'backup'
  >('general');

  const [settings, setSettings] = useState<BusinessSettings>({
    name: 'Unique Sweets & Bakers',
    logoUrl: '',
    tagline: 'Freshly Baked & Authentic Sweets',
    address: 'Main Boulevard, Suite 100, Unique Tower',
    phone: '+92 300 1234567',
    email: 'info@uniquesweets.com',
    taxNumber: 'NTN-9988776-6',
    currency: 'PKR',
    currencySymbol: 'Rs.',
    decimalPlaces: 2,
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '12h',
    timezone: 'Asia/Karachi',
    taxPercentage: 0,
    defaultCustomer: 'Walk-in Customer',
    defaultBranch: 'branch-head-office',
    defaultRegister: 'reg-001',
    invoicePrefix: 'USB-',
    receiptHeader: 'UNIQUE SWEETS & BAKERS\nAuthentic Bakery & Confectionery',
    receiptFooter: 'Thank you for choosing Unique Sweets & Bakers! Freshly baked daily.',
    returnPolicyText: 'Returns/Exchange allowed within 24 hours with original receipt.',
    thermalPrinterWidth: '80mm',
    autoPrintReceipt: true,
    printCopies: 1,
    showLogo: true,
    showBusinessAddress: true,
    showPhone: true,
    showTax: true,
    showCashierName: true,
    showCustomer: true,
    enableKitchenRouting: true,
    allowNegativeStock: false,
    allowSellingOutOfStock: false,
    allowStockAdjustment: true,
    requireReasonForAdjustment: true,
    lowStockThreshold: 10,
    batchTracking: true,
    expiryTracking: true,
    stockConsumptionMode: 'FIFO',
    autoDeductOnSale: true,
    autoRestoreOnVoid: true,
    requireManagerApprovalForNegativeStock: true,
    enableDiscounts: true,
    maxCashierDiscountPercent: 10,
    requireManagerApprovalDiscount: true,
    allowPriceOverride: false,
    requireManagerApprovalPriceOverride: true,
    allowHeldOrders: true,
    maxHeldOrders: 20,
    allowSalesReturns: true,
    returnRequiresManagerApproval: true,
    allowInvoiceVoid: true,
    voidRequiresReason: true,
    defaultPaymentMethod: 'CASH',
    autoFocusBarcodeScanner: true,
    enableRegisterSessions: true,
    requireOpeningCash: true,
    allowCashierOpenRegister: true,
    allowCashInCashOut: true,
    requireReasonCashInCashOut: true,
    requireClosingCashCount: true,
    allowClosingWithVariance: true,
    maxAllowedVariance: 500,
    requireManagerApprovalHighVariance: true,
    autoGenerateZReport: true,
    paymentMethods: [
      { id: 'CASH', name: 'Cash', enabled: true, requiresReference: false, accountMapping: 'Cash in Hand' },
      { id: 'CARD', name: 'Debit/Credit Card', enabled: true, requiresReference: true, accountMapping: 'POS Bank Account' },
      { id: 'JAZZCASH', name: 'JazzCash', enabled: true, requiresReference: true, accountMapping: 'JazzCash Merchant' },
      { id: 'EASYPAISA', name: 'Easypaisa', enabled: true, requiresReference: true, accountMapping: 'Easypaisa Merchant' },
      { id: 'BANK', name: 'Bank Transfer', enabled: true, requiresReference: true, accountMapping: 'Main Bank Account' },
      { id: 'CREDIT', name: 'Customer Credit', enabled: true, requiresReference: false, accountMapping: 'Accounts Receivable' },
      { id: 'OTHER', name: 'Other Voucher', enabled: false, requiresReference: true, accountMapping: 'Other Accounts' },
    ],
    defaultUnit: 'pcs',
    requireSKU: false,
    requireBarcode: false,
    allowDuplicateBarcode: false,
    showCostPriceToCashier: false,
    allowWalkInCustomer: true,
    requireCustomerForCreditSale: true,
    defaultCreditLimit: 50000,
    sessionTimeoutMinutes: 60,
    minPasswordLength: 6,
    maxFailedLogins: 5,
    enableAuditLogging: true,
    lowStockAlerts: true,
    expiryAlerts: true,
    registerVarianceAlerts: true,
    failedLoginAlerts: true,
    theme: 'dark',
    branchName: 'Head Office',
    counterName: 'Counter 01',
  });

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Branch Modal State
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);

  const [formBranch, setFormBranch] = useState({
    branchName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    manager: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    isHeadOffice: false,
  });

  // Restore State
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  // Hardware & Print Simulation State
  const [hardwareStatus, setHardwareStatus] = useState<{
    bridgeOnline: boolean;
    isCloudPreview: boolean;
    state: PrintEnvironmentState;
    printerStatusText: string;
    printBridgeUrl: string;
  } | null>(null);
  const [showTsplModal, setShowTsplModal] = useState(false);
  const [tsplSimulationData, setTsplSimulationData] = useState<{
    commands: string;
    dimensions: string;
    barcodeType: string;
    productName: string;
    barcode: string;
    sku: string;
    price: number;
    copies: number;
  } | null>(null);
  const [copiedTspl, setCopiedTspl] = useState(false);
  const [isTestingMinimal, setIsTestingMinimal] = useState(false);
  const [isTestingCode128, setIsTestingCode128] = useState(false);
  const [isTestingText, setIsTestingText] = useState(false);
  const [isTestingLabel, setIsTestingLabel] = useState(false);

  useEffect(() => {
    loadSettings();
    loadBranchesList();
    loadHardwareStatus();
  }, []);

  const loadHardwareStatus = async () => {
    try {
      const health = await printBridgeService.checkHealth(settings.printBridgeUrl);
      setHardwareStatus({
        bridgeOnline: health.connected,
        isCloudPreview: health.state === 'CLOUD_PREVIEW',
        state: health.state,
        printerStatusText: health.printerStatusText,
        printBridgeUrl: settings.printBridgeUrl || 'http://127.0.0.1:9100',
      });
    } catch (e) {
      setHardwareStatus({
        bridgeOnline: false,
        isCloudPreview: true,
        state: 'CLOUD_PREVIEW',
        printerStatusText: 'CLOUD PREVIEW — LOCAL PRINTER ACCESS UNAVAILABLE',
        printBridgeUrl: settings.printBridgeUrl || 'http://127.0.0.1:9100',
      });
    }
  };

  const loadSettings = async () => {
    try {
      const data = await apiFetch<BusinessSettings>('/settings');
      if (data) setSettings((prev) => ({ ...prev, ...data }));
    } catch (e) {
      console.error(e);
    }
  };

  const loadBranchesList = async () => {
    setLoadingBranches(true);
    try {
      const data = await apiFetch<Branch[]>('/branches');
      setBranches(data || []);
      await refreshBranches();
    } catch (e) {
      console.error('Failed to fetch branches:', e);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleSubmitSettings = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    try {
      await apiFetch('/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    }
  };

  const handleTestPrint = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    const testWindow = window.open('', 'Printer Test', 'width=350,height=500');
    if (testWindow) {
      testWindow.document.write(`
        <html>
          <head>
            <style>
              body { font-family: monospace; font-size: 12px; margin: 10px; width: ${settings.thermalPrinterWidth === '58mm' ? '200px' : '280px'}; }
              .center { text-align: center; }
              .bold { font-weight: bold; }
              .line { border-bottom: 1px dashed #000; margin: 8px 0; }
            </style>
          </head>
          <body>
            <div class="center bold">${settings.name}</div>
            <div class="center">${settings.tagline}</div>
            <div class="center">${settings.phone}</div>
            <div class="line"></div>
            <div class="center bold">PRINTER TEST PAGE</div>
            <div>Printer Width: ${settings.thermalPrinterWidth}</div>
            <div>Date: ${new Date().toLocaleString()}</div>
            <div>Auto-Print Status: ${settings.autoPrintReceipt ? 'ENABLED' : 'DISABLED'}</div>
            <div class="line"></div>
            <div class="center">${settings.receiptFooter}</div>
          </body>
        </html>
      `);
      testWindow.document.close();
      testWindow.print();
    }
  };

  const handleOpenTsplSimulation = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    const res = await printBridgeService.printLabel({
      productName: 'Mixed Mithai Box 1kg',
      barcode: 'USB-8839201',
      sku: 'MMB-1000',
      price: 1850,
      copies: settings.printCopies || 1,
      labelWidthMm: settings.labelWidthMm || 50,
      labelHeightMm: settings.labelHeightMm || 30,
      printerName: settings.labelPrinter || 'TSC TTP-244 Pro',
      bridgeUrl: settings.printBridgeUrl || 'http://127.0.0.1:9100',
    });

    setTsplSimulationData({
      commands: res.tsplCommands,
      dimensions: res.details.dimensions,
      barcodeType: res.details.barcodeType,
      productName: res.details.productName,
      barcode: res.details.barcode,
      sku: res.details.sku,
      price: res.details.price,
      copies: res.details.copies,
    });
    setShowTsplModal(true);
  };

  const handleTestLabelPrint = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (isTestingLabel) return;
    setIsTestingLabel(true);

    try {
      const res = await printBridgeService.testPrint(
        settings.labelPrinter || 'TSC TTP-244 Pro',
        settings.printBridgeUrl || 'http://127.0.0.1:9100'
      );

      if (res.isSimulation) {
        setTsplSimulationData({
          commands: res.tsplCommands,
          dimensions: res.details.dimensions,
          barcodeType: res.details.barcodeType,
          productName: res.details.productName,
          barcode: res.details.barcode,
          sku: res.details.sku,
          price: res.details.price,
          copies: res.details.copies,
        });
        setShowTsplModal(true);
      } else if (res.state === 'LOCAL_BRIDGE_OFFLINE') {
        alert('LOCAL TSC PRINT BRIDGE OFFLINE — Please start the TSC Print Bridge.');
      } else {
        if (res.success) {
          alert(`Printer Diagnostic Test Submitted Successfully to Windows Spooler on "${settings.labelPrinter || 'TSC TTP-244 Pro'}"!\nBytes: ${res.byteCount || 0} | First Byte: ${res.firstByteHex || 'N/A'} | Last Byte: ${res.lastByteHex || 'N/A'}\n\nNote: RAW TSPL commands sent to spooler. Check physical printer output.`);
        } else {
          alert(`Physical print failed: ${res.message}`);
        }
      }
    } catch (err: any) {
      alert(`Diagnostic test error: ${err.message || err}`);
    } finally {
      setIsTestingLabel(false);
    }
  };

  const handleRawTextTest = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (isTestingText) return;
    setIsTestingText(true);

    try {
      const res = await printBridgeService.sendRawTextTest(
        settings.labelPrinter || 'TSC TTP-244 Pro',
        settings.printBridgeUrl || 'http://127.0.0.1:9100'
      );

      if (res.isSimulation) {
        setTsplSimulationData({
          commands: res.tsplCommands,
          dimensions: res.details.dimensions,
          barcodeType: res.details.barcodeType,
          productName: res.details.productName,
          barcode: res.details.barcode,
          sku: res.details.sku,
          price: res.details.price,
          copies: res.details.copies,
        });
        setShowTsplModal(true);
      } else if (res.state === 'LOCAL_BRIDGE_OFFLINE') {
        alert('LOCAL TSC PRINT BRIDGE OFFLINE — Please start the TSC Print Bridge.');
      } else {
        if (res.success) {
          alert(`RAW TEXT TEST Submitted Successfully on "${settings.labelPrinter || 'TSC TTP-244 Pro'}"!\nBytes: ${res.byteCount || 0} | First Byte: ${res.firstByteHex || 'N/A'} | Last Byte: ${res.lastByteHex || 'N/A'}`);
        } else {
          alert(`RAW TEXT TEST failed: ${res.message}`);
        }
      }
    } catch (err: any) {
      alert(`RAW TEXT TEST error: ${err.message || err}`);
    } finally {
      setIsTestingText(false);
    }
  };

  const handleRawCode128Test = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (isTestingCode128) return;
    setIsTestingCode128(true);

    try {
      const res = await printBridgeService.sendRawCode128Test(
        settings.labelPrinter || 'TSC TTP-244 Pro',
        settings.printBridgeUrl || 'http://127.0.0.1:9100'
      );

      if (res.isSimulation) {
        setTsplSimulationData({
          commands: res.tsplCommands,
          dimensions: res.details.dimensions,
          barcodeType: res.details.barcodeType,
          productName: res.details.productName,
          barcode: res.details.barcode,
          sku: res.details.sku,
          price: res.details.price,
          copies: res.details.copies,
        });
        setShowTsplModal(true);
      } else if (res.state === 'LOCAL_BRIDGE_OFFLINE') {
        alert('LOCAL TSC PRINT BRIDGE OFFLINE — Please start the TSC Print Bridge.');
      } else {
        if (res.success) {
          alert(`RAW CODE128 / Printer Diagnostic Submitted Successfully on "${settings.labelPrinter || 'TSC TTP-244 Pro'}"!\nBytes: ${res.byteCount || 0} | First Byte: ${res.firstByteHex || 'N/A'} | Last Byte: ${res.lastByteHex || 'N/A'}\n\nPayload sent to Windows printer spooler. Check physical printer output.`);
        } else {
          alert(`Printer Diagnostic failed: ${res.message}`);
        }
      }
    } catch (err: any) {
      alert(`Printer Diagnostic error: ${err.message || err}`);
    } finally {
      setIsTestingCode128(false);
    }
  };

  const handleRawMinimalTest = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (isTestingMinimal) return;
    setIsTestingMinimal(true);

    try {
      const res = await printBridgeService.sendRawMinimalTest(
        settings.labelPrinter || 'TSC TTP-244 Pro',
        settings.printBridgeUrl || 'http://127.0.0.1:9100'
      );

      if (res.isSimulation) {
        setTsplSimulationData({
          commands: res.tsplCommands,
          dimensions: res.details.dimensions,
          barcodeType: res.details.barcodeType,
          productName: res.details.productName,
          barcode: res.details.barcode,
          sku: res.details.sku,
          price: res.details.price,
          copies: res.details.copies,
        });
        setShowTsplModal(true);
      } else if (res.state === 'LOCAL_BRIDGE_OFFLINE') {
        alert('LOCAL TSC PRINT BRIDGE OFFLINE — Please start the TSC Print Bridge.');
      } else {
        if (res.success) {
          alert(`RAW MINIMAL TEST Submitted Successfully to Windows Spooler on "${settings.labelPrinter || 'TSC TTP-244 Pro'}"!\nBytes: ${res.byteCount || 0} | First Byte: ${res.firstByteHex || 'N/A'} | Last Byte: ${res.lastByteHex || 'N/A'}\n\nNote: Data submitted to Windows printer spooler. Check physical printer output.`);
        } else {
          alert(`RAW MINIMAL TEST failed: ${res.message}`);
        }
      }
    } catch (err: any) {
      alert(`RAW MINIMAL TEST error: ${err.message || err}`);
    } finally {
      setIsTestingMinimal(false);
    }
  };

  const handleBackupDownload = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    try {
      const dbData = await apiFetch<any>('/settings/backup');
      const blob = new Blob([JSON.stringify(dbData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unique_sweets_pos_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || 'Failed to generate database backup download');
    }
  };

  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreFile) return;

    try {
      setRestoreStatus('Reading backup file...');
      const text = await restoreFile.text();
      const backupObj = JSON.parse(text);

      setRestoreStatus('Restoring database...');
      await apiFetch('/settings/restore', {
        method: 'POST',
        body: JSON.stringify(backupObj),
      });

      alert('Database restored successfully! Reloading system state.');
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to restore database from backup file.');
      setRestoreStatus(null);
    }
  };

  // Branch CRUD
  const handleOpenCreateModal = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    setEditingBranch(null);
    setFormBranch({
      branchName: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      manager: '',
      status: 'ACTIVE',
      isHeadOffice: branches.length === 0,
    });
    setErrorMessage(null);
    setShowBranchModal(true);
  };

  const handleOpenEditModal = (b: Branch, e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    setEditingBranch(b);
    setFormBranch({
      branchName: b.branchName || b.name || '',
      phone: b.phone || '',
      email: b.email || '',
      address: b.address || '',
      city: b.city || '',
      manager: b.manager || '',
      status: b.status || 'ACTIVE',
      isHeadOffice: Boolean(b.isHeadOffice || b.isMain),
    });
    setErrorMessage(null);
    setShowBranchModal(true);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBranch.branchName.trim()) {
      setErrorMessage('Branch Name is required.');
      return;
    }

    try {
      if (editingBranch) {
        await apiFetch(`/branches/${editingBranch.id}`, {
          method: 'PUT',
          body: JSON.stringify(formBranch),
        });
      } else {
        await apiFetch('/branches', {
          method: 'POST',
          body: JSON.stringify(formBranch),
        });
      }
      setShowBranchModal(false);
      await loadBranchesList();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save branch.');
    }
  };

  const handleDeleteBranch = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!deletingBranch) return;
    try {
      await apiFetch(`/branches/${deletingBranch.id}`, { method: 'DELETE' });
      setDeletingBranch(null);
      await loadBranchesList();
    } catch (err: any) {
      alert(err.message || 'Failed to delete branch.');
    }
  };

  // Permission Guard for Cashier
  if (user && user.role === 'CASHIER') {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-400">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">Access Denied: Settings Restricted</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            System Settings & Configuration Center is reserved exclusively for Administrators and Managers. Cashier accounts cannot view or modify business settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-blue-400" />
            <span>POS / ERP Central Settings & Configuration</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Database-driven global parameters for business, stock, checkout, payment, printing & security
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {savedSuccess && (
            <span className="flex items-center space-x-1 text-emerald-400 font-bold text-xs bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl animate-fade-in">
              <CheckCircle className="w-4 h-4" />
              <span>Settings Saved Real-Time!</span>
            </span>
          )}
          <button
            type="button"
            onClick={(e) => handleSubmitSettings(e)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center space-x-2 text-xs transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-800">
        {[
          { id: 'general', label: 'General / Business', icon: Store },
          { id: 'inventory', label: 'Inventory Rules', icon: Package },
          { id: 'sales', label: 'Sales & POS', icon: ShoppingCart },
          { id: 'register', label: 'Register & Drawer', icon: DollarSign },
          { id: 'payments', label: 'Payment Methods', icon: CreditCard },
          { id: 'receipt', label: 'Receipt & Printing', icon: Printer },
          { id: 'products', label: 'Product Defaults', icon: FileText },
          { id: 'customer', label: 'Customer Rules', icon: Users },
          { id: 'security', label: 'User & Security', icon: Shield },
          { id: 'notifications', label: 'Alerts', icon: Bell },
          { id: 'branches', label: 'Branches & Outlets', icon: Building2 },
          { id: 'backup', label: 'Backup & Restore', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={(e) => {
                e.preventDefault();
                setActiveTab(tab.id as any);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center space-x-2 transition-all shrink-0 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Areas */}
      <form onSubmit={handleSubmitSettings}>
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Store className="w-4 h-4 text-blue-400" />
              <span>Business Profile & Regional Settings</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Business Name *</label>
                <input
                  type="text"
                  required
                  value={settings.name}
                  onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Business Tagline</label>
                <input
                  type="text"
                  value={settings.tagline}
                  onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Tax Reg. NTN / STRN</label>
                <input
                  type="text"
                  value={settings.taxNumber}
                  onChange={(e) => setSettings({ ...settings, taxNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Official Email</label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={settings.currencySymbol}
                  onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-400 font-semibold mb-1">Business Physical Address</label>
                <input
                  type="text"
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Default Sales Tax Rate (%)</label>
                <input
                  type="number"
                  value={settings.taxPercentage}
                  onChange={(e) => setSettings({ ...settings, taxPercentage: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* INVENTORY SETTINGS TAB */}
        {activeTab === 'inventory' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Package className="w-4 h-4 text-emerald-400" />
              <span>Inventory Control & Stock Consumption Rules</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">Allow Negative Stock</div>
                  <div className="text-[11px] text-slate-500">Allow selling items when available inventory quantity is 0 or less</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowNegativeStock || false}
                  onChange={(e) => setSettings({ ...settings, allowNegativeStock: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">Auto Deduct Stock on Sale</div>
                  <div className="text-[11px] text-slate-500">Automatically reduce stock ledger immediately when sale checkout occurs</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoDeductOnSale !== false}
                  onChange={(e) => setSettings({ ...settings, autoDeductOnSale: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">Auto Restore Stock on Sale Void/Return</div>
                  <div className="text-[11px] text-slate-500">Return items to available inventory when invoice is voided or returned</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoRestoreOnVoid !== false}
                  onChange={(e) => setSettings({ ...settings, autoRestoreOnVoid: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">Batch & Expiry Tracking</div>
                  <div className="text-[11px] text-slate-500">Track manufacture batches and product shelf expiry dates</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.expiryTracking !== false}
                  onChange={(e) => setSettings({ ...settings, expiryTracking: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                <label className="block text-slate-200 font-bold">Stock Consumption Strategy</label>
                <select
                  value={settings.stockConsumptionMode || 'FIFO'}
                  onChange={(e) => setSettings({ ...settings, stockConsumptionMode: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                >
                  <option value="FIFO">First-In, First-Out (FIFO)</option>
                  <option value="FEFO">First-Expired, First-Out (FEFO - Bakery Default)</option>
                  <option value="LIFO">Last-In, First-Out (LIFO)</option>
                </select>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                <label className="block text-slate-200 font-bold">Low Stock Warning Threshold Qty</label>
                <input
                  type="number"
                  value={settings.lowStockThreshold || 10}
                  onChange={(e) => setSettings({ ...settings, lowStockThreshold: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-bold"
                />
              </div>
            </div>
          </div>
        )}

        {/* SALES & POS SETTINGS TAB */}
        {activeTab === 'sales' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-800 pb-3">
              <ShoppingCart className="w-4 h-4 text-purple-400" />
              <span>Checkout, Discounts & Invoice Formatting</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Invoice Prefix</label>
                <input
                  type="text"
                  value={settings.invoicePrefix}
                  onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Max Cashier Discount Limit (%)</label>
                <input
                  type="number"
                  value={settings.maxCashierDiscountPercent || 10}
                  onChange={(e) => setSettings({ ...settings, maxCashierDiscountPercent: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Maximum Held Sales Orders</label>
                <input
                  type="number"
                  value={settings.maxHeldOrders || 20}
                  onChange={(e) => setSettings({ ...settings, maxHeldOrders: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-bold"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between col-span-full md:col-span-1">
                <div>
                  <div className="font-bold text-slate-200">Require Manager Approval for Discount &gt; Limit</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.requireManagerApprovalDiscount !== false}
                  onChange={(e) => setSettings({ ...settings, requireManagerApprovalDiscount: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between col-span-full md:col-span-1">
                <div>
                  <div className="font-bold text-slate-200">Auto Focus Barcode Input on POS Load</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoFocusBarcodeScanner !== false}
                  onChange={(e) => setSettings({ ...settings, autoFocusBarcodeScanner: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between col-span-full md:col-span-1">
                <div>
                  <div className="font-bold text-slate-200">Allow Invoice Voiding</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowInvoiceVoid !== false}
                  onChange={(e) => setSettings({ ...settings, allowInvoiceVoid: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* REGISTER & DRAWER TAB */}
        {activeTab === 'register' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-800 pb-3">
              <DollarSign className="w-4 h-4 text-amber-400" />
              <span>Shift Register Sessions & Cash Drawer Safeguards</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">Require Register Session Opening</div>
                  <div className="text-[11px] text-slate-500">Block billing until cashier opens active shift session with opening cash balance</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableRegisterSessions !== false}
                  onChange={(e) => setSettings({ ...settings, enableRegisterSessions: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">Require Cash In / Cash Out Reason</div>
                  <div className="text-[11px] text-slate-500">Force cashier to log note for petty cash drawer drops or additions</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.requireReasonCashInCashOut !== false}
                  onChange={(e) => setSettings({ ...settings, requireReasonCashInCashOut: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                <label className="block text-slate-200 font-bold">Maximum Allowed Cash Variance Limit (PKR)</label>
                <input
                  type="number"
                  value={settings.maxAllowedVariance || 500}
                  onChange={(e) => setSettings({ ...settings, maxAllowedVariance: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-bold"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">Auto Generate Z-Report on Close</div>
                  <div className="text-[11px] text-slate-500">Generate and archive shift summary Z-Report automatically when cashier closes shift</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoGenerateZReport !== false}
                  onChange={(e) => setSettings({ ...settings, autoGenerateZReport: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* PAYMENT METHODS TAB */}
        {activeTab === 'payments' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-800 pb-3">
              <CreditCard className="w-4 h-4 text-cyan-400" />
              <span>Dynamic Payment Methods & Account Mapping</span>
            </h2>

            <div className="space-y-3">
              {(settings.paymentMethods || []).map((pm, idx) => (
                <div key={pm.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
                  <div className="flex items-center space-x-3 shrink-0">
                    <input
                      type="checkbox"
                      checked={pm.enabled}
                      onChange={(e) => {
                        const updated = [...(settings.paymentMethods || [])];
                        updated[idx].enabled = e.target.checked;
                        setSettings({ ...settings, paymentMethods: updated });
                      }}
                      className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    />
                    <div>
                      <input
                        type="text"
                        value={pm.name}
                        onChange={(e) => {
                          const updated = [...(settings.paymentMethods || [])];
                          updated[idx].name = e.target.value;
                          setSettings({ ...settings, paymentMethods: updated });
                        }}
                        className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg font-bold text-slate-100"
                      />
                      <span className="text-[10px] text-slate-500 font-mono ml-2">ID: {pm.id}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pm.requiresReference}
                        onChange={(e) => {
                          const updated = [...(settings.paymentMethods || [])];
                          updated[idx].requiresReference = e.target.checked;
                          setSettings({ ...settings, paymentMethods: updated });
                        }}
                        className="w-4 h-4 accent-blue-600 rounded"
                      />
                      <span>Requires Ref #</span>
                    </label>

                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500">Account:</span>
                      <input
                        type="text"
                        value={pm.accountMapping || ''}
                        onChange={(e) => {
                          const updated = [...(settings.paymentMethods || [])];
                          updated[idx].accountMapping = e.target.value;
                          setSettings({ ...settings, paymentMethods: updated });
                        }}
                        placeholder="e.g. POS Bank Account"
                        className="bg-slate-900 border border-slate-700 px-3 py-1 rounded-lg text-slate-300 w-48"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RECEIPT & PRINT TAB */}
        {activeTab === 'receipt' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Thermal Printer & Receipt Layout Customization</span>
              </h2>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={(e) => handleOpenTsplSimulation(e)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  <span>TSPL Simulation Preview</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTestLabelPrint(e);
                  }}
                  disabled={isTestingLabel}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isTestingLabel ? 'Sending...' : 'Test Label (Minimal)'}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRawMinimalTest(e);
                  }}
                  disabled={isTestingMinimal}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 text-white border border-emerald-500/50 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-200" />
                  <span>{isTestingMinimal ? 'Sending...' : 'MINIMAL TSC TEXT + CODE128 TEST'}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRawCode128Test(e);
                  }}
                  disabled={isTestingCode128}
                  className="px-3 py-2 bg-amber-900/80 hover:bg-amber-800 disabled:bg-slate-700 text-amber-100 border border-amber-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isTestingCode128 ? 'Sending...' : 'Printer Diagnostic'}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRawTextTest(e);
                  }}
                  disabled={isTestingText}
                  className="px-3 py-2 bg-purple-900/80 hover:bg-purple-800 disabled:bg-slate-700 text-purple-100 border border-purple-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
                >
                  <Terminal className="w-3.5 h-3.5 text-purple-300" />
                  <span>{isTestingText ? 'Sending...' : 'RAW TEXT TEST'}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleTestPrint(e)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold flex items-center space-x-1.5 border border-slate-700 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Test Receipt</span>
                </button>
              </div>
            </div>

            {/* HARDWARE ENVIRONMENT & PRINTER STATUS BANNER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
              {/* MODE 1: CLOUD PREVIEW */}
              <div
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  hardwareStatus?.state === 'CLOUD_PREVIEW'
                    ? 'bg-blue-950/40 border-blue-500/50 text-blue-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-blue-400" />
                    CLOUD PREVIEW / SIMULATION MODE
                  </span>
                  {hardwareStatus?.state === 'CLOUD_PREVIEW' && (
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 font-bold text-[10px] rounded-full border border-blue-500/30">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-[11px] opacity-90 leading-relaxed mb-3">
                  Running in AI Studio cloud preview. Local 127.0.0.1:9100 print bridge calls are safely bypassed. TSPL label compilation, CODE128 barcodes, and 50×30mm label diagnostics are fully testable in simulation.
                </p>
                <div className="font-semibold text-blue-300 text-[11px] flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>CLOUD PREVIEW — LOCAL PRINTER ACCESS UNAVAILABLE</span>
                </div>
              </div>

              {/* MODE 2: WINDOWS LOCAL HARDWARE */}
              <div
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  hardwareStatus?.state === 'LOCAL_BRIDGE_CONNECTED'
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                    : hardwareStatus?.state === 'LOCAL_BRIDGE_OFFLINE'
                    ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    WINDOWS LOCAL HARDWARE PRINTING
                  </span>
                  {hardwareStatus?.state === 'LOCAL_BRIDGE_CONNECTED' && (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-bold text-[10px] rounded-full border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      CONNECTED
                    </span>
                  )}
                  {hardwareStatus?.state === 'LOCAL_BRIDGE_OFFLINE' && (
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 font-bold text-[10px] rounded-full border border-amber-500/30">
                      OFFLINE
                    </span>
                  )}
                </div>
                <p className="text-[11px] opacity-90 leading-relaxed mb-3">
                  Communicates directly with the Windows TSC Print Bridge running at 127.0.0.1:9100 via RAW WritePrinter Win32 spooler API.
                </p>
                <div
                  className={`font-semibold text-[11px] flex items-center gap-1.5 ${
                    hardwareStatus?.state === 'LOCAL_BRIDGE_CONNECTED'
                      ? 'text-emerald-300'
                      : hardwareStatus?.state === 'LOCAL_BRIDGE_OFFLINE'
                      ? 'text-amber-300'
                      : 'text-slate-500'
                  }`}
                >
                  <Printer className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {hardwareStatus?.state === 'LOCAL_BRIDGE_CONNECTED'
                      ? `LOCAL TSC PRINT BRIDGE CONNECTED — ${settings.labelPrinter || 'TSC TTP-244 Pro'} Ready`
                      : hardwareStatus?.state === 'LOCAL_BRIDGE_OFFLINE'
                      ? `LOCAL TSC PRINT BRIDGE OFFLINE (${settings.printBridgeUrl || 'http://127.0.0.1:9100'})`
                      : `Physical printer unavailable in Cloud Preview`}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Assigned Label Printer (Windows)</label>
                <input
                  type="text"
                  value={settings.labelPrinter || 'TSC TTP-244 Pro'}
                  onChange={(e) => setSettings({ ...settings, labelPrinter: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-bold"
                  placeholder="e.g. TSC TTP-244 Pro"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Assigned Receipt Printer (POS)</label>
                <input
                  type="text"
                  value={settings.receiptPrinter || 'POS-80 Thermal Receipt Printer'}
                  onChange={(e) => setSettings({ ...settings, receiptPrinter: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-bold"
                  placeholder="e.g. POS-80 Thermal"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Local Print Bridge URL (Agent)</label>
                <input
                  type="text"
                  value={settings.printBridgeUrl || 'http://127.0.0.1:9100'}
                  onChange={(e) => setSettings({ ...settings, printBridgeUrl: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono"
                  placeholder="http://127.0.0.1:9100"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Label Dimensions (Width x Height mm)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={settings.labelWidthMm || 50}
                    onChange={(e) => setSettings({ ...settings, labelWidthMm: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono font-bold"
                    placeholder="Width mm"
                  />
                  <input
                    type="number"
                    value={settings.labelHeightMm || 30}
                    onChange={(e) => setSettings({ ...settings, labelHeightMm: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono font-bold"
                    placeholder="Height mm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Receipt Paper Format</label>
                <select
                  value={settings.thermalPrinterWidth}
                  onChange={(e) => setSettings({ ...settings, thermalPrinterWidth: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-bold"
                >
                  <option value="80mm">80mm Standard Thermal Slip</option>
                  <option value="58mm">58mm Compact Thermal Slip</option>
                  <option value="A4">A4 Full Page Invoice</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Print Copies</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={settings.printCopies || 1}
                  onChange={(e) => setSettings({ ...settings, printCopies: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-bold"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-400 font-semibold mb-1">Receipt Header Text</label>
                <textarea
                  rows={2}
                  value={settings.receiptHeader || ''}
                  onChange={(e) => setSettings({ ...settings, receiptHeader: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-400 font-semibold mb-1">Receipt Footer Greeting</label>
                <textarea
                  rows={2}
                  value={settings.receiptFooter}
                  onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-400 font-semibold mb-1">Return / Exchange Policy</label>
                <input
                  type="text"
                  value={settings.returnPolicyText || ''}
                  onChange={(e) => setSettings({ ...settings, returnPolicyText: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>
            </div>
          </div>
        )}

        {/* PRODUCT DEFAULTS TAB */}
        {activeTab === 'products' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-800 pb-3">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Product Defaults & Catalog Behavior</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">Allow Duplicate Barcodes</div>
                  <div className="text-[11px] text-slate-500">Default OFF. Prevents duplicate barcode creation for product integrity</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowDuplicateBarcode || false}
                  onChange={(e) => setSettings({ ...settings, allowDuplicateBarcode: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">Show Cost Price to Cashier</div>
                  <div className="text-[11px] text-slate-500">Allow cashier role to view product purchase cost in search results</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showCostPriceToCashier || false}
                  onChange={(e) => setSettings({ ...settings, showCostPriceToCashier: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMER RULES TAB */}
        {activeTab === 'customer' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Customer Account & Credit Limits</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Default Walk-In Customer Name</label>
                <input
                  type="text"
                  value={settings.defaultCustomer || 'Walk-in Customer'}
                  onChange={(e) => setSettings({ ...settings, defaultCustomer: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Default Customer Credit Limit (PKR)</label>
                <input
                  type="number"
                  value={settings.defaultCreditLimit || 50000}
                  onChange={(e) => setSettings({ ...settings, defaultCreditLimit: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-bold"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Shield className="w-4 h-4 text-rose-400" />
              <span>Authentication Policies & Audit Logging</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Session Inactivity Timeout (Minutes)</label>
                <input
                  type="number"
                  value={settings.sessionTimeoutMinutes || 60}
                  onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Minimum Password Length</label>
                <input
                  type="number"
                  value={settings.minPasswordLength || 6}
                  onChange={(e) => setSettings({ ...settings, minPasswordLength: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-bold"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between col-span-full">
                <div>
                  <div className="font-bold text-slate-200">Enable Audit Logging</div>
                  <div className="text-[11px] text-slate-500">Record all critical actions, sales voids, price changes, and configuration updates</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableAuditLogging !== false}
                  onChange={(e) => setSettings({ ...settings, enableAuditLogging: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* ALERTS TAB */}
        {activeTab === 'notifications' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Bell className="w-4 h-4 text-amber-400" />
              <span>Real-Time Alert Notifications</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">Low Stock Threshold Notifications</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.lowStockAlerts !== false}
                  onChange={(e) => setSettings({ ...settings, lowStockAlerts: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">Expiry Date Alerts</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.expiryAlerts !== false}
                  onChange={(e) => setSettings({ ...settings, expiryAlerts: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-200">Register Cash Variance Alerts</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.registerVarianceAlerts !== false}
                  onChange={(e) => setSettings({ ...settings, registerVarianceAlerts: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* BRANCHES TAB */}
        {activeTab === 'branches' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-sky-400" />
                <span>Multi-Branch & Outlet Directory</span>
              </h2>

              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-blue-600/30 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add Branch Outlet</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Code / Name</th>
                    <th className="p-3">Manager</th>
                    <th className="p-3">Phone / Email</th>
                    <th className="p-3">City / Address</th>
                    <th className="p-3">Head Office</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {branches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-100">{b.branchName || b.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{b.branchCode || b.code}</div>
                      </td>
                      <td className="p-3 text-slate-300">{b.manager || 'Unassigned'}</td>
                      <td className="p-3">
                        <div>{b.phone || '-'}</div>
                        <div className="text-[10px] text-slate-500">{b.email || '-'}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-300">{b.city || '-'}</div>
                        <div className="text-[10px] text-slate-500 line-clamp-1">{b.address || '-'}</div>
                      </td>
                      <td className="p-3">
                        {b.isHeadOffice || b.isMain ? (
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-[10px] font-bold">
                            Head Office
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Branch Outlet</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(b)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {!b.isHeadOffice && !b.isMain && (
                            <button
                              type="button"
                              onClick={() => setDeletingBranch(b)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BACKUP & RESTORE TAB */}
        {activeTab === 'backup' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>Database Backup & Restore Operations</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Backup */}
              <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl space-y-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">Download Full System JSON Backup</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Export all products, sales history, customer ledgers, settings and configuration as a standalone JSON file.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleBackupDownload(e)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 text-xs transition-all active:scale-95"
                >
                  <Database className="w-4 h-4" />
                  <span>Download JSON Database Backup</span>
                </button>
              </div>

              {/* Restore */}
              <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl space-y-4">
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">Restore Database from JSON</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Upload a valid Unique Sweets POS JSON backup file to restore system database state.
                  </p>
                </div>

                <div className="space-y-3">
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
                  />
                  {restoreStatus && (
                    <div className="text-xs text-amber-400 font-semibold">{restoreStatus}</div>
                  )}
                  <button
                    type="button"
                    disabled={!restoreFile}
                    onClick={(e) => handleRestoreSubmit(e)}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-amber-600/30 flex items-center justify-center space-x-2 text-xs transition-all active:scale-95"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Restore System Database</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* CREATE / EDIT BRANCH MODAL */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">
                {editingBranch ? 'Edit Branch Outlet' : 'Add New Branch Outlet'}
              </h2>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setShowBranchModal(false); }}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-semibold flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveBranch} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Branch Name *</label>
                <input
                  type="text"
                  required
                  value={formBranch.branchName}
                  onChange={(e) => setFormBranch({ ...formBranch, branchName: e.target.value })}
                  placeholder="e.g. Gulberg Bakery Branch"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Manager</label>
                  <input
                    type="text"
                    value={formBranch.manager}
                    onChange={(e) => setFormBranch({ ...formBranch, manager: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">City</label>
                  <input
                    type="text"
                    value={formBranch.city}
                    onChange={(e) => setFormBranch({ ...formBranch, city: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formBranch.phone}
                    onChange={(e) => setFormBranch({ ...formBranch, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formBranch.email}
                    onChange={(e) => setFormBranch({ ...formBranch, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Physical Address</label>
                <input
                  type="text"
                  value={formBranch.address}
                  onChange={(e) => setFormBranch({ ...formBranch, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowBranchModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30"
                >
                  Save Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE BRANCH CONFIRMATION MODAL */}
      {deletingBranch && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-sm w-full rounded-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Delete Branch Outlet?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete <strong className="text-slate-200">{deletingBranch.branchName || deletingBranch.name}</strong>?
              </p>
            </div>
            <div className="flex justify-center space-x-3">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setDeletingBranch(null); }}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => handleDeleteBranch(e)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-rose-600/30"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TSPL SIMULATION PREVIEW MODAL */}
      {showTsplModal && tsplSimulationData && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600/20 text-blue-400 rounded-2xl flex items-center justify-center font-bold">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>TSPL Printer Simulation & Payload Viewer</span>
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] rounded-full uppercase">
                      50 × 30 mm
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Target Printer: <strong className="text-slate-200">{settings.labelPrinter || 'TSC TTP-244 Pro'}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setShowTsplModal(false); }}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Cloud Preview Status Banner */}
              <div className="p-3.5 bg-blue-950/50 border border-blue-500/40 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="font-bold text-blue-200 text-xs">
                    CLOUD PREVIEW — PHYSICAL PRINTER NOT CONNECTED
                  </span>
                </div>
                <span className="text-[10px] text-blue-400 font-mono">Bypassing 127.0.0.1:9100</span>
              </div>

              {/* Visual 50 x 30 mm Label Simulation */}
              <div>
                <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Visual Label Preview (50 × 30 mm Standard Format)
                </span>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-center">
                  <div className="bg-white text-slate-900 rounded-xl p-3 w-[220px] h-[130px] flex flex-col justify-between shadow-md border border-slate-300 text-center font-sans">
                    <div className="text-[10px] font-extrabold uppercase tracking-tight text-slate-800 truncate">
                      {settings.name}
                    </div>
                    <div className="text-[11px] font-bold text-slate-900 truncate">
                      {tsplSimulationData.productName}
                    </div>
                    <div className="my-1 flex justify-center scale-90">
                      <BarcodeImage value={tsplSimulationData.barcode} height={28} width={1.2} />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono pt-0.5 border-t border-slate-200">
                      <span className="text-slate-600 font-semibold">SKU: {tsplSimulationData.sku}</span>
                      <span className="text-slate-950 font-black text-xs">Rs. {tsplSimulationData.price}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Dimensions</span>
                  <strong className="text-emerald-400 font-mono">50 × 30 mm</strong>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Barcode Type</span>
                  <strong className="text-slate-200 font-mono">CODE 128</strong>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Gap / Speed</span>
                  <strong className="text-slate-200 font-mono">2mm / 4 IPS</strong>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block">Copy Count</span>
                  <strong className="text-blue-400 font-mono">{tsplSimulationData.copies} Copy</strong>
                </div>
              </div>

              {/* TSPL Payload String */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Compiled TSPL Byte Stream
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      navigator.clipboard.writeText(tsplSimulationData.commands);
                      setCopiedTspl(true);
                      setTimeout(() => setCopiedTspl(false), 2000);
                    }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                  >
                    {copiedTspl ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy TSPL String</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-emerald-400 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-48">
                  {tsplSimulationData.commands}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
              <span className="text-[11px] text-slate-500 font-mono">
                TSC TTP-244 Pro • TSPL/TSPL2 Driver Engine
              </span>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setShowTsplModal(false); }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs"
              >
                Close Simulation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
