#!/bin/bash

# ensure-database.sh - Script per garantire che il database PostgreSQL sia attivo

set -e  # Exit on error

# Read package name from package.json if available
if [ -f "package.json" ]; then
  PKG_NAME=$(node -p "require('./package.json').name" 2>/dev/null || echo "app")
else
  PKG_NAME="app"
fi

DB_CONTAINER_NAME="${PKG_NAME}-postgres-db"
COMPOSE_SERVICE="app-database"
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
MAX_WAIT_TIME=30
WAIT_INTERVAL=2

echo "🔍 Checking database availability..."

# Funzione per verificare se il container è running
is_container_running() {
    docker compose ps --services --filter "status=running" | grep -q "^${COMPOSE_SERVICE}$"
}

# Funzione per verificare se il database accetta connessioni
is_database_ready() {
    # Usa pg_isready se disponibile, altrimenti prova connessione TCP
    if command -v pg_isready >/dev/null 2>&1; then
        pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1
    else
        # Fallback: test connessione TCP
        timeout 3 bash -c "</dev/tcp/${DB_HOST}/${DB_PORT}" >/dev/null 2>&1
    fi
}

# Controlla se il container è già running
if is_container_running; then
    echo "✅ Database container is already running"

    # Verifica se il database è pronto ad accettare connessioni
    if is_database_ready; then
        echo "✅ Database is ready and accepting connections"
        exit 0
    else
        echo "⏳ Database container is running but not ready yet, waiting..."
    fi
else
    echo "🚀 Starting database container..."

    # Avvia il container in background
    if docker compose up -d "$COMPOSE_SERVICE"; then
        echo "✅ Database container started successfully"
    else
        echo "❌ Failed to start database container"
        exit 1
    fi
fi

# Attendi che il database sia pronto
echo "⏳ Waiting for database to be ready..."
elapsed=0

while [ $elapsed -lt $MAX_WAIT_TIME ]; do
    if is_database_ready; then
        echo "✅ Database is ready after ${elapsed}s"
        exit 0
    fi

    echo "   ... waiting (${elapsed}s/${MAX_WAIT_TIME}s)"
    sleep $WAIT_INTERVAL
    elapsed=$((elapsed + WAIT_INTERVAL))
done

echo "❌ Database failed to become ready within ${MAX_WAIT_TIME}s"
echo "📋 Container status:"
docker compose ps "$COMPOSE_SERVICE"

echo "📋 Container logs (last 20 lines):"
docker compose logs --tail=20 "$COMPOSE_SERVICE"

exit 1
