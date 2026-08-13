/**
 * TSC Printer Language (TSPL / TSPL2) Command Generator for TSC TTP-244 Pro
 * Generates raw command strings for thermal barcode printers.
 */

interface TSPLJobOptions {
  widthMm?: number;
  heightMm?: number;
  gapMm?: number;
  density?: number;
  speed?: number;
  productName: string;
  barcode: string;
  price: number;
  sku?: string;
  copies?: number;
}

export function generateTSPLCommands(options: TSPLJobOptions): string {
  const width = options.widthMm || 50;
  const height = options.heightMm || 30;
  const gap = options.gapMm || 2;
  const density = options.density || 8;
  const speed = options.speed || 4;
  const copies = Math.max(1, parseInt(String(options.copies ?? 1)) || 1);

  const barcodeValue = options.barcode || options.sku || '1234567890';
  const productName = (options.productName || 'Bakery Item').substring(0, 24);
  const priceText = `Rs. ${Number(options.price || 0).toLocaleString()}`;
  const skuText = options.sku ? `SKU: ${options.sku}` : '';

  let tspl = '';
  // Setup printer parameters with strict CRLF line endings
  tspl += `SIZE ${width} mm, ${height} mm\r\n`;
  tspl += `GAP ${gap} mm, 0 mm\r\n`;
  tspl += `SPEED ${speed}\r\n`;
  tspl += `DENSITY ${density}\r\n`;
  tspl += `DIRECTION 1\r\n`;
  tspl += `CLS\r\n`;

  // Print business header (Unique Sweets header fits 50mm label without overflow)
  tspl += `TEXT 20, 10, "2", 0, 1, 1, "Unique Sweets"\r\n`;

  // Print product name
  tspl += `TEXT 20, 35, "2", 0, 1, 1, "${productName}"\r\n`;

  // Print Barcode (CODE128)
  // Syntax: BARCODE x,y,"type",height,human_readable,rotation,narrow_bar,wide_bar,"code"
  tspl += `BARCODE 20, 65, "128", 55, 1, 0, 2, 2, "${barcodeValue}"\r\n`;

  // Print SKU & Price footer
  if (skuText) {
    tspl += `TEXT 20, 130, "1", 0, 1, 1, "${skuText}"\r\n`;
  }
  tspl += `TEXT 20, 150, "2", 0, 1, 1, "${priceText}"\r\n`;

  // Single PRINT command with total copies
  tspl += `PRINT ${copies},1\r\n`;

  return tspl;
}
