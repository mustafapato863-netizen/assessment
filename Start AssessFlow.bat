@echo off
title AssessFlow
cd /d "%~dp0"

echo ============================================
echo   AssessFlow - starting up
echo ============================================
echo.

REM 1) Docker Desktop (database + Redis run inside it)
docker info >nul 2>&1
if errorlevel 1 (
  echo [1/4] Starting Docker Desktop...
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
) else (
  echo [1/4] Docker Desktop is already running.
)

set /a tries=0
:waitdocker
docker info >nul 2>&1
if not errorlevel 1 goto dockerready
set /a tries+=1
if %tries% geq 60 (
  echo.
  echo Docker did not start after 3 minutes. Open Docker Desktop manually, then run this file again.
  pause
  exit /b 1
)
timeout /t 3 /nobreak >nul
goto waitdocker
:dockerready

REM 2) Database and Redis (existing data volume is reused)
echo [2/4] Starting the database and Redis...
docker compose up -d postgres redis
if errorlevel 1 (
  echo.
  echo Could not start the database. Take a screenshot of this window and send it to Claude.
  pause
  exit /b 1
)

REM 3) Open the browser once the web app is up (in the background)
echo [3/4] The browser will open automatically in about 30 seconds...
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "$u='http://localhost:5174'; for($i=0;$i -lt 90;$i++){ try { Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process $u; exit } catch { Start-Sleep 2 } }; Start-Process $u"

REM 4) API + web + worker (keep this window open; close it to stop AssessFlow)
echo [4/4] Starting AssessFlow. Keep this window open. Close it to stop.
echo.
call pnpm dev

echo.
echo AssessFlow stopped.
pause
