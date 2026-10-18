#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "1. Entrando al repositorio de la app (sitio-webDemo)..."
cd ~/lab3rdl

echo "2. Revisando si hay cambios de otros dispositivos en GitHub..."
git pull origin main --no-rebase || echo "⚠️ No se pudo hacer pull (puede que no haya internet o haya conflictos)."

echo ""
echo "3. Archivos que se van a subir:"
# Muestra los archivos en rojo/verde. ¡Verifica que NO aparezca node_modules!
git status --short

echo ""
echo "4. Preparando los cambios..."
git add .

echo "Escribe el mensaje para el commit (o presiona Enter para uno automático):"
read mensaje_commit
if [ -z "$mensaje_commit" ]; then
  mensaje_commit="Actualización app demo $(date +'%Y-%m-%d %H:%M')"
fi

echo "5. Guardando cambios..."
if git commit -m "$mensaje_commit"; then
  echo "✅ Commit creado."
else
  echo "⚠️ No hay cambios nuevos que guardar. Saliendo del script."
  exit 0
fi

echo "6. Subiendo a GitHub..."
git push origin main

echo "✅ ¡Push completado con éxito!"
