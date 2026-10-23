@echo off
cd /d "%~dp0..\.."
if exist "site\src\app\test-cle-curseforge" rmdir /s /q "site\src\app\test-cle-curseforge"
if exist "site\src\app\test-cle-curseforge" (echo La page n a pas pu etre retiree.) else (echo Page de test retiree du site.)
echo.
pause
