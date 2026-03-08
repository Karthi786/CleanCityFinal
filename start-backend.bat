@echo off
echo Starting CleanMadurai Server...
echo.
echo Once started, open your browser at:
echo   http://localhost:3000
echo.
cd /d "%~dp0backend"
node src/index.js
pause
