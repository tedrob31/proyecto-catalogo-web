#!/bin/sh
set -e

# Crear directorios necesarios si no existen
mkdir -p /app/cache /app/public/images /app/out

# Inicializar base de datos SQLite si no existe en el volumen
if [ ! -f /app/cache/local.db ]; then
  echo "Base de datos local no encontrada. Inicializando desde plantilla..."
  cp /app/dummy.db /app/cache/local.db
fi

echo "Iniciando servidor web..."
exec node server.js
