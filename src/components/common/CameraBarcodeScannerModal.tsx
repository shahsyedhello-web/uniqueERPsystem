import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { X, Camera, RefreshCw, Volume2, AlertCircle } from 'lucide-react';
import { playBarcodeBeep } from '../../utils/barcode';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcode: string) => void;
  title?: string;
}

export const CameraBarcodeScannerModal: React.FC<CameraBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan Product Barcode with Camera',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const codeReader = new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;

    async function initCamera() {
      try {
        setErrorMsg(null);
        setIsScanning(true);

        const devices = await codeReader.listVideoInputDevices();
        if (!isMounted) return;

        setVideoDevices(devices);

        if (devices.length === 0) {
          setErrorMsg('No camera device detected on this system.');
          setIsScanning(false);
          return;
        }

        // Prefer back camera if available, or first device
        const backCamera = devices.find(
          (d) =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('environment') ||
            d.label.toLowerCase().includes('rear')
        );
        const deviceIdToUse = backCamera ? backCamera.deviceId : devices[0].deviceId;
        setSelectedDeviceId(deviceIdToUse);

        startScanning(codeReader, deviceIdToUse);
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Camera initialization error:', err);
        setErrorMsg(err.message || 'Camera permission denied or camera unavailable.');
        setIsScanning(false);
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      stopScanning();
    };
  }, [isOpen]);

  const startScanning = (codeReader: BrowserMultiFormatReader, deviceId: string) => {
    if (!videoRef.current) return;

    codeReader.decodeFromVideoDevice(
      deviceId,
      videoRef.current,
      (result, err) => {
        if (result) {
          const scannedText = result.getText().trim();
          if (scannedText) {
            playBarcodeBeep('success');
            onScanSuccess(scannedText);
            stopScanning();
            onClose();
          }
        }
      }
    );
  };

  const stopScanning = () => {
    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
      } catch (e) {
        console.warn('Reset camera error:', e);
      }
    }
    setIsScanning(false);
  };

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDeviceId = e.target.value;
    setSelectedDeviceId(newDeviceId);
    stopScanning();
    if (codeReaderRef.current) {
      startScanning(codeReaderRef.current, newDeviceId);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{title}</h2>
              <p className="text-[11px] text-slate-400">
                Align barcode within camera view (EAN-13, UPC, Code 128)
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanning();
              onClose();
            }}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Viewport */}
        <div className="p-6 relative bg-slate-950 flex flex-col items-center justify-center min-h-[300px]">
          {errorMsg ? (
            <div className="p-5 bg-red-950/50 border border-red-800/50 rounded-2xl text-center space-y-2 max-w-sm">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
              <p className="text-xs font-semibold text-red-200">{errorMsg}</p>
              <p className="text-[11px] text-red-300/80">
                Please grant camera permissions in your browser or connect a USB barcode scanner instead.
              </p>
            </div>
          ) : (
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-slate-700 bg-black shadow-inner">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />

              {/* Scanning Reticle Overlay */}
              <div className="absolute inset-0 border-2 border-blue-500/40 rounded-2xl pointer-events-none flex items-center justify-center">
                <div className="w-3/4 h-1/2 border-2 border-emerald-400/90 rounded-xl relative shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500/80 animate-pulse" />
                  <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-400" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-400" />
                  <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-400" />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-400" />
                </div>
              </div>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-bold text-emerald-400 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Camera Live • Scanning...</span>
              </div>
            </div>
          )}

          {/* Camera selector if multiple cameras exist */}
          {videoDevices.length > 1 && (
            <div className="mt-4 w-full flex items-center justify-center space-x-2">
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedDeviceId}
                onChange={handleDeviceChange}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {videoDevices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-xs">
          <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Audio feedback enabled on scan</span>
          </div>
          <button
            onClick={() => {
              stopScanning();
              onClose();
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
