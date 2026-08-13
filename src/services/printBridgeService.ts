/**
 * Centralized TSC Print Bridge Service
 * Manages local hardware communication vs. AI Studio Cloud Preview simulation.
 *
 * States:
 * 1. CLOUD_PREVIEW: App running in AI Studio cloud preview. Does NOT call 127.0.0.1:9100.
 * 2. LOCAL_BRIDGE_OFFLINE: App running locally, but 127.0.0.1:9100 is unreachable.
 * 3. LOCAL_BRIDGE_CONNECTED: App running locally, 127.0.0.1:9100/health returns status ok.
 */

import { generateTSPLCommands } from '../utils/tspl';
import { apiFetch } from './api';

export type PrintEnvironmentState =
  | 'CLOUD_PREVIEW'
  | 'LOCAL_BRIDGE_OFFLINE'
  | 'LOCAL_BRIDGE_CONNECTED';

export interface HealthCheckResult {
  state: PrintEnvironmentState;
  connected: boolean;
  service: string;
  message: string;
  printerStatusText: string;
}

export interface PrintLabelOptions {
  printerName?: string;
  jobType?: string;
  productName: string;
  barcode: string;
  price: number;
  sku?: string;
  copies?: number;
  labelWidthMm?: number;
  labelHeightMm?: number;
  labelGapMm?: number;
  density?: number;
  speed?: number;
  bridgeUrl?: string;
}

export interface PrintResult {
  success: boolean;
  state: PrintEnvironmentState;
  isSimulation: boolean;
  message: string;
  tsplCommands: string;
  byteCount?: number;
  firstByteHex?: string;
  lastByteHex?: string;
  details: {
    printerName: string;
    dimensions: string;
    barcodeType: string;
    productName: string;
    barcode: string;
    sku: string;
    price: number;
    copies: number;
  };
}

/**
 * Checks if the application origin is local (e.g. localhost, 127.0.0.1)
 */
export function isLocalEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local')
  );
}

/**
 * Perform print bridge health check safely.
 * If running in Cloud Preview, returns CLOUD_PREVIEW without making any network call to 127.0.0.1.
 */
export async function checkHealth(
  bridgeUrl = 'http://127.0.0.1:9100'
): Promise<HealthCheckResult> {
  // If not local origin (e.g. Cloud Preview in AI Studio), bypass 127.0.0.1 network call entirely
  if (!isLocalEnvironment()) {
    return {
      state: 'CLOUD_PREVIEW',
      connected: false,
      service: 'cloud-preview',
      message: 'CLOUD PREVIEW — LOCAL PRINTER ACCESS UNAVAILABLE',
      printerStatusText: 'CLOUD PREVIEW — LOCAL PRINTER ACCESS UNAVAILABLE',
    };
  }

  // Running locally: check http://127.0.0.1:9100/health with short 2000ms timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${bridgeUrl}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.status === 'ok' || data.service === 'tsc-print-bridge') {
        return {
          state: 'LOCAL_BRIDGE_CONNECTED',
          connected: true,
          service: data.service || 'tsc-print-bridge',
          message: 'LOCAL TSC PRINT BRIDGE CONNECTED',
          printerStatusText: 'LOCAL TSC PRINT BRIDGE CONNECTED — TSC TTP-244 Pro Ready',
        };
      }
    }
    return {
      state: 'LOCAL_BRIDGE_OFFLINE',
      connected: false,
      service: 'none',
      message: 'LOCAL TSC PRINT BRIDGE OFFLINE — Please start the TSC Print Bridge.',
      printerStatusText: 'LOCAL TSC PRINT BRIDGE OFFLINE — Please start the TSC Print Bridge.',
    };
  } catch (err) {
    return {
      state: 'LOCAL_BRIDGE_OFFLINE',
      connected: false,
      service: 'none',
      message: 'LOCAL TSC PRINT BRIDGE OFFLINE — Please start the TSC Print Bridge.',
      printerStatusText: 'LOCAL TSC PRINT BRIDGE OFFLINE — Please start the TSC Print Bridge.',
    };
  }
}

/**
 * Get current environment print state
 */
