@echo off
echo Preparando archivos...
git add .
set /p mensaje="Escribir un comentario para los cambios: "
git commit -m "%mensaje%"
echo Subiendo cambios a Github...
git push origin main
pause