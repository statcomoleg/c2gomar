@echo off
setlocal
cd /d "%~dp0"
set "URL=http://127.0.0.1:3737"
set "PORT=3737"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found. Install Node 22+ from https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed
    pause
    exit /b 1
  )
)

if not exist ".env" (
  echo .env not found. Copy .env.example to .env and fill secrets.
  pause
  exit /b 1
)

powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient('127.0.0.1', %PORT%); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 (
  start "" "%URL%"
  exit /b 0
)

echo Starting admin panel...
start "Marathon Admin" /D "%CD%" cmd /k "npm run admin"

set /a tries=0
:wait
set /a tries+=1
if %tries% gtr 30 (
  echo Server did not start in 30s. Check the Marathon Admin window.
  pause
  exit /b 1
)
powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient('127.0.0.1', %PORT%); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  timeout /t 1 /nobreak >nul
  goto wait
)

start "" "%URL%"
exit /b 0