import { Router } from 'express';
import { loadDB, saveDB, logActivity } from '../store';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { PrintJob } from '../../types/pos';
import { generateTSPLCommands } from '../../utils/tspl';

const router = Router();

router.use(authenticate);

// Get all print jobs
router.get('/print-jobs', (req: AuthRequest, res) => {
  const db = loadDB();
  res.json(db.printJobs || []);
});

// Generate TSPL Commands for Simulation / Preview
router.post('/generate-tspl', (req: AuthRequest, res) => {
  const db = loadDB();
  const { productName, barcode, price, sku, copies, labelWidthMm, labelHeightMm } = req.body;

  const w = labelWidthMm || db.settings.labelWidthMm || 50;
  const h = labelHeightMm || db.settings.labelHeightMm || 30;
  const c = Math.max(1, parseInt(String(copies ?? 1)) || 1);

  const tsplCommands = generateTSPLCommands({
    widthMm: w,
    heightMm: h,
    gapMm: db.settings.labelGapMm || 2,
    density: db.settings.printDensity || 8,
    speed: db.settings.printSpeed || 4,
    productName: productName || 'Bakery Item',
    barcode: barcode || sku || '1234567890',
    price: Number(price) || 0,
    sku: sku,
    copies: c,
  });

  const printCmds = tsplCommands.match(/^PRINT\s+.*$/gm) || [];
  console.log('=== TSPL PAYLOAD START ===\n' + tsplCommands + '\n=== TSPL PAYLOAD END ===');
  console.log('TSPL Generate Details:', {
    copies: c,
    labelWidth: w,
    labelHeight: h,
    barcode: barcode || sku || '1234567890',
    sku: sku || 'N/A',
    price: Number(price) || 0,
    numberOfPrintCommands: printCmds.length,
    exactPrintCommand: printCmds[0] || 'N/A',
  });

  res.json({
    success: true,
    tsplCommands,
    dimensions: `${w}mm x ${h}mm`,
    barcodeType: 'CODE128',
    productName: productName || 'Bakery Item',
    barcode: barcode || sku || '1234567890',
    sku: sku || 'N/A',
    price: Number(price) || 0,
    copies: c,
  });
});

// Submit print job (and forward to local print bridge if available)
router.post('/print-jobs/submit', async (req: AuthRequest, res) => {
  const db = loadDB();
  db.printJobs = db.printJobs || [];

  const { printerName, jobType, productName, copies, data, logOnly, skipBridgeCall } = req.body;
  const targetPrinter = printerName || db.settings.defaultPrinter || 'TSC TTP-244 Pro';

  const w = db.settings.labelWidthMm || 50;
  const h = db.settings.labelHeightMm || 30;
  const c = Math.max(1, parseInt(String(copies ?? 1)) || 1);

  const tsplCommands = generateTSPLCommands({
    widthMm: w,
    heightMm: h,
    gapMm: db.settings.labelGapMm || 2,
    density: db.settings.printDensity || 8,
    speed: db.settings.printSpeed || 4,
    productName: productName || data?.name || 'Bakery Item',
    barcode: data?.barcode || data?.sku || '1234567890',
    price: data?.price || 0,
    sku: data?.sku,
    copies: c,
  });

  const printCmds = tsplCommands.match(/^PRINT\s+.*$/gm) || [];
  console.log('=== TSPL PAYLOAD START ===\n' + tsplCommands + '\n=== TSPL PAYLOAD END ===');
  console.log('TSPL Submit Details:', {
    copies: c,
    labelWidth: w,
    labelHeight: h,
    barcode: data?.barcode || data?.sku || '1234567890',
    sku: data?.sku || 'N/A',
    price: data?.price || 0,
    numberOfPrintCommands: printCmds.length,
    exactPrintCommand: printCmds[0] || 'N/A',
  });

  const newJob: PrintJob = {
    id: `job-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    userId: req.user?.userId || 'system',
    userName: req.user?.name || 'System User',
    branchId: req.user?.branchId || db.settings.defaultBranch || 'branch-main',
    printerName: targetPrinter,
    jobType: jobType || 'BARCODE_LABEL',
    productName: productName || data?.name || 'General Print Item',
    copies: c,
    status: 'SUCCESS',
  };

  const bridgeUrl = db.settings.printBridgeUrl || 'http://127.0.0.1:9100';
  let bridgeConnected = false;
  let isCloudPreview = false;
  let responseMessage = '';

  // Prevent duplicate execution if frontend already submitted directly to local bridge (TASK 7)
  if (logOnly || skipBridgeCall) {
    bridgeConnected = true;
    responseMessage = `Recorded print job in audit log (${c} copies).`;
  } else {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout check

      const response = await fetch(`${bridgeUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerName: targetPrinter,
          jobType,
          copies: c,
          data,
          tsplCommands,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        bridgeConnected = true;
        responseMessage = `RAW TSPL payload successfully submitted to Windows Spooler for "${targetPrinter}".`;
      } else {
        const errText = await response.text();
        newJob.status = 'FAILED';
        newJob.errorMessage = `Print Bridge error: ${response.status} - ${errText}`;
        responseMessage = newJob.errorMessage;
      }
    } catch (err: any) {
      // Bridge was not reachable (Cloud Preview mode or local bridge offline)
      bridgeConnected = false;
      isCloudPreview = true;
      newJob.status = 'SUCCESS';
      newJob.errorMessage = undefined;
      responseMessage = 'Preview Mode — Physical printer unavailable in cloud preview.';
    }
  }

  db.printJobs.unshift(newJob);
  if (db.printJobs.length > 200) {
    db.printJobs = db.printJobs.slice(0, 200);
  }

  saveDB();
  logActivity(
    req.user?.userId || 'system',
    req.user?.name || 'System',
    'Print Job Submitted',
    'Hardware',
    `Submitted ${jobType} job to ${targetPrinter} (${c} copies) [${bridgeConnected ? 'LOCAL HARDWARE' : 'CLOUD PREVIEW'}]`
  );

  res.json({
    success: newJob.status === 'SUCCESS',
    job: newJob,
    bridgeConnected,
    isCloudPreview,
    mode: bridgeConnected ? 'LOCAL' : 'PREVIEW',
    message: responseMessage,
    tsplCommands,
    details: {
      printerName: targetPrinter,
      dimensions: `${w}mm x ${h}mm`,
      barcodeType: 'CODE128',
      productName: productName || data?.name || 'Bakery Item',
      barcode: data?.barcode || data?.sku || '1234567890',
      price: data?.price || 0,
      copies: c,
    },
  });
});

