@echo off
rem Double-clic : mesure les appels a la base du site en local (voir mesurer.ps1).
rem Ferme d'abord le site s'il tourne deja (fenetre npm run dev).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0mesurer.ps1"
pause
