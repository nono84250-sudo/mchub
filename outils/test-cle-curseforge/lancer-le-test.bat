@echo off
chcp 65001 >nul
cd /d "%~dp0..\.."
echo Test des modpacks avec la cle CurseForge (1 a 3 minutes)...
echo.
node outils\test-cle-curseforge\test-cle-curseforge.js
echo.
echo Le tableau s ouvre dans ton navigateur (fichier tableau.html).
pause