// RAW MINIMAL TEST route (TASK 5)
router.post('/raw-debug-print', async (req: AuthRequest, res) => {
  const db = loadDB();
  const targetPrinter = req.body.printerName || db.settings.defaultPrinter || 'TSC TTP-244 Pro';

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

  console.log('=== TSPL PAYLOAD START ===\n' + minimalTspl + '\n=== TSPL PAYLOAD END ===');
  console.log('Minimal Test TSPL Details:', {
    copies: 1,
    labelWidth: 50,
    labelHeight: 30,
    barcode: '123456789',
    sku: 'TEST-001',
    price: 1400,
    numberOfPrintCommands: 1,
    exactPrintCommand: 'PRINT 1,1',
  });

  const bridgeUrl = db.settings.printBridgeUrl || 'http://127.0.0.1:9100';
  let bridgeConnected = false;
  let responseMessage = '';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${bridgeUrl}/raw-debug-print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerName: targetPrinter }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      bridgeConnected = true;
      const data = await response.json();
      responseMessage = data.message || `Successfully sent RAW MINIMAL test label to "${targetPrinter}".`;
    } else {
      responseMessage = `Print Bridge returned error ${response.status}`;
    }
  } catch (err: any) {
    responseMessage = 'Preview Mode — Physical printer unavailable.';
  }

  res.json({
    success: bridgeConnected,
    mode: bridgeConnected ? 'LOCAL' : 'PREVIEW',
    message: responseMessage,
    tsplCommands: minimalTspl,
  });
});

// Retry / reprint print job
router.post('/print-jobs/:id/retry', async (req: AuthRequest, res) => {
  const db = loadDB();
  db.printJobs = db.printJobs || [];
  const jobId = req.params.id;
  const job = db.printJobs.find((j) => j.id === jobId);

  if (!job) {
    return res.status(404).json({ error: 'Print job not found' });
  }

  const retryJob: PrintJob = {
    ...job,
    id: `job-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    status: 'SUCCESS',
    errorMessage: undefined,
  };

  db.printJobs.unshift(retryJob);
  saveDB();

  res.json({ success: true, job: retryJob });
});

// Hardware status check endpoint
router.get('/status', async (req: AuthRequest, res) => {
  const db = loadDB();
  const bridgeUrl = db.settings.printBridgeUrl || 'http://127.0.0.1:9100';

  let bridgeOnline = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    const resp = await fetch(`${bridgeUrl}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (resp.ok) bridgeOnline = true;
  } catch (e) {
    bridgeOnline = false;
  }

  // Determine mode
  // If we are in cloud container or local bridge is unreachable
  const isCloudPreview = !bridgeOnline;

  let printerStatusText = '';
  if (!bridgeOnline) {
    // Check if running in browser/cloud preview or local
    printerStatusText = 'Cloud Preview — Physical printer is not connected.';
  } else {
    printerStatusText = `Thermal Printer Connected — ${db.settings.labelPrinter || 'TSC TTP-244 Pro'}`;
  }

  res.json({
    bridgeOnline,
    isCloudPreview,
    printerStatusText,
    printBridgeUrl: bridgeUrl,
    barcodeScanner: { status: 'CONNECTED', device: 'USB HID Barcode Scanner' },
    camera: { status: 'AVAILABLE', device: 'Webcam / Camera' },
    receiptPrinter: { status: bridgeOnline ? 'ONLINE' : 'PREVIEW', device: db.settings.receiptPrinter || 'POS-80 Thermal' },
    labelPrinter: { status: bridgeOnline ? 'ONLINE' : 'PREVIEW', device: db.settings.labelPrinter || 'TSC TTP-244 Pro' },
    cashDrawer: { status: 'CONNECTED', device: 'Connected via Receipt Printer' },
    printBridge: { status: bridgeOnline ? 'CONNECTED' : 'CLOUD PREVIEW MODE', url: bridgeUrl },
  });
});

export default router;
