@echo off
title TSC Windows Print Bridge (Port 9100)

:: Navigate to the directory where this batch script is located
cd /d "%~dp0"

echo ===================================================
echo Starting TSC Print Bridge on http://127.0.0.1:9100 ...
echo Working Directory: %~dp0
echo DO NOT CLOSE THIS WINDOW while using POS barcode printing.
echo ===================================================

:: Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in system PATH!
    echo Please install Node.js from https://nodejs.org/ and try again.
    goto :error
)

:: Check if server.js exists
if not exist "server.js" (
    echo [ERROR] server.js not found in current directory (%~dp0^)!
    echo Please ensure all print bridge files are extracted together.
    goto :error
)

:: Check if node_modules exists, offer to run npm install if missing
if not exist "node_modules" (
    echo [WARNING] node_modules not found. Running npm install automatically...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies. Please run install-print-bridge.bat manually.
        goto :error
    )
)

:: Compile RawPrinter.cs if RawPrint.exe does not exist
if not exist "RawPrint.exe" (
    echo [INFO] RawPrint.exe not found. Compiling RawPrinter.cs...
    set CSC_PATH=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
    if not exist "%CSC_PATH%" set CSC_PATH=C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe
    if exist "%CSC_PATH%" (
        "%CSC_PATH%" /nologo /out:RawPrint.exe RawPrinter.cs
    )
)

echo Starting Node.js server...
node server.js
if %errorlevel% neq 0 (
    echo [ERROR] Print bridge exited with an error code.
    goto :error
)

goto :end

:error
echo.
echo ===================================================
echo Print bridge startup failed. Please check errors above.
echo ===================================================
pause
exit /b 1

:end
pause
