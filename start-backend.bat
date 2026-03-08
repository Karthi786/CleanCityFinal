@echo off
echo Starting CleanMadurai Server...
echo.
echo Once started, open your browser at:
echo   http://localhost:5000
echo.
cd /d "%~dp0backend"
node src/index.js
pause
