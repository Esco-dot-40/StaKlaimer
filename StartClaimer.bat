@echo off
title Vanguard Stealth Claimer - Desktop Client
color 0A
echo =======================================================
echo          VANGUARD STEALTH CLAIMER DASHBOARD           
echo =======================================================
echo.
echo [1] Checking Node.js Environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org
    pause
    exit
)

echo.
echo ==============================================================================
echo ⚠️  WARNING: If you are outside of playable regions for Stake, please connect
echo    to your VPN prior to continuing with the dashboard startup layout!
echo ==============================================================================
echo.
echo Press any key to CONTINUE to dashboard initialization node...
pause >nul

echo [2] Initializing Cloud Claimer Hub...
cd /d "%~dp0"
node index.js

echo.
echo ⚠️ Server shut down unexpectedly or crashed.
pause
