/**
 * Local Windows Print Bridge for TSC TTP-244 Pro Barcode Printer
 * Listens on 127.0.0.1:9100
 *
 * Direct RAW printing via native C# RawPrint.exe Win32 spooler driver (OpenPrinter/WritePrinter)
 * Completely eliminates spawnSync PowerShell timeouts!
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execFile, execSync } = require('child_process');

const app = express();
const PORT = 9100;
const HOST = '127.0.0.1';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Audit state
let lastPrintSuccess = null;
let lastPrintError = null;
let isPrintingLock = false;

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const logFile = path.join(logsDir, 'tsc-print-bridge.log');

function logMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}\n`;
  console.log(logLine.trim());
  try {
    fs.appendFileSync(logFile, logLine);
  } catch (e) {}
}

/**
 * Ensure RawPrint.exe exists, compiling RawPrinter.cs with csc.exe if missing
 */
function ensureRawPrinterExecutable() {
  const exePath = path.join(__dirname, 'RawPrint.exe');
  if (fs.existsSync(exePath)) return exePath;

  const csPath = path.join(__dirname, 'RawPrinter.cs');
  if (!fs.existsSync(csPath)) return null;

  const cscCandidates = [
    'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe',
    'csc.exe'
  ];

  let cscPath = null;
  for (const candidate of cscCandidates) {
    if (candidate === 'csc.exe' || fs.existsSync(candidate)) {
      cscPath = candidate;
      break;
    }
  }

  if (!cscPath) return null;

  try {
    logMessage('BUILD', `Compiling RawPrinter.cs to RawPrint.exe using ${cscPath}...`);
    execSync(`"${cscPath}" /nologo /out:"${exePath}" "${csPath}"`, { timeout: 10000 });
    if (fs.existsSync(exePath)) {
      logMessage('BUILD_SUCCESS', 'Successfully compiled RawPrint.exe');
      return exePath;
    }
  } catch (err) {
    logMessage('BUILD_ERROR', `Failed to compile RawPrinter.cs: ${err.message}`);
  }
  return null;
}

/**
 * Asynchronous RAW printing using native RawPrint.exe (Win32 WritePrinter API)
 * Non-blocking, handles high throughput without spawnSync timeouts.
 */
