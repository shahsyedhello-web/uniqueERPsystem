@echo off
title Install TSC Windows Print Bridge

:: Navigate to the directory where this batch script is located
cd /d "%~dp0"

echo ===================================================
echo Installing TSC Print Bridge for Windows (Port 9100)
echo Working Directory: %~dp0
echo ===================================================

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH! Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Installing Node.js dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

echo.
echo Compiling RawPrinter.cs into native RawPrint.exe ...
set CSC_PATH=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%CSC_PATH%" set CSC_PATH=C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe

if exist "%CSC_PATH%" (
    "%CSC_PATH%" /nologo /out:RawPrint.exe RawPrinter.cs
    if %errorlevel% equ 0 (
        echo [SUCCESS] Compiled RawPrint.exe successfully.
    ) else (
        echo [WARNING] C# compilation failed. The print bridge will attempt auto-compilation at startup.
    )
) else (
    csc /nologo /out:RawPrint.exe RawPrinter.cs >nul 2>&1
    if %errorlevel% equ 0 (
        echo [SUCCESS] Compiled RawPrint.exe successfully using system csc.
    ) else (
        echo [INFO] .NET csc.exe not directly found in default path; server.js will compile on first start.
    )
)

echo.
echo ===================================================
echo Installation complete successfully!
echo Run start-print-bridge.bat to launch the local bridge.
echo ===================================================
pause

