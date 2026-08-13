# TSC Windows Print Bridge

Local Node.js print service that bridges the web POS application (`127.0.0.1:3000`) with the physical USB thermal barcode printer (**TSC TTP-244 Pro**) via Windows Spooler and raw Win32 API spooling.

## Architecture

- **Protocol**: HTTP (JSON API) bound strictly to `127.0.0.1:9100` (Localhost only for security).
- **Driver Interaction**: Uses raw Windows Win32 print API (`OpenPrinter`, `StartDocPrinter`, `WritePrinter`) with `DOCINFO.pDataType = "RAW"` to prevent GDI/PDF driver translation issues and send pure TSPL/TSPL2 commands directly to the printer.

## Installation & Setup on Windows PC

1. **Install Node.js**: Ensure Node.js (v18+) is installed on the Windows PC connected to the TSC printer via USB.
2. **Install Printer Driver**: Ensure the **TSC TTP-244 Pro** driver is installed and named exactly `TSC TTP-244 Pro` in Windows Printers & Scanners.
3. **Install Bridge Dependencies**: Double-click `install-print-bridge.bat`.
4. **Start the Bridge**: Double-click `start-print-bridge.bat` (leave the command window open while operating the POS).

## API Endpoints

- `GET /health` - Check bridge status.
- `GET /printers` - List all installed Windows printers.
- `POST /print` - Receive TSPL payload and forward raw bytes to the specified printer.
- `POST /test-print` - Print a hardcoded TSPL test label (`TEST-123456`).
