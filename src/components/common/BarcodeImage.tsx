import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeImageProps {
  value: string;
  format?: string;
  width?: number;
  height?: number;
  fontSize?: number;
  displayValue?: boolean;
  className?: string;
}

export const BarcodeImage: React.FC<BarcodeImageProps> = ({
  value,
  format = 'CODE128',
  width = 1.8,
  height = 45,
  fontSize = 12,
  displayValue = true,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        // Auto select format or fallback to CODE128 for arbitrary strings
        let selectedFormat = format;
        if (/^\d{13}$/.test(value)) {
          selectedFormat = 'EAN13';
        } else if (/^\d{8}$/.test(value)) {
          selectedFormat = 'EAN8';
        } else if (/^\d{12}$/.test(value)) {
          selectedFormat = 'UPC';
        } else {
          selectedFormat = 'CODE128';
        }

        JsBarcode(svgRef.current, value, {
          format: selectedFormat,
          width: width,
          height: height,
          displayValue: displayValue,
          fontSize: fontSize,
          margin: 6,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (err) {
        // Fallback to CODE128 if EAN format fails
        try {
          JsBarcode(svgRef.current, value, {
            format: 'CODE128',
            width: width,
            height: height,
            displayValue: displayValue,
            fontSize: fontSize,
            margin: 6,
            background: '#ffffff',
            lineColor: '#000000',
          });
        } catch (e) {
          console.error('Barcode render error:', e);
        }
      }
    }
  }, [value, format, width, height, fontSize, displayValue]);

  if (!value) return null;

  return (
    <div className={`inline-block bg-white p-1 rounded border border-slate-200 overflow-hidden ${className}`}>
      <style>{`
        @media print {
          svg, svg rect, svg path, svg text {
            fill: #000000 !important;
            color: #000000 !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      <svg ref={svgRef} className="max-w-full h-auto block mx-auto text-black fill-black" style={{ shapeRendering: 'crispEdges' }} />
    </div>
  );
};