export async function getStatus(bridgeUrl?: string): Promise<PrintEnvironmentState> {
  const health = await checkHealth(bridgeUrl);
  return health.state;
}

/**
 * Print label or initiate simulation mode based on environment state
 */
export async function printLabel(options: PrintLabelOptions): Promise<PrintResult> {
  const w = options.labelWidthMm || 50;
  const h = options.labelHeightMm || 30;
  const c = Math.max(1, parseInt(String(options.copies ?? 1)) || 1);
  const printerName = options.printerName || 'TSC TTP-244 Pro';

  // Generate exact TSPL payload
  const tsplCommands = generateTSPLCommands({
    widthMm: w,
    heightMm: h,
    gapMm: options.labelGapMm || 2,
    density: options.density || 8,
    speed: options.speed || 4,
    productName: options.productName,
    barcode: options.barcode,
    price: options.price,
    sku: options.sku,
    copies: c,
  });

  const printCmds = tsplCommands.match(/^PRINT\s+.*$/gm) || [];
  console.log('=== TSPL PAYLOAD START ===\n' + tsplCommands + '\n=== TSPL PAYLOAD END ===');
  console.log('TSPL Job Details:', {
    copies: c,
    labelWidth: w,
    labelHeight: h,
    barcode: options.barcode,
    sku: options.sku || 'N/A',
    price: options.price,
    numberOfPrintCommands: printCmds.length,
    exactPrintCommand: printCmds[0] || 'N/A',
  });

  const details = {
    printerName,
    dimensions: `${w} × ${h} mm`,
    barcodeType: 'CODE128',
    productName: options.productName,
    barcode: options.barcode,
    sku: options.sku || 'N/A',
    price: options.price,
    copies: c,
  };

  const health = await checkHealth(options.bridgeUrl);

  // STATE A: CLOUD PREVIEW MODE
  if (health.state === 'CLOUD_PREVIEW') {
    // Log to backend audit trail if available without attempting physical print
    apiFetch<any>('/hardware/print-jobs/submit', {
      method: 'POST',
      body: JSON.stringify({
        printerName,
        jobType: options.jobType || 'BARCODE_LABEL',
        productName: options.productName,
        copies: c,
        skipBridgeCall: true,
        data: {
          name: options.productName,
          barcode: options.barcode,
          price: options.price,
          sku: options.sku,
        },
      }),
    }).catch(() => {});

    return {
      success: true,
      state: 'CLOUD_PREVIEW',
      isSimulation: true,
      message: 'Physical printing is unavailable in Cloud Preview. TSPL simulation is active.',
      tsplCommands,
      details,
    };
  }

  // STATE B: LOCAL BRIDGE OFFLINE
  if (health.state === 'LOCAL_BRIDGE_OFFLINE') {
    return {
      success: false,
      state: 'LOCAL_BRIDGE_OFFLINE',
      isSimulation: false,
      message: 'Local TSC Print Bridge is offline. Please start the Print Bridge at http://127.0.0.1:9100.',
      tsplCommands,
      details,
    };
  }

  // STATE C: LOCAL BRIDGE CONNECTED
  const targetBridgeUrl = options.bridgeUrl || 'http://127.0.0.1:9100';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for print request

    const resp = await fetch(`${targetBridgeUrl}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer: printerName,
        printerName,
        copies: c,
        jobType: options.jobType || 'BARCODE_LABEL',
        tspl: tsplCommands,
        tsplCommands,
        data: {
          name: options.productName,
          productName: options.productName,
          barcode: options.barcode,
          price: options.price,
          sku: options.sku,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      // Record job in backend audit trail without triggering duplicate print (TASK 7)
      apiFetch<any>('/hardware/print-jobs/submit', {
        method: 'POST',
        body: JSON.stringify({
          printerName,
          jobType: options.jobType || 'BARCODE_LABEL',
          productName: options.productName,
          copies: c,
          skipBridgeCall: true,
          data: {
            name: options.productName,
            barcode: options.barcode,
            price: options.price,
            sku: options.sku,
          },
        }),
      }).catch(() => {});

      return {
        success: true,
        state: 'LOCAL_BRIDGE_CONNECTED',
        isSimulation: false,
        message: `RAW TSPL payload successfully submitted to Windows printer spooler for "${printerName}" (${c} label copy/copies requested).`,
        tsplCommands,
        details,
      };
    } else {
      return {
        success: false,
        state: 'LOCAL_BRIDGE_CONNECTED',
        isSimulation: false,
        message: 'Physical print failed. Check the TSC printer and Print Bridge.',
        tsplCommands,
        details,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      state: 'LOCAL_BRIDGE_CONNECTED',
      isSimulation: false,
      message: 'Physical print failed. Check the TSC printer and Print Bridge.',
      tsplCommands,
      details,
    };
  }
}

/**
 * Execute minimal diagnostic test print
 */
export async function testPrint(
  printerName?: string,
  bridgeUrl?: string
): Promise<PrintResult> {
  const targetPrinter = printerName || 'TSC TTP-244 Pro';
  const targetBridgeUrl = bridgeUrl || 'http://127.0.0.1:9100';

  const testTspl = [
    'SIZE 50 mm, 30 mm',
    'GAP 2 mm, 0 mm',
    'DIRECTION 1',
    'CLS',
    'TEXT 20,20,"2",0,1,1,"TSC TEST"',
    'BARCODE 20,60,"128",50,1,0,2,2,"123456789"',
    'PRINT 1,1',
    ''
  ].join('\r\n');

  const printCmds = testTspl.match(/^PRINT\s+.*$/gm) || [];
  console.log('=== TSPL PAYLOAD START ===\n' + testTspl + '\n=== TSPL PAYLOAD END ===');
  console.log('Diagnostic Test TSPL Details:', {
    copies: 1,
    labelWidth: 50,
    labelHeight: 30,
    barcode: '123456789',
    numberOfPrintCommands: printCmds.length,
    exactPrintCommand: printCmds[0] || 'N/A',
  });

  const details = {
    printerName: targetPrinter,
    dimensions: '50 × 30 mm',
    barcodeType: 'CODE128',
    productName: 'TSC DIAGNOSTIC TEST',
    barcode: '123456789',
    sku: 'TSC-TEST',
    price: 0,
    copies: 1,
  };

  const health = await checkHealth(targetBridgeUrl);

  if (health.state === 'CLOUD_PREVIEW') {
    return {
      success: true,
      state: 'CLOUD_PREVIEW',
      isSimulation: true,
      message: 'Cloud preview active. Diagnostic TSPL prepared for simulation.',
      tsplCommands: testTspl,
      details,
    };
  }

  if (health.state === 'LOCAL_BRIDGE_OFFLINE') {
    return {
      success: false,
      state: 'LOCAL_BRIDGE_OFFLINE',
      isSimulation: false,
      message: 'Local TSC Print Bridge is offline.',
      tsplCommands: testTspl,
      details,
    };
  }

  try {
    const resp = await fetch(`${targetBridgeUrl}/test-print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerName: targetPrinter, printer: targetPrinter }),
    });
    const data = await resp.json();
    return {
      success: data.success,
      state: 'LOCAL_BRIDGE_CONNECTED',
      isSimulation: false,
      message: data.message || (data.success ? 'Test label submitted.' : 'Test label print failed.'),
      tsplCommands: data.tsplCommands || testTspl,
      byteCount: data.byteCount,
      firstByteHex: data.firstByteHex,
      lastByteHex: data.lastByteHex,
      details,
    };
  } catch (err: any) {
    return {
      success: false,
      state: 'LOCAL_BRIDGE_CONNECTED',
      isSimulation: false,
      message: 'Physical test print failed. Bridge call failed.',
      tsplCommands: testTspl,
      details,
    };
  }
}