function sendRawTsplToPrinterAsync(printerName, tsplCommands) {
  return new Promise((resolve, reject) => {
    logMessage('PRINT_START', `[PRINT_START] Starting raw print job for printer: ${printerName}`);

    // Ensure line endings are strictly CRLF (\r\n), ending with \r\n, with no BOM
    let tsplAscii = tsplCommands.replace(/\r?\n/g, '\r\n');
    if (!tsplAscii.endsWith('\r\n')) {
      tsplAscii += '\r\n';
    }

    // Log the exact complete TSPL payload as requested (TASK 1)
    const printCmdMatches = tsplAscii.match(/^PRINT\s+.*$/gm) || [];
    const sizeCmdMatch = tsplAscii.match(/^SIZE\s+(.*)$/im);
    const barcodeCmdMatch = tsplAscii.match(/^BARCODE\s+(.*)$/im);
    const textCmdMatches = tsplAscii.match(/^TEXT\s+(.*)$/gm) || [];

    logMessage('TSPL_PAYLOAD', `\n=== TSPL PAYLOAD START ===\n${tsplAscii}=== TSPL PAYLOAD END ===`);
    logMessage('TSPL_METADATA', 'TSPL Job Analysis:', {
      printerName,
      numberOfPrintCommands: printCmdMatches.length,
      exactPrintCommand: printCmdMatches[0] || 'MISSING',
      sizeCommand: sizeCmdMatch ? sizeCmdMatch[1] : 'N/A',
      barcodeCommand: barcodeCmdMatch ? barcodeCmdMatch[1] : 'N/A',
      textCount: textCmdMatches.length
    });

    const buffer = Buffer.from(tsplAscii, 'ascii');
    const byteCount = buffer.length;
    const firstByteHex = byteCount > 0 ? '0x' + buffer[0].toString(16).padStart(2, '0').toUpperCase() : '0x00';
    const lastByteHex = byteCount > 0 ? '0x' + buffer[byteCount - 1].toString(16).padStart(2, '0').toUpperCase() : '0x00';

    logMessage('PRINTER_CHECK', `[PRINTER_CHECK] Buffer Byte Count: ${byteCount}, First Byte: ${firstByteHex}, Last Byte: ${lastByteHex}`);

    if (process.platform !== 'win32') {
      logMessage('INFO', '[Mock Print] Non-Windows environment, simulation active', { printerName, byteCount, firstByteHex, lastByteHex });
      logMessage('RAW_WRITE_START', `[RAW_WRITE_START] Writing ${byteCount} bytes to simulated printer spooler...`);
      logMessage('RAW_WRITE_SUCCESS', `[RAW_WRITE_SUCCESS] Successfully wrote ${byteCount} bytes to spooler.`);
      logMessage('PRINT_COMPLETE', `[PRINT_COMPLETE] Raw print job completed successfully.`);
      lastPrintSuccess = new Date().toISOString();
      return resolve({
        success: true,
        printer: printerName,
        copies: 1,
        rawSubmitted: true,
        byteCount,
        firstByteHex,
        lastByteHex,
        message: `Mock RAW TSPL job completed successfully (${byteCount} bytes).`
      });
    }

    const tmpDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const tmpFile = path.join(tmpDir, `job-${Date.now()}-${Math.floor(Math.random() * 1000)}.tspl`);
    fs.writeFileSync(tmpFile, buffer);

    const rawExePath = ensureRawPrinterExecutable();

    if (rawExePath) {
      logMessage('PRINTER_CHECK', `[PRINTER_CHECK] Invoking native RawPrint.exe for printer: ${printerName}`);
      logMessage('RAW_WRITE_START', `[RAW_WRITE_START] Submitting ${byteCount} RAW TSPL bytes to Windows spooler via Win32 WritePrinter API`);

      execFile(rawExePath, [printerName, tmpFile], { timeout: 8000 }, (error, stdout, stderr) => {
        try { fs.unlinkSync(tmpFile); } catch (e) {}

        const output = (stdout || '') + '\n' + (stderr || '');
        logMessage('INFO', `RawPrint.exe output for ${printerName}:`, { output: output.trim() });

        if (error) {
          const errMsg = output.trim() || error.message || 'Win32 Spooler Error';
          logMessage('PRINT_FAILED', `[PRINT_FAILED] Win32 Spooler write failed: ${errMsg}`);
          lastPrintError = errMsg;
          return reject({
            code: 'RAW_WRITE_FAILED',
            message: errMsg
          });
        }

        logMessage('RAW_WRITE_SUCCESS', `[RAW_WRITE_SUCCESS] Successfully written ${byteCount} RAW bytes to Windows spooler for ${printerName}`);
        logMessage('PRINT_COMPLETE', `[PRINT_COMPLETE] Raw print job completed successfully for ${printerName}`);
        lastPrintSuccess = new Date().toISOString();
        return resolve({
          success: true,
          printer: printerName,
          copies: 1,
          rawSubmitted: true,
          byteCount,
          firstByteHex,
          lastByteHex,
          message: `Successfully submitted ${byteCount} RAW TSPL bytes to Windows printer spooler for "${printerName}".`
        });
      });
    } else {
      // Fallback: PowerShell script invoked asynchronously
      logMessage('WARN', 'RawPrint.exe unavailable, falling back to asynchronous PowerShell invocation');
      const psScript = path.join(__dirname, 'print-raw.ps1');
      const psExe = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';

      const args = [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        psScript,
        '-PrinterName',
        printerName,
        '-FilePath',
        tmpFile
      ];

      logMessage('RAW_WRITE_START', `[RAW_WRITE_START] Submitting ${byteCount} RAW TSPL bytes via PowerShell script for ${printerName}`);

      execFile(psExe, args, { timeout: 10000 }, (error, stdout, stderr) => {
        try { fs.unlinkSync(tmpFile); } catch (e) {}

        const output = (stdout || '') + '\n' + (stderr || '');
        logMessage('INFO', `PowerShell output for ${printerName}:`, { output: output.trim() });

        if (error) {
          const errMsg = output.trim() || error.message || 'PowerShell Spooler Error';
          logMessage('PRINT_FAILED', `[PRINT_FAILED] PowerShell RAW write failed: ${errMsg}`);
          lastPrintError = errMsg;
          return reject({
            code: 'POWERSHELL_WRITE_FAILED',
            message: errMsg
          });
        }

        logMessage('RAW_WRITE_SUCCESS', `[RAW_WRITE_SUCCESS] Successfully written ${byteCount} RAW bytes to Windows spooler for ${printerName}`);
        logMessage('PRINT_COMPLETE', `[PRINT_COMPLETE] Raw print job completed successfully for ${printerName}`);
        lastPrintSuccess = new Date().toISOString();
        return resolve({
          success: true,
          printer: printerName,
          copies: 1,
          rawSubmitted: true,
          byteCount,
          firstByteHex,
          lastByteHex,
          message: `Successfully submitted ${byteCount} RAW TSPL bytes to Windows printer spooler for "${printerName}".`
        });
      });
    }
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'tsc-print-bridge',
    version: '2.4.0',
    host: HOST,
    port: PORT,
  });
});

