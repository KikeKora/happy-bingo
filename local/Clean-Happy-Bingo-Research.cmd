@echo off
cd /d "%~dp0"
node .\happy-bingo-support-cleaner.cjs
if errorlevel 1 (
  echo.
  echo Hubo un error. No cierres esta ventana y revisa el mensaje de arriba.
  pause
  exit /b 1
)
echo.
echo Limpieza terminada.
pause