/**
 * Execute RAW TEXT diagnostic test
 */
export async function sendRawTextTest(
  printerName?: string,
  bridgeUrl?: string
): Promise<PrintResult> {
  const targetPrinter = printerName || 'TSC TTP-244 Pro';
  const targetBridgeUrl = bridgeUrl || 'http://127.0.0.1:9100';

  const tspl = [
    'SIZE 50 mm, 30 mm',
    'GAP 2 mm, 0 mm',
    'DIRECTION 1',
    'CLS',
    'TEXT 20,20,"2",0,1,1,"TSC TEXT TEST"',
    'PRINT 1,1',
    ''
  ].join('\r\n');

  const details = {
    printerName: targetPrinter,
    dimensions: '50 × 30 mm',
    barcodeType: 'NONE',
    productName: 'TSC TEXT DIAGNOSTIC',
    barcode: 'N/A',
    sku: 'TEXT-ONLY',
    price: 0,
    copies: 1,
  };

  const health = await checkHealth(targetBridgeUrl);

  if (health.state === 'CLOUD_PREVIEW') {
    return {
      success: true,
      state: 'CLOUD_PREVIEW',
      isSimulation: true,
      message: 'Cloud preview active. RAW TEXT test commands prepared.',
      tsplCommands: tspl,
      details,
    };
  }

  if (health.state === 'LOCAL_BRIDGE_OFFLINE') {
    return {
      success: false,
      state: 'LOCAL_BRIDGE_OFFLINE',
      isSimulation: false,
      message: 'Local TSC Print Bridge is offline.',
      tsplCommands: tspl,
      details,
    };
  }

  try {
    const resp = await fetch(`${targetBridgeUrl}/raw-text-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerName: targetPrinter, printer: targetPrinter }),
    });
    const data = await resp.json();
    return {
      success: data.success,
      state: 'LOCAL_BRIDGE_CONNECTED',
      isSimulation: false,
      message: data.message || (data.success ? 'RAW TEXT test submitted.' : 'RAW TEXT test failed.'),
      tsplCommands: data.tsplCommands || tspl,
      byteCount: data.byteCount,
      firstByteHex: data.firstByteHex,
      lastByteHex: data.lastByteHex,
      details,
    };
  } catch (err: any) {
    return {
      success: false,
      state: 'LOCAL_BRIDGE_CONNECTED',
      isSimulation: false,
      message: 'RAW TEXT test submission failed.',
      tsplCommands: tspl,
      details,
    };
  }
}

/**
 * Execute RAW CODE128 diagnostic test
 */
export async function sendRawCode128Test(
  printerName?: string,
  bridgeUrl?: string
): Promise<PrintResult> {
  const targetPrinter = printerName || 'TSC TTP-244 Pro';
  const targetBridgeUrl = bridgeUrl || 'http://127.0.0.1:9100';

  const tspl = [
    'SIZE 50 mm, 30 mm',
    'GAP 2 mm, 0 mm',
    'DIRECTION 1',
    'CLS',
    'TEXT 20,20,"2",0,1,1,"TSC TEST"',
    'BARCODE 20,60,"128",50,1,0,2,2,"123456789"',
    'PRINT 1,1',
    ''
  ].join('\r\n');

  const printCmds = tspl.match(/^PRINT\s+.*$/gm) || [];
  console.log('=== TSPL PAYLOAD START ===\n' + tspl + '\n=== TSPL PAYLOAD END ===');
  console.log('RAW CODE128 Diagnostic Payload Details:', {
    copies: 1,
    labelWidth: 50,
    labelHeight: 30,
    barcode: '123456789',
    numberOfPrintCommands: printCmds.length,
    exactPrintCommand: printCmds[0] || 'N/A',
  });

  const details = {
    printerName: targetPrinter,
    dimensions: '50 × 30 mm',
    barcodeType: 'CODE128',
    productName: 'TSC CODE128 DIAGNOSTIC',
    barcode: '123456789',
    sku: 'CODE128-ONLY',
    price: 0,
    copies: 1,
  };

  const health = await checkHealth(targetBridgeUrl);

  if (health.state === 'CLOUD_PREVIEW') {
    return {
      success: true,
      state: 'CLOUD_PREVIEW',
      isSimulation: true,
      message: 'Cloud preview active. RAW CODE128 test commands prepared.',
      tsplCommands: tspl,
      details,
    };
  }

  if (health.state === 'LOCAL_BRIDGE_OFFLINE') {
    return {
      success: false,
      state: 'LOCAL_BRIDGE_OFFLINE',
      isSimulation: false,
      message: 'Local TSC Print Bridge is offline.',
      tsplCommands: tspl,
      details,
    };
  }

  try {
    const resp = await fetch(`${targetBridgeUrl}/raw-code128-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerName: targetPrinter, printer: targetPrinter }),
    });
    const data = await resp.json();
    return {
      success: data.success,
      state: 'LOCAL_BRIDGE_CONNECTED',
      isSimulation: false,
      message: data.message || (data.success ? 'RAW CODE128 test submitted.' : 'RAW CODE128 test failed.'),
      tsplCommands: data.tsplCommands || tspl,
      byteCount: data.byteCount,
      firstByteHex: data.firstByteHex,
      lastByteHex: data.lastByteHex,
      details,
    };
  } catch (err: any) {
    return {
      success: false,
      state: 'LOCAL_BRIDGE_CONNECTED',
      isSimulation: false,
      message: 'RAW CODE128 test submission failed.',
      tsplCommands: tspl,
      details,
    };
  }
}