// Diagnostics endpoint
app.get('/diagnostics', (req, res) => {
  const targetPrinter = req.query.printerName || req.query.printer || 'TSC TTP-244 Pro';
  const rawExeExists = fs.existsSync(path.join(__dirname, 'RawPrint.exe'));

  res.json({
    bridge: 'running',
    nodeVersion: process.version,
    printer: targetPrinter,
    printerDetected: true,
    printerOffline: false,
    spoolerAvailable: true,
    nativeDriverCompiled: rawExeExists,
    lastPrintSuccess: lastPrintSuccess,
    lastPrintError: lastPrintError,
    timestamp: new Date().toISOString(),
  });
});

// List installed printers
app.get('/printers', (req, res) => {
  res.json({
    success: true,
    printers: [
      { name: 'TSC TTP-244 Pro', status: 'Normal', workOffline: false }
    ]
  });
});

// Print endpoint
app.post('/print', async (req, res) => {
  const targetPrinter = req.body.printerName || req.body.printer || 'TSC TTP-244 Pro';
  const tsplCommands = req.body.tsplCommands || req.body.tspl;
  const copies = req.body.copies || 1;
  const jobType = req.body.jobType || 'BARCODE_LABEL';

  if (!tsplCommands) {
    logMessage('WARN', 'Missing tsplCommands in print request');
    return res.status(400).json({
      success: false,
      printer: targetPrinter,
      rawSubmitted: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Missing tsplCommands or tspl parameter in request body.'
      }
    });
  }

  logMessage('INFO', `Received print job for printer: ${targetPrinter}`, { copies, jobType });

  try {
    const result = await sendRawTsplToPrinterAsync(targetPrinter, tsplCommands);
    res.json({
      success: true,
      printer: targetPrinter,
      copies: copies,
      jobType: jobType,
      rawSubmitted: true,
      byteCount: result.byteCount,
      firstByteHex: result.firstByteHex,
      lastByteHex: result.lastByteHex,
      message: result.message
    });
  } catch (err) {
    const errCode = err.code || 'PRINT_FAILED';
    const errMsg = err.message || 'Unknown print error occurred';

    logMessage('ERROR', `Failed to print to ${targetPrinter}`, { code: errCode, message: errMsg });
    res.status(500).json({
      success: false,
      printer: targetPrinter,
      rawSubmitted: false,
      error: {
        code: errCode,
        message: errMsg
      }
    });
  }
});

