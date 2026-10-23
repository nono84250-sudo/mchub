@echo off
chcp 65001 >nul
cd /d "%~dp0..\.."
echo Test sur d autres modpacks (connus et moins connus), 5 a 10 minutes...
echo.
node outils\test-cle-curseforge\test-autres-packs.js
echo.
echo Le tableau s ouvre dans ton navigateur (tableau-autres-packs.html).
pause
