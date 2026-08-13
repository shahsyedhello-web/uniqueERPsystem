import React, { useState, useEffect } from 'react';
import { Product } from '../../types/pos';
import { BarcodeImage } from './BarcodeImage';
import { Printer, X, Tag, Plus, Minus, Check, AlertCircle, RefreshCw, Terminal, Eye, Copy, CheckCircle2, Monitor } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { printBridgeService, HealthCheckResult, PrintResult } from '../../services/printBridgeService';

interface BarcodePrintModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
}

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  isOpen,
  product,
  onClose,
}) => {
  const [copies, setCopies] = useState<number>(4);
  const [labelSize, setLabelSize] = useState<'standard' | 'small' | 'compact'>('standard');
  const [selectedPrinter, setSelectedPrinter] = useState<string>('TSC TTP-244 Pro');
  const [printers] = useState<string[]>([
    'TSC TTP-244 Pro',
    'TSC TTP-244 Pro #2',
    'TSC TTP-244 Pro #3',
    'POS-80 Thermal Receipt Printer',
    'Microsoft Print to PDF',
  ]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState<{ success?: boolean; isPreview?: boolean; message?: string } | null>(null);

  // Hardware bridge health
  const [bridgeHealth, setBridgeHealth] = useState<HealthCheckResult | null>(null);
  const [hardwareLoaded, setHardwareLoaded] = useState<boolean>(false);

  // Simulation Modal state
  const [showSimulation, setShowSimulation] = useState<boolean>(false);
  const [tsplPayload, setTsplPayload] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setPrintStatus(null);
      // Fetch settings for default printer
      apiFetch<any>('/settings')
        .then((setts) => {
          if (setts && setts.labelPrinter) {
            setSelectedPrinter(setts.labelPrinter);
          }
        })
        .catch(() => {});

      // Check hardware bridge status using centralized service
      printBridgeService.checkHealth()
        .then((health) => {
          setBridgeHealth(health);
          setHardwareLoaded(true);
        })
        .catch(() => {
          setBridgeHealth({
            state: 'CLOUD_PREVIEW',
            connected: false,
            service: 'cloud-preview',
            message: 'CLOUD PREVIEW — LOCAL PRINTER ACCESS UNAVAILABLE',
            printerStatusText: 'CLOUD PREVIEW — LOCAL PRINTER ACCESS UNAVAILABLE',
          });
          setHardwareLoaded(true);
        });
    }
  }, [isOpen]);

  if (!isOpen || !product) return null;

  // Determine status card text and style according to 3 explicit states:
  // STATE A (CLOUD_PREVIEW): "CLOUD PREVIEW — LOCAL PRINTER ACCESS UNAVAILABLE"
  // STATE B (LOCAL_BRIDGE_OFFLINE): "LOCAL TSC PRINT BRIDGE OFFLINE — Please start the TSC Print Bridge."
  // STATE C (LOCAL_BRIDGE_CONNECTED): "LOCAL TSC PRINT BRIDGE CONNECTED — TSC TTP-244 Pro Ready"
  let statusCardText = "CLOUD PREVIEW — LOCAL PRINTER ACCESS UNAVAILABLE";
  let statusBadgeType: 'preview' | 'online' | 'offline' = 'preview';

  if (hardwareLoaded && bridgeHealth) {
    if (bridgeHealth.state === 'LOCAL_BRIDGE_CONNECTED') {
      statusCardText = `LOCAL TSC PRINT BRIDGE CONNECTED — ${selectedPrinter} Ready`;
      statusBadgeType = 'online';
    } else if (bridgeHealth.state === 'LOCAL_BRIDGE_OFFLINE') {
      statusCardText = "LOCAL TSC PRINT BRIDGE OFFLINE — Please start the TSC Print Bridge.";
      statusBadgeType = 'offline';
    } else {
      statusCardText = "CLOUD PREVIEW — LOCAL PRINTER ACCESS UNAVAILABLE";
      statusBadgeType = 'preview';
    }
  }

  const handleFetchTsplSimulation = async () => {
    const w = labelSize === 'compact' ? 30 : 50;
    const h = labelSize === 'compact' ? 20 : 30;

    const res = await printBridgeService.printLabel({
      productName: product.name,
      barcode: product.barcode || product.sku || '1234567890',
      sku: product.sku,
      price: product.salePrice,
      copies,
      labelWidthMm: w,
      labelHeightMm: h,
      printerName: selectedPrinter,
    });

    setTsplPayload(res.tsplCommands);
    setShowSimulation(true);
  };

  const handleExecutePrint = async () => {
    setIsPrinting(true);
    setPrintStatus(null);

    const w = labelSize === 'compact' ? 30 : 50;
    const h = labelSize === 'compact' ? 20 : 30;

    try {
      const res: PrintResult = await printBridgeService.printLabel({
        productName: product.name,
        barcode: product.barcode || product.sku || '1234567890',
        sku: product.sku,
        price: product.salePrice,
        copies,
        labelWidthMm: w,
        labelHeightMm: h,
        printerName: selectedPrinter,
      });

      if (res.isSimulation) {
        // Cloud Preview Mode: open TSPL simulation dialog & inform user
        setTsplPayload(res.tsplCommands);
        setPrintStatus({
          success: true,
          isPreview: true,
          message: 'Physical printing is unavailable in Cloud Preview. TSPL simulation is active.',
        });
        setShowSimulation(true);
      } else if (res.state === 'LOCAL_BRIDGE_OFFLINE') {
        // Local bridge offline
        setPrintStatus({
          success: false,
          isPreview: false,
          message: res.message,
        });
      } else {
        // Local physical print response
        setPrintStatus({
          success: res.success,
          isPreview: false,
          message: res.message,
        });
      }
    } catch (err: any) {
      setPrintStatus({
        success: false,
        isPreview: true,
        message: 'Physical print failed. Check the TSC printer and Print Bridge.',
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const copyTsplCode = () => {
    navigator.clipboard.writeText(tsplPayload);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      {/* Printable Area Styles optimized for TSC TTP-244 Pro thermal printer (50mm x 30mm) */}
      <style>{`
        @page {
          size: 50mm 30mm;
          margin: 0mm;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #barcode-printable-area, #barcode-printable-area *, #barcode-printable-area .label-item {
            visibility: visible;
          }
          #barcode-printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            margin: 0;
            padding: 0;
            display: block;
          }
          .label-item {
            width: 50mm;
            height: 30mm;
            page-break-after: always;
            break-after: page;
            margin: 0;
            padding: 2mm;
            box-sizing: border-box;
            background: white !important;
            color: black !important;
            border: none !important;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 no-print">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Print Barcode Labels (TSC TTP-244 Pro Ready)</h2>
              <p className="text-[11px] text-slate-400">
                {product.name} • SKU: {product.sku || 'N/A'} • Barcode: {product.barcode}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onClose(); }}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">

          {/* Printer Status Card */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
            statusBadgeType === 'online'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : statusBadgeType === 'offline'
              ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
              : 'bg-blue-950/40 border-blue-500/40 text-blue-200'
          }`}>
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full shrink-0 ${
                statusBadgeType === 'online'
                  ? 'bg-emerald-400 animate-pulse'
                  : statusBadgeType === 'offline'
                  ? 'bg-amber-400'
                  : 'bg-blue-400'
              }`} />
              <span className="font-bold text-xs">{statusCardText}</span>
            </div>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); handleFetchTsplSimulation(); }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-[11px] flex items-center gap-1.5 transition-all"
            >
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>TSPL Simulation</span>
            </button>
          </div>

          {printStatus && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                printStatus.success && !printStatus.isPreview
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                  : 'bg-blue-950/80 border-blue-500/50 text-blue-200'
              }`}
            >
              {printStatus.success && !printStatus.isPreview ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              )}
              <div>
                <strong className="block font-bold">
                  {printStatus.isPreview ? 'Preview Mode Active' : 'Print Job Queued Successfully'}
                </strong>
                <span className="text-[11px] opacity-90">{printStatus.message}</span>
              </div>
            </div>
          )}

          {/* Print Options Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 no-print">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Number of Copies
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setCopies((prev) => Math.max(1, prev - 1))}
                  className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl flex items-center justify-center font-bold"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-center font-bold text-slate-100 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setCopies((prev) => prev + 1)}
                  className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl flex items-center justify-center font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Label Size</label>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-semibold"
              >
                <option value="standard">50mm x 30mm (Standard)</option>
                <option value="small">50mm x 25mm (Compact)</option>
                <option value="compact">30mm x 20mm (Mini Tag)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Windows Printer</label>
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-semibold"
              >
                {printers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Printable Labels Sheet Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between no-print">
              <span className="text-slate-400 font-medium text-[11px] uppercase tracking-wider">
                Live Label Sheet Preview ({copies} Copies) • Target: {selectedPrinter}
              </span>
              <span className="text-blue-400 text-[11px] font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                TSPL Payload Ready
              </span>
            </div>

            <div
              id="barcode-printable-area"
              className="bg-white rounded-2xl p-5 border border-slate-200 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-slate-900 shadow-inner max-h-[260px] overflow-y-auto"
            >
              {Array.from({ length: copies }).map((_, index) => (
                <div
                  key={index}
                  className="label-item border border-slate-300 rounded-lg p-2 text-center bg-white flex flex-col items-center justify-between shadow-sm min-h-[100px]"
                >
                  <div className="w-full">
                    <p className="font-extrabold text-[10px] leading-tight text-slate-900 truncate">
                      Unique Sweets & Bakers
                    </p>
                    <p className="font-bold text-[11px] text-slate-800 truncate my-0.5">
                      {product.name}
                    </p>
                  </div>

                  <div className="my-0.5 w-full flex justify-center">
                    <BarcodeImage
                      value={product.barcode || product.sku || '1234567890'}
                      width={labelSize === 'compact' ? 1.1 : 1.4}
                      height={labelSize === 'compact' ? 25 : 35}
                      fontSize={9}
                    />
                  </div>

                  <div className="w-full border-t border-slate-200 pt-0.5 flex items-center justify-between text-[9px] text-slate-600 font-mono">
                    <span className="font-semibold truncate max-w-[50%]" title={product.sku}>{product.sku || 'SKU'}</span>
                    <span className="font-black text-slate-900">
                      Rs. {(product.salePrice || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="p-5 bg-slate-950 border-t border-slate-800 flex justify-between items-center no-print">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onClose(); }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
          >
            Close
          </button>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); handleFetchTsplSimulation(); }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl flex items-center space-x-2 border border-slate-700"
            >
              <Eye className="w-4 h-4 text-blue-400" />
              <span>TSPL Preview</span>
            </button>

            <button
              type="button"
              onClick={(e) => { e.preventDefault(); handleExecutePrint(); }}
              disabled={isPrinting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center space-x-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {isPrinting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Job...</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>Print {copies} Labels ({selectedPrinter})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* TSPL Payload / Print Simulation Modal */}
      {showSimulation && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-slate-200">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-blue-600/20 text-blue-400 rounded-xl flex items-center justify-center font-bold">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">TSPL Print Payload Diagnostics</h3>
                  <p className="text-[11px] text-slate-400">
                    Exact raw commands sent to TSC TTP-244 Pro via Windows Spooler
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setShowSimulation(false); }}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-[11px]">
                <div>
                  <span className="block text-slate-500 font-semibold">Dimensions</span>
                  <strong className="text-slate-200">50 × 30 mm</strong>
                </div>
                <div>
                  <span className="block text-slate-500 font-semibold">Barcode Type</span>
                  <strong className="text-slate-200">CODE 128</strong>
                </div>
                <div>
                  <span className="block text-slate-500 font-semibold">Copies</span>
                  <strong className="text-slate-200">{copies}</strong>
                </div>
                <div>
                  <span className="block text-slate-500 font-semibold">Price</span>
                  <strong className="text-emerald-400">Rs. {product.salePrice}</strong>
                </div>
              </div>

              {/* Product Info */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-400">Product Name: </span>
                  <strong className="text-white ml-1">{product.name}</strong>
                </div>
                <div>
                  <span className="text-slate-400">SKU / Barcode: </span>
                  <strong className="text-mono font-bold text-blue-400 ml-1">{product.barcode || product.sku}</strong>
                </div>
              </div>

              {/* TSPL Code Box */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-slate-400 text-[11px] font-semibold">Raw TSPL Payload Stream</span>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); copyTsplCode(); }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                  >
                    {copiedCode ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Commands</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-emerald-400 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-52">
                  {tsplPayload || 'SIZE 50 mm,30 mm\r\nGAP 2 mm,0 mm\r\nCLS\r\n...'}
                </pre>
              </div>

              <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-xl text-blue-300 text-[11px]">
                <strong>Preview Mode Diagnostic:</strong> This TSPL string is identical to the byte stream forwarded to <code>http://127.0.0.1:9100/print</code> when running locally on Windows.
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setShowSimulation(false); }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
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