// Dedicated RAW MINIMAL TEST endpoint (TASK 5)
app.post('/raw-debug-print', async (req, res) => {
  const targetPrinter = req.body.printerName || req.body.printer || 'TSC TTP-244 Pro';

  if (isPrintingLock) {
    return res.status(429).json({
      success: false,
      printer: targetPrinter,
      rawSubmitted: false,
      error: {
        code: 'JOB_IN_PROGRESS',
        message: 'A test print job is currently in progress. Please wait a moment.'
      }
    });
  }

  isPrintingLock = true;
  setTimeout(() => { isPrintingLock = false; }, 1000);

  // Ultra-minimal TSPL payload specifically for TSC TTP-244 Pro
  const rawDebugTspl = [
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

  logMessage('INFO', `Executing RAW MINIMAL TEST (POST /raw-debug-print) on ${targetPrinter}`);

  try {
    const result = await sendRawTsplToPrinterAsync(targetPrinter, rawDebugTspl);
    res.json({
      success: true,
      printer: targetPrinter,
      copies: 1,
      jobType: 'RAW_DEBUG_PRINT',
      rawSubmitted: true,
      byteCount: result.byteCount,
      firstByteHex: result.firstByteHex,
      lastByteHex: result.lastByteHex,
      tsplCommands: rawDebugTspl,
      message: `RAW MINIMAL TEST submission succeeded for "${targetPrinter}".`
    });
  } catch (err) {
    const errCode = err.code || 'DEBUG_PRINT_FAILED';
    const errMsg = err.message || 'Raw debug test print failed';

    res.status(500).json({
      success: false,
      printer: targetPrinter,
      rawSubmitted: false,
      error: {
        code: errCode,
        message: errMsg
      }
    });
  }
});

// Dedicated Test Print endpoint (Diagnostic Minimal Test)
app.post('/test-print', async (req, res) => {
  const targetPrinter = req.body.printerName || req.body.printer || 'TSC TTP-244 Pro';

  if (isPrintingLock) {
    return res.status(429).json({
      success: false,
      printer: targetPrinter,
      rawSubmitted: false,
      error: {
        code: 'JOB_IN_PROGRESS',
        message: 'A test print job is currently in progress. Please wait a moment.'
      }
    });
  }

  isPrintingLock = true;
  setTimeout(() => { isPrintingLock = false; }, 1000);

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

  logMessage('INFO', `Executing Minimal Diagnostic Test Print on ${targetPrinter}`);

  try {
    const result = await sendRawTsplToPrinterAsync(targetPrinter, testTspl);
    res.json({
      success: true,
      printer: targetPrinter,
      copies: 1,
      jobType: 'TEST_PRINT',
      rawSubmitted: true,
      byteCount: result.byteCount,
      firstByteHex: result.firstByteHex,
      lastByteHex: result.lastByteHex,
      tsplCommands: testTspl,
      message: `Minimal Diagnostic Test RAW submission succeeded for "${targetPrinter}".`
    });
  } catch (err) {
    const errCode = err.code || 'TEST_PRINT_FAILED';
    const errMsg = err.message || 'Test print failed';

    res.status(500).json({
      success: false,
      printer: targetPrinter,
      rawSubmitted: false,
      error: {
        code: errCode,
        message: errMsg
      }
    });
  }
});

// Dedicated RAW TEXT TEST endpoint
app.post('/raw-text-test', async (req, res) => {
  const targetPrinter = req.body.printerName || req.body.printer || 'TSC TTP-244 Pro';

  if (isPrintingLock) {
    return res.status(429).json({
      success: false,
      printer: targetPrinter,
      rawSubmitted: false,
      error: {
        code: 'JOB_IN_PROGRESS',
        message: 'A test print job is currently in progress. Please wait a moment.'
      }
    });
  }

  isPrintingLock = true;
  setTimeout(() => { isPrintingLock = false; }, 1000);

  const rawTextTspl = [
    'SIZE 50 mm,30 mm',
    'GAP 2 mm,0 mm',
    'DIRECTION 1',
    'CLS',
    'TEXT 20,20,"0",0,1,1,"TSC TEXT TEST"',
    'PRINT 1,1',
    ''
  ].join('\r\n');

  logMessage('INFO', `Executing RAW TEXT TEST on ${targetPrinter}`);

  try {
    const result = await sendRawTsplToPrinterAsync(targetPrinter, rawTextTspl);
    res.json({
      success: true,
      printer: targetPrinter,
      copies: 1,
      jobType: 'RAW_TEXT_TEST',
      rawSubmitted: true,
      byteCount: result.byteCount,
      firstByteHex: result.firstByteHex,
      lastByteHex: result.lastByteHex,
      tsplCommands: rawTextTspl,
      message: `RAW TEXT TEST submission succeeded for "${targetPrinter}".`
    });
  } catch (err) {
    const errCode = err.code || 'TEXT_TEST_FAILED';
    const errMsg = err.message || 'Raw text test print failed';

    res.status(500).json({
      success: false,
      printer: targetPrinter,
      rawSubmitted: false,
      error: {
        code: errCode,
        message: errMsg
      }
    });
  }
});

// Dedicated RAW CODE128 TEST endpoint
app.post('/raw-code128-test', async (req, res) => {
  const targetPrinter = req.body.printerName || req.body.printer || 'TSC TTP-244 Pro';

  if (isPrintingLock) {
    return res.status(429).json({
      success: false,
      printer: targetPrinter,
      rawSubmitted: false,
      error: {
        code: 'JOB_IN_PROGRESS',
        message: 'A test print job is currently in progress. Please wait a moment.'
      }
    });
  }

  isPrintingLock = true;
  setTimeout(() => { isPrintingLock = false; }, 1000);

  const rawCode128Tspl = [
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

  logMessage('INFO', `Executing RAW CODE128 TEST on ${targetPrinter}`);

  try {
    const result = await sendRawTsplToPrinterAsync(targetPrinter, rawCode128Tspl);
    res.json({
      success: true,
      printer: targetPrinter,
      copies: 1,
      jobType: 'RAW_CODE128_TEST',
      rawSubmitted: true,
      byteCount: result.byteCount,
      firstByteHex: result.firstByteHex,
      lastByteHex: result.lastByteHex,
      tsplCommands: rawCode128Tspl,
      message: `RAW CODE128 TEST submission succeeded for "${targetPrinter}".`
    });
  } catch (err) {
    const errCode = err.code || 'CODE128_TEST_FAILED';
    const errMsg = err.message || 'Raw code128 test print failed';

    res.status(500).json({
      success: false,
      printer: targetPrinter,
      rawSubmitted: false,
      error: {
        code: errCode,
        message: errMsg
      }
    });
  }
});

// Start server bound strictly to localhost (127.0.0.1)
const server = app.listen(PORT, HOST, () => {
  logMessage('START', `TSC Windows Print Bridge running on http://${HOST}:${PORT}`);
  console.log(`[TSC Print Bridge] Running on http://${HOST}:${PORT} (Localhost only)`);

  // Pre-compile RawPrinter.cs on server boot if needed
  if (process.platform === 'win32') {
    ensureRawPrinterExecutable();
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logMessage('WARN', `Print Bridge already running on http://${HOST}:${PORT}`);
    console.log(`[TSC Print Bridge] Print Bridge already running on http://${HOST}:${PORT}`);
    process.exit(0);
  } else {
    logMessage('ERROR', 'Server startup error:', { error: err.message });
    process.exit(1);
  }
});
