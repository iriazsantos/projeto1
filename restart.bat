@echo off
REM Mata todos os processos node.exe
echo Encerrando todos os processos node.exe...
taskkill /IM node.exe /F /T >nul 2>&1
timeout /t 2 /nobreak

REM Mata todos os processos npm
echo Encerrando npm...
taskkill /IM npm.cmd /F /T >nul 2>&1
timeout /t 2 /nobreak

REM Limpa portas
echo Limpando portas 3000 e 5173...
netstat -ano | findstr :3000 >nul && (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /F /PID %%a >nul 2>&1
)
netstat -ano | findstr :5173 >nul && (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak
echo.
echo ✅ Portas limpas! Iniciando aplicacao...
echo.

REM Inicia npm run dev
npm run dev

pause