/**
 * Execute RAW MINIMAL diagnostic test (TASK 3 & TASK 5)
 */
export async function sendRawMinimalTest(
  printerName?: string,
  bridgeUrl?: string
): Promise<PrintResult> {
  const targetPrinter = printerName || 'TSC TTP-244 Pro';
  const targetBridgeUrl = bridgeUrl || 'http://127.0.0.1:9100';

  const minimalTspl = [
    'SIZE 50 mm,30 mm',
    'GAP 2 mm,0 mm',
    'SPEED 4',
    'DENSITY 8',
    'DIRECTION 0',
    'CLS',
    'TEXT 20,20,"0",0,1,1,"TEST"',
    'BARCODE 20,60,"128",50,1,0,2,2,"123456789"',
    'PRINT 1,1',
    ''
  ].join('\r\n');

  const details = {
    printerName: targetPrinter,
    dimensions: '50 × 30 mm',
    barcodeType: 'CODE128',
    productName: 'TEST',
    barcode: '123456789',
    sku: 'NONE',
    price: 0,
    copies: 1,
  };

  const printCmds = minimalTspl.match(/^PRINT\s+.*$/gm) || [];
  console.log('=== TSPL PAYLOAD START ===\n' + minimalTspl + '\n=== TSPL PAYLOAD END ===');
  console.log('RAW Minimal Test Details:', {
    copies: 1,
    labelWidth: 50,
    labelHeight: 30,
    barcode: '123456789',
    sku: 'TEST-001',
    price: 1400,
    numberOfPrintCommands: printCmds.length,
    exactPrintCommand: printCmds[0] || 'N/A',
  });

  const health = await checkHealth(targetBridgeUrl);

  if (health.state === 'CLOUD_PREVIEW') {
    return {
      success: true,
      state: 'CLOUD_PREVIEW',
      isSimulation: true,
      message: 'Cloud preview active. RAW MINIMAL test commands prepared.',
      tsplCommands: minimalTspl,
      details,
    };
  }

  if (health.state === 'LOCAL_BRIDGE_OFFLINE') {
    return {
      success: false,
      state: 'LOCAL_BRIDGE_OFFLINE',
      isSimulation: false,
      message: 'Local TSC Print Bridge is offline.',
      tsplCommands: minimalTspl,
      details,
    };
  }

  try {
    const resp = await fetch(`${targetBridgeUrl}/raw-debug-print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerName: targetPrinter, printer: targetPrinter }),
    });
    const data = await resp.json();
    return {
      success: data.success,
      state: 'LOCAL_BRIDGE_CONNECTED',
      isSimulation: false,
      message: data.message || (data.success ? 'RAW MINIMAL test submitted to spooler.' : 'RAW MINIMAL test failed.'),
      tsplCommands: data.tsplCommands || minimalTspl,
      byteCount: data.byteCount,
      firstByteHex: data.firstByteHex,
      lastByteHex: data.lastByteHex,
      details,
    };
  } catch (err: any) {
    return {
      success: false,
      state: 'LOCAL_BRIDGE_CONNECTED',
      isSimulation: false,
      message: 'RAW MINIMAL test submission failed.',
      tsplCommands: minimalTspl,
      details,
    };
  }
}

export const printBridgeService = {
  isLocalEnvironment,
  checkHealth,
  getStatus,
  printLabel,
  testPrint,
  sendRawMinimalTest,
  sendRawTextTest,
  sendRawCode128Test,
};
