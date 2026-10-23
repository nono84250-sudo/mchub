@echo off
cd /d "%~dp0..\.."
if not exist "site\src\app\test-cle-curseforge" mkdir "site\src\app\test-cle-curseforge"
copy /y "outils\test-cle-curseforge\page-de-test-route.ts" "site\src\app\test-cle-curseforge\route.ts" >nul
echo Page de test remise. Lance le site (npm run dev) puis ouvre http://localhost:3000/test-cle-curseforge
echo.
pause
