@echo off
setlocal
cd /d "%~dp0"
title Contoso Contract Intelligence

REM --- Node present? ---
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is required. Install v20.6 or newer from https://nodejs.org
  echo  then run this launcher again.
  echo.
  pause
  exit /b 1
)

REM --- API keys present? ---
if not exist ".env.local" (
  echo.
  echo  No API keys yet. Run "1 - Set API keys.bat" first, fill it in, then come back.
  echo.
  pause
  exit /b 1
)

REM --- Dependencies (first run only) ---
if not exist "node_modules" (
  echo Installing dependencies, first run only - this can take a minute...
  call npm install
  if errorlevel 1 (
    echo.
    echo  Dependency install failed. Check your internet connection and try again.
    echo.
    pause
    exit /b 1
  )
)

REM --- Start the API proxy and the web app in their own windows ---
echo Starting the API proxy and the web app...
start "Contract Intelligence - API proxy" cmd /k "npm run server"
start "Contract Intelligence - web app" cmd /k "npm run dev"

REM --- Give them a moment, then open the browser ---
timeout /t 6 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo  Running. Two command windows opened (API proxy + web app).
echo  Close those two windows to stop the app.
echo  If your browser did not open, go to:  http://localhost:5173
echo.
exit /b 0
