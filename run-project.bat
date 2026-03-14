@echo off
echo ===================================================
echo   CLEANMADURAI - SMART CITY PLATFORM
echo ===================================================
echo.
echo [1/2] Starting Backend Server...
echo.
cd backend
start cmd /k "npm run dev"
echo Backend started in a separate window.
echo.
echo [2/2] Accessing Frontend...
echo Once the backend is ready (check the other window), 
echo access the citizen dashboard at:
echo.
echo   http://localhost:5001/index.html
echo.
echo ===================================================
echo   SQL Reminder: Ensure you've run the SQL in Walkthrough!
echo ===================================================
pause
