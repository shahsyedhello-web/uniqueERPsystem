import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../services/api';
import { Product, Category, Customer, Sale, SaleItem, CashShift } from '../../types/pos';
import {
  Search,
  Barcode,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  DollarSign,
  User,
  PauseCircle,
  PlayCircle,
  Calculator,
  Printer,
  CheckCircle,
  X,
  CreditCard,
  PhoneCall,
  Percent,
  Clock,
  AlertCircle,
  Camera,
  Volume2,
  Zap,
} from 'lucide-react';
import { playBarcodeBeep } from '../../utils/barcode';
import { ProductNotFoundModal } from '../common/ProductNotFoundModal';
import { CameraBarcodeScannerModal } from '../common/CameraBarcodeScannerModal';

export const POSView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Barcode & Scanning State
  const [scannedBarcodeNotFound, setScannedBarcodeNotFound] = useState<string | null>(null);
  const [showNotFoundModal, setShowNotFoundModal] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [scanSuccessMsg, setScanSuccessMsg] = useState<string | null>(null);

  // Cart State
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [overallDiscount, setOverallDiscount] = useState<number>(0); // Percentage or Fixed
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENT'>('PERCENT');

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Payment Form
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'MOBILE' | 'CREDIT' | 'SPLIT'>('CASH');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [splitCash, setSplitCash] = useState<string>('0');
  const [splitCard, setSplitCard] = useState<string>('0');
  const [splitMobile, setSplitMobile] = useState<string>('0');
  const [splitCredit, setSplitCredit] = useState<string>('0');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [heldSales, setHeldSales] = useState<Sale[]>([]);

  // Active Register Shift State
  const [activeShift, setActiveShift] = useState<CashShift | null>(null);
  const [showShiftModal, setShowShiftModal] = useState<boolean>(false);
  const [openingFloat, setOpeningFloat] = useState<string>('5000');
  const [isOpeningShift, setIsOpeningShift] = useState<boolean>(false);
  const [shiftError, setShiftError] = useState<string | null>(null);

  // Cash Drawer In/Out & Shift Closing State
  const [showDrawerModal, setShowDrawerModal] = useState(false);
  const [drawerType, setDrawerType] = useState<'PAID_IN' | 'PAID_OUT'>('PAID_IN');
  const [drawerAmount, setDrawerAmount] = useState('');
  const [drawerReason, setDrawerReason] = useState('');
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [isSubmittingDrawer, setIsSubmittingDrawer] = useState(false);

  const [showShiftSummaryModal, setShowShiftSummaryModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [closeShiftResult, setCloseShiftResult] = useState<any | null>(null);
  const [closeShiftError, setCloseShiftError] = useState<string | null>(null);
  const [isClosingShift, setIsClosingShift] = useState(false);

  // Calculator State
  const [calcInput, setCalcInput] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    loadCatalog();
    loadHeldSales();
    loadActiveShift();
  }, []);

  const loadActiveShift = async () => {
    try {
      const shift = await apiFetch<CashShift | null>('/finance/shifts/active');
      setActiveShift(shift);
    } catch (e) {
      console.error('Failed to load active cash shift:', e);
    }
  };

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setShiftError(null);
    const floatAmt = Number(openingFloat);
    if (isNaN(floatAmt) || floatAmt < 0) {
      setShiftError('Please enter a valid non-negative opening cash float.');
      return;
    }
    try {
      setIsOpeningShift(true);
      const newShift = await apiFetch<CashShift>('/finance/shifts/open', {
        method: 'POST',
        body: JSON.stringify({
          openingCash: floatAmt,
          registerId: 'reg-001',
          counterId: 'counter-01',
          notes: 'Shift opened via POS terminal',
        }),
      });
      setActiveShift(newShift);
      setShowShiftModal(false);
      setShiftError(null);
    } catch (err: any) {
      console.error('Failed to open shift:', err);
      setShiftError(err.message || 'Failed to open register shift.');
    } finally {
      setIsOpeningShift(false);
    }
  };

  const handleDrawerTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setDrawerError(null);
    if (!activeShift) return;
    const amt = Number(drawerAmount);
    if (isNaN(amt) || amt <= 0) {
      setDrawerError('Please enter a valid amount greater than 0.');
      return;
    }
    if (!drawerReason.trim()) {
      setDrawerError('Reason for cash movement is mandatory.');
      return;
    }
    try {
      setIsSubmittingDrawer(true);
      const res = await apiFetch<any>('/finance/shifts/drawer-transaction', {
        method: 'POST',
        body: JSON.stringify({
          shiftId: activeShift.id,
          type: drawerType,
          amount: amt,
          reason: drawerReason,
        }),
      });
      setActiveShift(res.updatedShift);
      setShowDrawerModal(false);
      setDrawerAmount('');
      setDrawerReason('');
    } catch (err: any) {
      setDrawerError(err.message || 'Failed to record cash drawer transaction.');
    } finally {
      setIsSubmittingDrawer(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setCloseShiftError(null);
    if (!activeShift) return;
    const counted = Number(countedCash);
    if (isNaN(counted) || counted < 0) {
      setCloseShiftError('Please enter valid physical cash counted amount.');
      return;
    }
    try {
      setIsClosingShift(true);
      const res = await apiFetch<any>('/finance/shifts/close', {
        method: 'POST',
        body: JSON.stringify({
          shiftId: activeShift.id,
          actualCash: counted,
          varianceReason,
        }),
      });
      setCloseShiftResult(res.zReport);
      setActiveShift(null);
      setShowCloseShiftModal(false);
    } catch (err: any) {
      setCloseShiftError(err.message || 'Failed to close register shift.');
    } finally {
      setIsClosingShift(false);
    }
  };

  const loadCatalog = async () => {
    try {
      const [prods, cats, custs] = await Promise.all([
        apiFetch<Product[]>('/products').catch(() => []),
        apiFetch<Category[]>('/categories').catch(() => []),
        apiFetch<Customer[]>('/customers').catch(() => []),
      ]);
      setProducts(Array.isArray(prods) ? prods : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setCustomers(Array.isArray(custs) ? custs : []);
    } catch (e) {
      console.error(e);
      setProducts([]);
      setCategories([]);
      setCustomers([]);
    }
  };

  const loadHeldSales = async () => {
    try {
      const data = await apiFetch<Sale[]>('/sales?status=HELD');
      setHeldSales(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setHeldSales([]);
    }
  };

  // Barcode Lookup & Processing Engine
  const processScannedCode = (rawCode: string) => {
    const code = rawCode.trim().toLowerCase();
    if (!code) return;

    const safeProducts = Array.isArray(products) ? products : [];
    // Match exact barcode or SKU or variant barcode
    const matched = safeProducts.find(
      (p) =>
        p.barcode.toLowerCase() === code ||
        p.sku.toLowerCase() === code ||
        (p.variants && p.variants.some((v) => v.barcode.toLowerCase() === code))
    );

    if (matched) {
      playBarcodeBeep('success');
      addToCart(matched);
      setSearchQuery('');
      setScanSuccessMsg(`Added "${matched.name}" to cart`);
      setTimeout(() => setScanSuccessMsg(null), 3000);
    } else {
      playBarcodeBeep('error');
      setScannedBarcodeNotFound(rawCode.trim());
      setShowNotFoundModal(true);
      setSearchQuery('');
    }
  };

  // Global Keyboard Shortcuts & USB Barcode Scanner (Keyboard Wedge)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shortcuts
      if (e.key === 'F1') {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        return;
      } else if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      } else if (e.key === 'F6' || e.key === 'F10') {
        e.preventDefault();
        if (cart.length > 0) setShowPaymentModal(true);
        return;
      } else if (e.key === 'F7') {
        e.preventDefault();
        if (cart.length > 0) handleHoldSale();
        return;
      } else if (e.key === 'F8') {
        e.preventDefault();
        setShowCalcModal((prev) => !prev);
        return;
      } else if (e.key === 'F9') {
        e.preventDefault();
        setShowHoldModal((prev) => !prev);
        return;
      } else if (e.key === 'F11') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
        return;
      } else if (e.key === 'F12') {
        e.preventDefault();
        if (completedSale) {
          window.print();
        }
        return;
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowHoldModal((prev) => !prev);
        return;
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (completedSale) window.print();
        return;
      } else if (e.key === 'Escape') {
        setShowPaymentModal(false);
        setShowHoldModal(false);
        setShowCalcModal(false);
        setShowReceiptModal(false);
        setShowShortcutsModal(false);
        setShowNotFoundModal(false);
        setShowCameraScanner(false);
        return;
      }

      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        if (barcodeBufferRef.current.length >= 2 && elapsed < 100) {
          e.preventDefault();
          const scanned = barcodeBufferRef.current;
          barcodeBufferRef.current = '';
          processScannedCode(scanned);
          return;
        }
        barcodeBufferRef.current = '';
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (elapsed > 120) {
          barcodeBufferRef.current = e.key;
        } else {
          barcodeBufferRef.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, cart, completedSale]);

  // Barcode Auto Search & Add
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      processScannedCode(searchQuery);
    }
  };

  const addToCart = (product: Product) => {
    const existingInCart = cart.find((i) => i.productId === product.id);
    const currentCartQty = existingInCart ? existingInCart.quantity : 0;

    if (currentCartQty + 1 > product.currentStock) {
      alert(`Cannot add more "${product.name}". Available stock is ${product.currentStock}.`);
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        const item = updated[existingIndex];
        const newQty = item.quantity + 1;
        const itemSubtotal = newQty * item.price - item.discount;
        updated[existingIndex] = { ...item, quantity: newQty, subtotal: itemSubtotal };
        return updated;
      } else {
        const newSaleItem: SaleItem = {
          productId: product.id,
          productName: product.name,
          barcode: product.barcode,
          unit: product.unit,
          price: product.salePrice,
          quantity: 1,
          discount: 0,
          taxRate: product.taxRate || 0,
          subtotal: product.salePrice,
          isKitchenItem: product.isKitchenItem,
        };
        return [...prev, newSaleItem];
      }
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    const prod = products.find((p) => p.id === productId);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (delta > 0 && prod && newQty > prod.currentStock) {
              alert(`Cannot exceed available stock (${prod.currentStock}) for "${item.productName}".`);
              return item;
            }
            const newSub = newQty * item.price - item.discount;
            return { ...item, quantity: newQty, subtotal: newSub };
          }
          return item;
        })
        .filter(Boolean) as SaleItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Totals Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const cartTax = cart.reduce((sum, item) => sum + (item.subtotal * (item.taxRate / 100)), 0);

  const discountAmount =
    discountType === 'PERCENT'
      ? (cartSubtotal * overallDiscount) / 100
      : Math.min(cartSubtotal, overallDiscount);

  const grandTotal = Math.max(0, cartSubtotal + cartTax - discountAmount);

  // Hold Sale
  const handleHoldSale = async () => {
    if (cart.length === 0) return;
    try {
      await apiFetch('/sales', {
        method: 'POST',
        body: JSON.stringify({
          customerId: selectedCustomer?.id,
          customerName: selectedCustomer?.name || 'Walk-in Customer',
          items: cart,
          taxAmount: cartTax,
          discountAmount,
          totalAmount: grandTotal,
          paidAmount: 0,
          changeAmount: 0,
          paymentMethod: 'CASH',
          status: 'HELD',
        }),
      });
      setCart([]);
      setSelectedCustomer(null);
      loadHeldSales();
      alert('Sale parked successfully! You can resume it from Held Orders (F9).');
    } catch (e: any) {
      alert(e.message || 'Failed to hold sale');
    }
  };

  const handleResumeSale = (sale: Sale) => {
    setCart(sale.items);
    setOverallDiscount(sale.discountAmount);
    setShowHoldModal(false);
  };

  const openPaymentModal = () => {
    setPaymentError(null);
    setPaymentMethod('CASH');
    setPaidAmount(grandTotal.toString());
    setSplitCash(grandTotal.toString());
    setSplitCard('0');
    setSplitMobile('0');
    setSplitCredit('0');
    setShowPaymentModal(true);
  };

  const handlePaymentMethodChange = (m: 'CASH' | 'CARD' | 'MOBILE' | 'CREDIT' | 'SPLIT') => {
    setPaymentError(null);
    setPaymentMethod(m);

    if (m === 'CASH') {
      setPaidAmount(grandTotal.toString());
    } else if (m === 'CARD' || m === 'MOBILE') {
      setPaidAmount(grandTotal.toString());
    } else if (m === 'CREDIT') {
      setPaidAmount('0');
    } else if (m === 'SPLIT') {
      setSplitCash(grandTotal.toString());
      setSplitCard('0');
      setSplitMobile('0');
      setSplitCredit('0');
    }
  };

  // Complete Checkout
  const handleProcessCheckout = async () => {
    setPaymentError(null);

    let finalPaidAmount = 0;
    let finalChangeAmount = 0;
    let paymentDetailsPayload: any = null;

    if (paymentMethod === 'CASH') {
      const cashReceived = paidAmount.trim() === '' ? grandTotal : Number(paidAmount);
      if (isNaN(cashReceived) || cashReceived < grandTotal - 0.01) {
        setPaymentError('Insufficient cash received.');
        return;
      }
      finalPaidAmount = cashReceived;
      finalChangeAmount = Math.max(0, cashReceived - grandTotal);
    } else if (paymentMethod === 'CARD' || paymentMethod === 'MOBILE') {
      const paid = paidAmount.trim() === '' ? grandTotal : Number(paidAmount);
      if (isNaN(paid) || paid < grandTotal - 0.01) {
        setPaymentError('Insufficient payment received.');
        return;
      }
      finalPaidAmount = paid;
      finalChangeAmount = Math.max(0, paid - grandTotal);
    } else if (paymentMethod === 'CREDIT') {
      if (!selectedCustomer) {
        setPaymentError('Customer selection is required for CREDIT sales.');
        return;
      }
      const paid = paidAmount.trim() === '' ? 0 : Number(paidAmount);
      if (isNaN(paid) || paid < 0) {
        setPaymentError('Invalid paid amount.');
        return;
      }
      if (paid > grandTotal + 0.01) {
        setPaymentError('Paid amount cannot exceed invoice total for credit sale.');
        return;
      }
      finalPaidAmount = paid;
      finalChangeAmount = 0;
    } else if (paymentMethod === 'SPLIT') {
      const sCash = Number(splitCash) || 0;
      const sCard = Number(splitCard) || 0;
      const sMobile = Number(splitMobile) || 0;
      const sCredit = Number(splitCredit) || 0;

      const sum = sCash + sCard + sMobile + sCredit;
      if (Math.abs(sum - grandTotal) > 0.01) {
        setPaymentError(`Split payment total (Rs. ${sum}) must equal invoice total (Rs. ${grandTotal}).`);
        return;
      }

      if (sCredit > 0 && !selectedCustomer) {
        setPaymentError('Customer selection is required when allocating credit in split payment.');
        return;
      }

      finalPaidAmount = sCash + sCard + sMobile;
      finalChangeAmount = Math.max(0, (finalPaidAmount + sCredit) - grandTotal);
      paymentDetailsPayload = { splitCash: sCash, splitCard: sCard, splitMobile: sMobile, splitCredit: sCredit };
    }

    try {
      setIsSubmitting(true);
      const sale = await apiFetch<Sale>('/sales', {
        method: 'POST',
        body: JSON.stringify({
          customerId: selectedCustomer?.id,
          customerName: selectedCustomer?.name || 'Walk-in Customer',
          items: cart,
          taxAmount: cartTax,
          discountAmount,
          totalAmount: grandTotal,
          paidAmount: finalPaidAmount,
          changeAmount: finalChangeAmount,
          paymentMethod,
          paymentDetails: paymentDetailsPayload,
          status: 'COMPLETED',
        }),
      });

      setCompletedSale(sale);
      setShowPaymentModal(false);
      setShowReceiptModal(true);

      // Reset cart
      setCart([]);
      setSelectedCustomer(null);
      setOverallDiscount(0);
      setPaidAmount('');
      setPaymentError(null);
      loadCatalog();
    } catch (e: any) {
      console.error('Checkout error:', e);
      setPaymentError(e.message || 'Checkout failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const safeProducts = Array.isArray(products) ? products : [];
  const filteredProducts = safeProducts.filter((p) => {
    const matchesCat = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-slate-50 text-slate-900 overflow-hidden select-none">
      {/* LEFT: Catalog Grid & Search */}
      <div className="flex-[1.8] flex flex-col p-6 bg-slate-50/50 gap-4 overflow-hidden border-r border-slate-200">
        {/* Search Bar & Barcode listener */}
        <div className="space-y-2">
          {/* Active Register Shift Banner */}
          {activeShift && (
            <div className="bg-emerald-950/90 border border-emerald-500/60 rounded-xl p-3 text-xs text-emerald-200 font-semibold flex flex-wrap items-center justify-between shadow-md gap-2">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>REGISTER OPEN:</strong> {activeShift.registerName} &bull; Cashier: {activeShift.cashierName} &bull; Float: Rs. {activeShift.openingCash}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDrawerModal(true)}
                  className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px]"
                >
                  Cash In/Out
                </button>
                <button
                  type="button"
                  onClick={() => setShowShiftSummaryModal(true)}
                  className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px]"
                >
                  Shift Summary
                </button>
                <button
                  type="button"
                  onClick={() => setShowCloseShiftModal(true)}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-[11px]"
                >
                  Close Register
                </button>
              </div>
            </div>
          )}

          {/* Register Closed Banner */}
          {!activeShift && (
            <div className="bg-amber-950/80 border border-amber-500/50 rounded-xl p-3 text-xs text-amber-200 font-semibold flex items-center justify-between shadow-md">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                <span><strong>Register Closed:</strong> Open a cash shift to start billing and checkout.</span>
              </div>
              <button
                type="button"
                onClick={() => setShowShiftModal(true)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shadow-sm transition-all active:scale-95 shrink-0"
              >
                Open Register
              </button>
            </div>
          )}

          {scanSuccessMsg && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm animate-fade-in">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>{scanSuccessMsg}</span>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono font-semibold">
                AUDIO BEEP OK
              </span>
            </div>
          )}

          <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Scan barcode with USB scanner / Webcam or search name..."
                className="w-full pl-12 pr-12 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none shadow-sm placeholder:text-slate-400 font-medium text-slate-800"
              />
              <Barcode className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            <button
              type="button"
              onClick={() => setShowCameraScanner(true)}
              className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-slate-100 font-bold rounded-xl shadow-md text-xs flex items-center space-x-1.5 shrink-0 transition-all active:scale-95 border border-slate-700"
              title="Open Webcam Camera Barcode Scanner"
            >
              <Camera className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline">Camera Scanner</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHoldModal(true)}
              className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-600 font-semibold shadow-sm hover:bg-slate-100 flex items-center space-x-2 shrink-0 transition-colors text-xs"
            >
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Held ({heldSales.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowShortcutsModal(true)}
              className="px-3 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-slate-700 font-bold shadow-sm flex items-center space-x-1.5 shrink-0 transition-colors text-xs"
              title="Keyboard Shortcuts (F1-F12)"
            >
              <span className="bg-slate-800 text-white px-1.5 py-0.5 rounded text-[10px] font-mono">F1</span>
              <span className="hidden md:inline">Shortcuts</span>
            </button>
          </form>

          <div className="flex items-center justify-between text-[11px] px-1 text-slate-500">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-semibold text-slate-600">USB Hardware Scanner: Active</span>
              <span className="text-slate-400">• Point & pull trigger anytime</span>
            </div>
            <div className="hidden sm:flex items-center space-x-2 text-slate-400">
              <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">F2</span> Focus Search
              <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">F1</span> Park Sale
            </div>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none shrink-0">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === 'ALL'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 shadow-sm'
            }`}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 shadow-sm'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 pr-1">
          {filteredProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              disabled={p.currentStock <= 0}
              className={`flex flex-col justify-between p-3 rounded-2xl border text-left transition-all relative group overflow-hidden ${
                p.currentStock <= 0
                  ? 'bg-slate-100/60 border-slate-200 opacity-50 cursor-not-allowed'
                  : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 shadow-sm'
              }`}
            >
              <div className="space-y-1.5">
                {p.image ? (
                  <div className="w-full h-24 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 mb-1">
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                ) : null}

                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                    {p.sku}
                  </span>
                  {p.isKitchenItem && (
                    <span className="text-[9px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded border border-amber-200">
                      Kitchen
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-xs text-slate-800 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {p.name}
                </h3>
              </div>

              <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-2">
                <div>
                  <div className="text-sm font-black text-slate-900">
                    Rs. {p.salePrice.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">per {p.unit}</div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    p.currentStock <= p.minStock
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Stock: {p.currentStock}
                </span>
              </div>
            </button>
          ))}

          {filteredProducts.length === 0 && (
            <div className="col-span-full border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-12 bg-white/40 my-auto">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                <Barcode className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-slate-700">No Products Found</h3>
              <p className="text-xs text-slate-500 max-w-xs mt-1">Start by adding products in the Product Management module or scanning a barcode.</p>
            </div>
          )}
        </div>

        {/* Quick Shortcuts */}
        <div className="flex gap-2 overflow-x-auto pb-1 pt-1 shrink-0">
          <span className="px-3 py-1.5 bg-slate-200 rounded-md text-[11px] font-bold text-slate-600 uppercase tracking-wider">F1 Search / Hold</span>
          <span className="px-3 py-1.5 bg-slate-200 rounded-md text-[11px] font-bold text-slate-600 uppercase tracking-wider">F2 Focus</span>
          <span className="px-3 py-1.5 bg-slate-200 rounded-md text-[11px] font-bold text-slate-600 uppercase tracking-wider">F8 Calc</span>
          <span className="px-3 py-1.5 bg-slate-200 rounded-md text-[11px] font-bold text-slate-600 uppercase tracking-wider">F9 Held Sales</span>
        </div>
      </div>

      {/* RIGHT: Cart & Billing */}
      <section className="flex-1 bg-white border-l border-slate-200 flex flex-col shadow-2xl relative">
        {/* Customer Selection Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Customer</p>
              <select
                value={selectedCustomer?.id || ''}
                onChange={(e) => {
                  const found = customers.find((c) => c.id === e.target.value);
                  setSelectedCustomer(found || null);
                }}
                className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none border-b border-slate-300 pb-0.5"
              >
                <option value="">Walk-in Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => setShowCalcModal(true)}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Calculator (F8)"
          >
            <Calculator className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 divide-y divide-slate-100">
          {cart.map((item) => (
            <div key={item.productId} className="pt-2.5 flex items-center justify-between text-xs">
              <div className="flex-1 space-y-0.5 pr-2">
                <div className="font-bold text-slate-800">{item.productName}</div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Rs. {item.price.toLocaleString()} x {item.quantity} {item.unit}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => updateCartQty(item.productId, -1)}
                    className="p-1 hover:bg-slate-200 text-slate-600"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="px-2 font-mono font-bold text-slate-800">{item.quantity}</span>
                  <button
                    onClick={() => updateCartQty(item.productId, 1)}
                    className="p-1 hover:bg-slate-200 text-slate-600"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="text-right w-20">
                  <div className="font-bold text-slate-900 font-mono">Rs. {item.subtotal.toLocaleString()}</div>
                </div>

                <button
                  onClick={() => removeFromCart(item.productId)}
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center py-16 space-y-2">
              <ShoppingCart className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm font-medium italic">Cart is empty</p>
              <p className="text-xs text-slate-400">Scan barcode or click items in catalog to add</p>
            </div>
          )}
        </div>

        {/* Order Totals (Dark Sleek Block) */}
        <div className="p-6 bg-slate-900 text-white shadow-inner">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-400 text-sm">Subtotal</span>
            <span className="font-mono">Rs. {cartSubtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-400 text-sm">Tax ({cartTax > 0 ? 'Applied' : '0%'})</span>
            <span className="font-mono">Rs. {cartTax.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-400 text-sm flex items-center gap-1.5">
              <span>Discount</span>
              <input
                type="number"
                value={overallDiscount}
                onChange={(e) => setOverallDiscount(Number(e.target.value))}
                className="w-16 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-center font-mono text-white"
              />
              <button
                type="button"
                onClick={() => setDiscountType(discountType === 'PERCENT' ? 'FIXED' : 'PERCENT')}
                className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-blue-400 font-mono"
              >
                {discountType === 'PERCENT' ? '%' : 'PKR'}
              </button>
            </span>
            <span className="font-mono text-emerald-400">-$ {discountAmount.toLocaleString()}</span>
          </div>
          <div className="h-px bg-white/10 mb-4"></div>
          <div className="flex justify-between items-end mb-6">
            <span className="text-white font-bold">Payable Total</span>
            <span className="text-4xl font-bold font-mono tracking-tighter text-blue-400">
              Rs. {grandTotal.toLocaleString()}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleHoldSale}
              disabled={cart.length === 0}
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 transition-colors"
            >
              <PauseCircle className="w-5 h-5 text-amber-400" />
              Hold Order
            </button>
            <button
              onClick={() => {
                if (cart.length > 0) setCart([]);
              }}
              disabled={cart.length === 0}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-4 rounded-xl disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!activeShift) {
                  setShowShiftModal(true);
                  return;
                }
                openPaymentModal();
              }}
              disabled={cart.length === 0}
              className={`col-span-2 text-white font-bold py-4 rounded-2xl text-lg shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-40 ${
                !activeShift
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/40'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/40'
              }`}
            >
              {!activeShift ? (
                <>
                  <AlertCircle className="w-6 h-6 text-amber-200" />
                  <span>Open Register to Checkout</span>
                </>
              ) : (
                <>
                  <span>Checkout & Print</span>
                  <DollarSign className="w-6 h-6" />
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* PAYMENT MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span>Complete Payment</span>
              </h2>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentError(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Banner */}
            {paymentError && (
              <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-xs text-red-200 font-semibold flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            <div className="text-center bg-slate-800/60 p-3.5 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">Total Payable</span>
              <span className="text-3xl font-black text-emerald-400 font-mono">
                Rs. {grandTotal.toLocaleString()}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {(['CASH', 'CARD', 'MOBILE', 'CREDIT', 'SPLIT'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handlePaymentMethodChange(m)}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      paymentMethod === m
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Selector (Mandatory for Credit, recommended for others) */}
            <div className="space-y-1 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span>Customer</span>
                </span>
                {paymentMethod === 'CREDIT' && !selectedCustomer && (
                  <span className="text-[10px] text-amber-400 font-bold">* Required for Credit Sale</span>
                )}
              </div>
              <select
                value={selectedCustomer?.id || ''}
                onChange={(e) => {
                  const found = customers.find((c) => c.id === e.target.value);
                  setSelectedCustomer(found || null);
                  setPaymentError(null);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="">Walk-in Customer (No Account)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone || 'No phone'}) - Bal: Rs. {(c.outstandingBalance || 0).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            {/* CASH PAYMENT INPUTS */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-2 bg-slate-800/30 p-3 rounded-xl border border-slate-800">
                <label className="text-xs font-semibold text-slate-300 flex justify-between">
                  <span>Cash Received from Customer</span>
                  <span className="text-[10px] text-slate-400">Must be ≥ Rs. {grandTotal}</span>
                </label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => {
                    setPaidAmount(e.target.value);
                    setPaymentError(null);
                  }}
                  placeholder={`Exact: Rs. ${grandTotal}`}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-lg text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />

                {/* Quick Cash Buttons */}
                <div className="flex gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPaidAmount(grandTotal.toString());
                      setPaymentError(null);
                    }}
                    className="flex-1 py-1 bg-blue-600/30 hover:bg-blue-600/40 text-blue-300 text-[11px] font-bold rounded border border-blue-500/40"
                  >
                    Exact ({grandTotal})
                  </button>
                  {[500, 1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setPaidAmount(amt.toString());
                        setPaymentError(null);
                      }}
                      className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 rounded border border-slate-700"
                    >
                      {amt}
                    </button>
                  ))}
                </div>

                {/* Change or Warning */}
                {paidAmount.trim() !== '' && Number(paidAmount) >= grandTotal && (
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 flex justify-between font-mono font-bold">
                    <span>Change Return:</span>
                    <span>Rs. {(Number(paidAmount) - grandTotal).toLocaleString()}</span>
                  </div>
                )}

                {paidAmount.trim() !== '' && Number(paidAmount) < grandTotal && (
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400 flex justify-between font-mono font-bold">
                    <span>Cash Shortage:</span>
                    <span>Rs. {(grandTotal - Number(paidAmount)).toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

            {/* CARD / MOBILE PAYMENT INPUTS */}
            {(paymentMethod === 'CARD' || paymentMethod === 'MOBILE') && (
              <div className="space-y-2 bg-slate-800/30 p-3 rounded-xl border border-slate-800">
                <label className="text-xs font-semibold text-slate-300">
                  {paymentMethod} Amount Received
                </label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => {
                    setPaidAmount(e.target.value);
                    setPaymentError(null);
                  }}
                  placeholder={`Default Rs. ${grandTotal}`}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-lg text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {/* CREDIT PAYMENT INPUTS */}
            {paymentMethod === 'CREDIT' && (
              <div className="space-y-2.5 bg-slate-800/30 p-3 rounded-xl border border-slate-800">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex justify-between">
                    <span>Down Payment Paid Now (Optional)</span>
                    <span className="text-[10px] text-slate-400">Default: Rs. 0</span>
                  </label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => {
                      setPaidAmount(e.target.value);
                      setPaymentError(null);
                    }}
                    placeholder="0"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-base text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs space-y-1 font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span>Invoice Total:</span>
                    <span>Rs. {grandTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400">
                    <span>Paid Now:</span>
                    <span>Rs. {(Number(paidAmount) || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-amber-400 font-bold border-t border-amber-500/20 pt-1">
                    <span>Customer Due Added:</span>
                    <span>Rs. {Math.max(0, grandTotal - (Number(paidAmount) || 0)).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* SPLIT PAYMENT INPUTS */}
            {paymentMethod === 'SPLIT' && (
              <div className="space-y-2 bg-slate-800/30 p-3 rounded-xl border border-slate-800 text-xs">
                <span className="font-bold text-slate-200 block mb-1">Split Payment Breakdown</span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">💵 Cash Amount</label>
                    <input
                      type="number"
                      value={splitCash}
                      onChange={(e) => {
                        setSplitCash(e.target.value);
                        setPaymentError(null);
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">💳 Card Amount</label>
                    <input
                      type="number"
                      value={splitCard}
                      onChange={(e) => {
                        setSplitCard(e.target.value);
                        setPaymentError(null);
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">📱 Mobile Wallet</label>
                    <input
                      type="number"
                      value={splitMobile}
                      onChange={(e) => {
                        setSplitMobile(e.target.value);
                        setPaymentError(null);
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">📝 Credit (Customer Due)</label>
                    <input
                      type="number"
                      value={splitCredit}
                      onChange={(e) => {
                        setSplitCredit(e.target.value);
                        setPaymentError(null);
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Split Balance Summary */}
                {(() => {
                  const sSum = (Number(splitCash) || 0) + (Number(splitCard) || 0) + (Number(splitMobile) || 0) + (Number(splitCredit) || 0);
                  const diff = sSum - grandTotal;
                  return (
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 mt-2 font-mono space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span>Total Allocated:</span>
                        <span>Rs. {sSum.toLocaleString()} / {grandTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Status:</span>
                        {Math.abs(diff) < 0.01 ? (
                          <span className="text-emerald-400">Balanced (100%)</span>
                        ) : diff < 0 ? (
                          <span className="text-amber-400">Remaining: Rs. {Math.abs(diff).toLocaleString()}</span>
                        ) : (
                          <span className="text-red-400">Exceeds by: Rs. {diff.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <button
              type="button"
              onClick={handleProcessCheckout}
              disabled={isSubmitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <span>Processing Sale...</span>
              ) : (
                <span>Confirm Sale & Print Thermal Receipt</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* THERMAL RECEIPT PRINT MODAL */}
      {showReceiptModal && completedSale && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-blue-400" />
                <span>Thermal Invoice Printer Preview</span>
              </span>
              <button onClick={() => setShowReceiptModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 80mm Thermal Receipt Layout */}
            <div className="bg-white text-black p-4 font-mono text-[11px] rounded shadow-inner space-y-3 leading-tight select-text">
              <div className="text-center space-y-1 border-b border-black/20 pb-2">
                <h2 className="font-extrabold text-sm uppercase tracking-wider">Unique Sweets & Bakers</h2>
                <p className="text-[10px]">Freshly Baked & Authentic Sweets</p>
                <p className="text-[9px]">Tel: +92 300 1234567 &bull; Main Branch</p>
                <p className="text-[9px] font-bold mt-1">INVOICE #{completedSale.invoiceNo}</p>
                <p className="text-[9px]">{new Date(completedSale.createdAt).toLocaleString()}</p>
              </div>

              <div>
                <p>Customer: {completedSale.customerName || 'Walk-in'}</p>
                <p>Cashier: {completedSale.cashierName}</p>
              </div>

              <div className="border-t border-b border-black/20 py-1 space-y-1">
                <div className="flex justify-between font-bold border-b border-black/10 pb-1">
                  <span>ITEM</span>
                  <span>QTY x PRICE</span>
                  <span>TOTAL</span>
                </div>
                {completedSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="w-28 truncate">{item.productName}</span>
                    <span>{item.quantity} x {item.price}</span>
                    <span>{item.subtotal}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-0.5 text-right font-bold pt-1">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span>Rs. {completedSale.subtotal}</span>
                </div>
                {completedSale.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span>TAX:</span>
                    <span>Rs. {completedSale.taxAmount}</span>
                  </div>
                )}
                {completedSale.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span>DISCOUNT:</span>
                    <span>- Rs. {completedSale.discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs border-t border-black/30 pt-1">
                  <span>TOTAL:</span>
                  <span>Rs. {completedSale.totalAmount}</span>
                </div>
                <div className="flex justify-between text-[10px] font-normal pt-1">
                  <span>PAID ({completedSale.paymentMethod}):</span>
                  <span>Rs. {completedSale.paidAmount}</span>
                </div>
                {completedSale.changeAmount > 0 && (
                  <div className="flex justify-between text-[10px] font-normal">
                    <span>CHANGE:</span>
                    <span>Rs. {completedSale.changeAmount}</span>
                  </div>
                )}
              </div>

              <div className="text-center pt-2 border-t border-black/20 text-[9px] space-y-0.5">
                <p>Thank you for choosing Unique Sweets & Bakers!</p>
                <p>Visit again!</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HELD ORDERS MODAL */}
      {showHoldModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Held / Parked Sales</span>
              </h2>
              <button onClick={() => setShowHoldModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {heldSales.map((sale) => (
                <div key={sale.id} className="p-3 bg-slate-800/60 rounded-xl flex justify-between items-center border border-slate-800">
                  <div>
                    <div className="font-bold text-xs text-slate-200">Invoice #{sale.invoiceNo}</div>
                    <div className="text-[11px] text-slate-400">{sale.items.length} items &bull; Rs. {sale.totalAmount}</div>
                  </div>
                  <button
                    onClick={() => handleResumeSale(sale)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center space-x-1"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Resume</span>
                  </button>
                </div>
              ))}

              {heldSales.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs">No held sales.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CALCULATOR MODAL */}
      {showCalcModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-64 rounded-2xl p-4 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300">Quick POS Calculator</span>
              <button onClick={() => setShowCalcModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl text-right font-mono text-xl text-emerald-400 border border-slate-800 min-h-12 overflow-x-auto">
              {calcInput || '0'}
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
              {['7','8','9','/','4','5','6','*','1','2','3','-','C','0','=','+'].map((btn) => (
                <button
                  key={btn}
                  onClick={() => {
                    if (btn === 'C') setCalcInput('');
                    else if (btn === '=') {
                      try {
                        setCalcInput(eval(calcInput).toString());
                      } catch {
                        setCalcInput('Err');
                      }
                    } else setCalcInput((prev) => prev + btn);
                  }}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700/60"
                >
                  {btn}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT NOT FOUND MODAL WITH QUICK CREATE FORM */}
      <ProductNotFoundModal
        isOpen={showNotFoundModal}
        scannedBarcode={scannedBarcodeNotFound || ''}
        onClose={() => {
          setShowNotFoundModal(false);
          setScannedBarcodeNotFound(null);
        }}
        onProductCreated={(newProduct) => {
          addToCart(newProduct);
          loadCatalog();
          setScanSuccessMsg(`Created & added "${newProduct.name}" to cart`);
          playBarcodeBeep('success');
          setTimeout(() => setScanSuccessMsg(null), 3500);
        }}
      />

      {/* WEBCAM CAMERA BARCODE SCANNER MODAL */}
      <CameraBarcodeScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScanSuccess={(scannedCode) => {
          processScannedCode(scannedCode);
        }}
        title="POS Webcam Barcode Scanner"
      />

      {/* OPEN REGISTER SHIFT MODAL */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <span>Open Register Shift</span>
              </h2>
              <button onClick={() => setShowShiftModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {shiftError && (
              <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-xs text-red-200 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{shiftError}</span>
              </div>
            )}

            <form onSubmit={handleOpenShift} className="space-y-4">
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-800 space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">Opening Cash Float Amount (PKR)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 font-mono">Rs.</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    placeholder="Enter cash drawer float..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-12 pr-4 py-2.5 text-lg font-bold font-mono text-emerald-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Count the cash float in drawer before starting transactions.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowShiftModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isOpeningShift}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isOpeningShift ? 'Opening Shift...' : 'Confirm & Start Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KEYBOARD SHORTCUTS HELP MODAL */}
      {showShortcutsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl text-slate-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">F1</span>
                <span>POS Keyboard Shortcuts Reference</span>
              </h2>
              <button onClick={() => setShowShortcutsModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { key: 'F1', label: 'Shortcuts Help Panel' },
                { key: 'F2', label: 'Focus Product Search' },
                { key: 'F6 / F10', label: 'Checkout & Payment Modal' },
                { key: 'F7', label: 'Park / Hold Current Order' },
                { key: 'F8', label: 'Quick Calculator' },
                { key: 'F9', label: 'Parked / Held Sales List' },
                { key: 'F11', label: 'Toggle Fullscreen Mode' },
                { key: 'F12', label: 'Print Last Receipt' },
                { key: 'CTRL + K', label: 'Global Search Focus' },
                { key: 'CTRL + H', label: 'Open Held Sales' },
                { key: 'CTRL + P', label: 'Print Active Receipt' },
                { key: 'ESC', label: 'Close Active Modals' },
              ].map((sc) => (
                <div key={sc.key} className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded text-[11px]">
                    {sc.key}
                  </span>
                  <span className="text-slate-300 font-medium text-right">{sc.label}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CASH IN / OUT MODAL */}
      {showDrawerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl text-slate-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span>Cash Drawer In / Out (Paid In / Out)</span>
              </h2>
              <button onClick={() => setShowDrawerModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {drawerError && (
              <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-xs text-red-200 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{drawerError}</span>
              </div>
            )}

            <form onSubmit={handleDrawerTransaction} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Transaction Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDrawerType('PAID_IN')}
                    className={`py-2.5 font-bold rounded-xl border transition-all ${
                      drawerType === 'PAID_IN'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    Cash In (Paid In)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerType('PAID_OUT')}
                    className={`py-2.5 font-bold rounded-xl border transition-all ${
                      drawerType === 'PAID_OUT'
                        ? 'bg-red-600 text-white border-red-500 shadow-md'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    Cash Out (Paid Out)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Amount (PKR)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold font-mono text-slate-400">Rs.</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={drawerAmount}
                    onChange={(e) => setDrawerAmount(e.target.value)}
                    placeholder="Enter amount..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-4 py-2.5 font-mono text-emerald-400 font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Mandatory Reason / Note</label>
                <input
                  type="text"
                  value={drawerReason}
                  onChange={(e) => setDrawerReason(e.target.value)}
                  placeholder="e.g., Change float added, Supplier petty cash payment..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDrawerModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDrawer}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 disabled:opacity-50"
                >
                  {isSubmittingDrawer ? 'Recording...' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHIFT SUMMARY MODAL */}
      {showShiftSummaryModal && activeShift && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl text-slate-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-400" />
                <span>Live Shift Summary ({activeShift.shiftNo || activeShift.id})</span>
              </h2>
              <button onClick={() => setShowShiftSummaryModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="text-slate-400">Cashier Name</div>
                <div className="font-bold text-slate-100 text-sm">{activeShift.cashierName}</div>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="text-slate-400">Register</div>
                <div className="font-bold text-slate-100 text-sm">{activeShift.registerName}</div>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="text-slate-400">Opening Float</div>
                <div className="font-bold font-mono text-emerald-400 text-sm">Rs. {activeShift.openingCash || 0}</div>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="text-slate-400">Cash Sales</div>
                <div className="font-bold font-mono text-slate-200 text-sm">Rs. {activeShift.cashSales || 0}</div>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="text-slate-400">Cash In (Paid In)</div>
                <div className="font-bold font-mono text-emerald-400">Rs. {activeShift.paidIn || 0}</div>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="text-slate-400">Cash Out (Paid Out)</div>
                <div className="font-bold font-mono text-red-400">Rs. {activeShift.paidOut || 0}</div>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="text-slate-400">Cash Refunds</div>
                <div className="font-bold font-mono text-amber-400">Rs. {activeShift.cashRefunds || 0}</div>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="text-slate-400">Card / Other Sales</div>
                <div className="font-bold font-mono text-blue-400">Rs. {(activeShift.cardSales || 0) + (activeShift.mobileSales || 0) + (activeShift.creditSales || 0)}</div>
              </div>
            </div>

            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between items-center font-semibold text-emerald-300">
                <span>Expected Cash (Float + Sales + In - Out - Refunds):</span>
                <span className="font-mono font-bold text-emerald-400 text-base">
                  Rs. {(activeShift.openingCash || 0) + (activeShift.cashSales || 0) + (activeShift.paidIn || 0) - (activeShift.paidOut || 0) - (activeShift.cashRefunds || 0)}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowShiftSummaryModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLOSE REGISTER SHIFT MODAL */}
      {showCloseShiftModal && activeShift && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl text-slate-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-red-400" />
                <span>Close Register / End Shift</span>
              </h2>
              <button onClick={() => setShowCloseShiftModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {closeShiftError && (
              <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-xs text-red-200 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{closeShiftError}</span>
              </div>
            )}

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Opening Float:</span>
                <span className="font-mono font-bold text-slate-200">Rs. {activeShift.openingCash}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Cash Sales + Paid In:</span>
                <span className="font-mono font-bold text-emerald-400">Rs. {(activeShift.cashSales || 0) + (activeShift.paidIn || 0)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Paid Out + Refunds:</span>
                <span className="font-mono font-bold text-red-400">Rs. {(activeShift.paidOut || 0) + (activeShift.cashRefunds || 0)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1.5 font-bold text-slate-100 text-sm">
                <span>Expected Cash Drawer Balance:</span>
                <span className="font-mono text-emerald-400">
                  Rs. {(activeShift.openingCash || 0) + (activeShift.cashSales || 0) + (activeShift.paidIn || 0) - (activeShift.paidOut || 0) - (activeShift.cashRefunds || 0)}
                </span>
              </div>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Physical Cash Counted (PKR)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold font-mono text-slate-400">Rs.</span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    placeholder="Enter physical cash in drawer..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-4 py-2.5 font-mono text-emerald-400 font-bold text-sm focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Variance Reason / Closing Note (if any)</label>
                <input
                  type="text"
                  value={varianceReason}
                  onChange={(e) => setVarianceReason(e.target.value)}
                  placeholder="e.g., Balanced perfectly, Shortage due to minor change..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-red-500 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCloseShiftModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isClosingShift}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-600/30 disabled:opacity-50"
                >
                  {isClosingShift ? 'Closing Shift...' : 'Confirm & Close Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLOSED SHIFT Z-REPORT RESULT MODAL */}
      {closeShiftResult && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl text-slate-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>Z-Report & Shift Closing Summary</span>
              </h2>
              <button onClick={() => setCloseShiftResult(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Shift No:</span>
                <span className="font-bold text-slate-200">{closeShiftResult.shiftNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cashier:</span>
                <span className="font-bold text-slate-200">{closeShiftResult.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Register:</span>
                <span className="font-bold text-slate-200">{closeShiftResult.registerName}</span>
              </div>
              <hr className="border-slate-800 my-2" />
              <div className="flex justify-between">
                <span className="text-slate-400">Opening Cash:</span>
                <span>Rs. {closeShiftResult.openingCash}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gross Sales:</span>
                <span className="text-blue-400 font-bold">Rs. {closeShiftResult.grossSales}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cash Sales:</span>
                <span>Rs. {closeShiftResult.cashSales}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Card Sales:</span>
                <span>Rs. {closeShiftResult.cardSales}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Paid In / Out:</span>
                <span>+Rs. {closeShiftResult.paidIn} / -Rs. {closeShiftResult.paidOut}</span>
              </div>
              <hr className="border-slate-800 my-2" />
              <div className="flex justify-between">
                <span className="text-slate-400">Expected Cash:</span>
                <span>Rs. {closeShiftResult.expectedCash}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Actual Counted:</span>
                <span className="text-emerald-400 font-bold">Rs. {closeShiftResult.actualCash}</span>
              </div>
              <div className="flex justify-between text-sm pt-1 border-t border-slate-800">
                <span className="text-slate-300 font-bold">Variance:</span>
                <span className={`font-bold ${closeShiftResult.variance === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  Rs. {closeShiftResult.variance} ({closeShiftResult.variance === 0 ? 'Balanced' : closeShiftResult.variance > 0 ? 'Surplus' : 'Shortage'})
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Z-Report</span>
              </button>
              <button
                onClick={() => setCloseShiftResult(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
