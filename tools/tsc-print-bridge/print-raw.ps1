param(
    [Parameter(Mandatory=$true)]
    [string]$PrinterName,
    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

$code = @'
using System;
using System.Runtime.InteropServices;
using System.IO;

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

    public static bool SendFileToPrinter(string szPrinterName, string szFileName, out string errorMsg) {
        errorMsg = "";
        if (!File.Exists(szFileName)) {
            errorMsg = "File not found: " + szFileName;
            return false;
        }
        byte[] bytes = File.ReadAllBytes(szFileName);
        return SendBytesToPrinter(szPrinterName, bytes, bytes.Length, out errorMsg);
    }

    public static bool SendBytesToPrinter(string szPrinterName, Byte[] pBytes, Int32 dwCount, out string errorMsg) {
        errorMsg = "";
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFO di = new DOCINFO();
        di.pDocName = "TSPL Barcode Label Job";
        di.pDataType = "RAW";

        Console.WriteLine("[PRINTER_OPEN] Opening printer: " + szPrinterName);
        if (!OpenPrinter(szPrinterName, ref hPrinter, IntPtr.Zero)) {
            int err = Marshal.GetLastWin32Error();
            errorMsg = "PRINTER_OPEN_FAILED: OpenPrinter failed for '" + szPrinterName + "'. Win32 Error Code: " + err;
            Console.WriteLine("[PRINTER_OPEN_FAILED] " + errorMsg);
            return false;
        }
        Console.WriteLine("[PRINTER_OPEN] Successfully opened printer handle.");

        try {
            if (!StartDocPrinter(hPrinter, 1, di)) {
                int err = Marshal.GetLastWin32Error();
                errorMsg = "PRINTER_OPEN_FAILED: StartDocPrinter failed. Win32 Error Code: " + err;
                Console.WriteLine("[PRINTER_OPEN_FAILED] " + errorMsg);
                return false;
            }

            try {
                if (!StartPagePrinter(hPrinter)) {
                    int err = Marshal.GetLastWin32Error();
                    errorMsg = "PRINTER_OPEN_FAILED: StartPagePrinter failed. Win32 Error Code: " + err;
                    Console.WriteLine("[PRINTER_OPEN_FAILED] " + errorMsg);
                    return false;
                }

                IntPtr pUnmanagedBytes = IntPtr.Zero;
                try {
                    pUnmanagedBytes = Marshal.AllocCoTaskMem(dwCount);
                    Marshal.Copy(pBytes, 0, pUnmanagedBytes, dwCount);
                    int dwWritten = 0;
                    Console.WriteLine("[RAW_WRITE_START] Writing " + dwCount + " bytes to printer spooler...");
                    bool bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, dwCount, out dwWritten);
                    if (!bSuccess) {
                        int err = Marshal.GetLastWin32Error();
                        errorMsg = "RAW_PRINT_FAILED: WritePrinter failed. Win32 Error Code: " + err + ", Written: " + dwWritten + "/" + dwCount;
                        Console.WriteLine("[RAW_WRITE_FAILED] " + errorMsg);
                        return false;
                    }
                    Console.WriteLine("[RAW_WRITE_SUCCESS] Successfully wrote " + dwWritten + " bytes to spooler.");
                    return true;
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
'@

Add-Type -TypeDefinition $code -Language CSharp
Write-Output "[PRINT_START] Executing raw print for printer '$PrinterName'"
$errorMsg = ""
$success = [RawPrinter]::SendFileToPrinter($PrinterName, $FilePath, [ref]$errorMsg)
if ($success) {
    Write-Output "[PRINT_SUCCESS]"
    exit 0
} else {
    Write-Error $errorMsg
    exit 1
}
