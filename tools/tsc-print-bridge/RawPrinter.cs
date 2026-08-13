using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFO {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
    public static extern bool OpenPrinter(string src, ref IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static int Main(string[] args) {
        if (args.Length < 2) {
            Console.WriteLine("[PRINT_FAILED] Usage: RawPrint.exe <PrinterName> <FilePath>");
            return 1;
        }

        string printerName = args[0];
        string filePath = args[1];

        Console.WriteLine("[PRINT_START] Starting raw print job for printer: " + printerName);

        if (!File.Exists(filePath)) {
            Console.WriteLine("[PRINT_FAILED] File not found: " + filePath);
            return 2;
        }

        byte[] bytes;
        try {
            bytes = File.ReadAllBytes(filePath);
        } catch (Exception ex) {
            Console.WriteLine("[PRINT_FAILED] Cannot read file: " + ex.Message);
            return 3;
        }

        IntPtr hPrinter = IntPtr.Zero;
        DOCINFO di = new DOCINFO();
        di.pDocName = "TSPL Barcode Label Job";
        di.pDataType = "RAW";

        Console.WriteLine("[PRINTER_CHECK] Opening printer: " + printerName);
        if (!OpenPrinter(printerName, ref hPrinter, IntPtr.Zero)) {
            int err = Marshal.GetLastWin32Error();
            Console.WriteLine("[PRINT_FAILED] PRINTER_OPEN_FAILED: OpenPrinter failed for '" + printerName + "'. Win32 Error Code: " + err);
            return 4;
        }

        Console.WriteLine("[PRINTER_CHECK] Printer handle opened successfully.");

        try {
            if (!StartDocPrinter(hPrinter, 1, di)) {
                int err = Marshal.GetLastWin32Error();
                Console.WriteLine("[PRINT_FAILED] PRINTER_OPEN_FAILED: StartDocPrinter failed. Win32 Error Code: " + err);
                return 5;
            }

            try {
                if (!StartPagePrinter(hPrinter)) {
                    int err = Marshal.GetLastWin32Error();
                    Console.WriteLine("[PRINT_FAILED] PRINTER_OPEN_FAILED: StartPagePrinter failed. Win32 Error Code: " + err);
                    return 6;
                }

                IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                try {
                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                    int dwWritten = 0;
                    Console.WriteLine("[RAW_WRITE_START] Writing " + bytes.Length + " bytes to printer spooler...");
                    bool bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                    if (!bSuccess) {
                        int err = Marshal.GetLastWin32Error();
                        Console.WriteLine("[PRINT_FAILED] RAW_WRITE_FAILED: WritePrinter failed. Win32 Error Code: " + err + ", Written: " + dwWritten + "/" + bytes.Length);
                        return 7;
                    }
                    Console.WriteLine("[RAW_WRITE_SUCCESS] Successfully wrote " + dwWritten + " bytes to spooler.");
                    Console.WriteLine("[PRINT_COMPLETE] Raw print job completed successfully.");
                    return 0;
                }
                finally {
                    if (pUnmanagedBytes != IntPtr.Zero) {
                        Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    }
                    EndPagePrinter(hPrinter);
                }
            }
            finally {
                EndDocPrinter(hPrinter);
            }
        }
        finally {
            ClosePrinter(hPrinter);
        }
    }
}
