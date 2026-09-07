@echo off
title PDF Data Extraction Portal Launcher
echo ========================================================
echo   Starting PDF Data Extraction & Financial Portal
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Starting FastAPI Backend on port 8000...
start "PDF Backend (FastAPI)" cmd /k "python main.py"

timeout /t 3 /nobreak >nul

echo [2/2] Starting React Frontend on port 3000...
cd /d "%~dp0frontend"
start "PDF Frontend (React)" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo Opening browser at http://localhost:3000 ...
start http://localhost:3000

echo.
echo Both servers are running! Keep the command windows open.
pause
