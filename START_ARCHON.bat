@echo off
SET PATH=C:\Program Files\nodejs;%PATH%
chcp 65001 >nul

echo.
echo ========================================
echo   ARCHON V3 - Demarrage
echo ========================================
echo.

cd /d "E:\Quartier_General\archon-v3"

echo Test npm disponible...
where npm >nul 2>&1
if errorlevel 1 (
    echo ERREUR: npm introuvable
    echo Installe Node.js depuis https://nodejs.org
    pause
    exit /b 1
)

echo Lancement Voice Platform backend (port 5000)...
start "Voice Platform" cmd /k "cd /d E:\Voice_Platform\backend && E:\Voice_Platform\backend\venv\Scripts\python.exe server.py"

echo Attente demarrage Voice Platform (3 sec)...
timeout /t 3 /nobreak >nul

echo Lancement backend sauvegarde (port 3334)...
start "ARCHON Backend" cmd /k "cd /d ""E:\Quartier_General\archon-v3"" && SET PATH=C:\Program Files\nodejs;%%PATH%% && node backend-save.cjs"

echo Attente demarrage backend (2 sec)...
timeout /t 2 /nobreak >nul

echo Lancement serveur Vite...
start "ARCHON V3 Server" cmd /k "cd /d ""E:\Quartier_General\archon-v3"" && SET PATH=C:\Program Files\nodejs;%%PATH%% && npm run dev"

echo Attente demarrage serveur (7 sec)...
timeout /t 7 /nobreak >nul

echo Ouverture navigateur...
start https://localhost:5173

echo.
echo ========================================
echo   ARCHON V3 en cours de demarrage
echo   Voice Platform: Terminal "Voice Platform" (port 5000)
echo   Backend: Terminal "ARCHON Backend" (port 3334)
echo   Serveur: Terminal "ARCHON V3 Server" (port 5173)
echo   URL: https://localhost:5173
echo ========================================
echo.
timeout /t 2 /nobreak >nul
exit
