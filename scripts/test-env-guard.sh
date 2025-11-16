#!/bin/bash

# test-env-guard.sh - Garantisce esecuzione sicura dei test

set -e

TEST_TYPE="$1"
REQUIRED_ENV="test"

echo "🔒 Testing Environment Safety Guard"

# Controlla se NODE_ENV è impostato
if [ -z "$NODE_ENV" ]; then
    echo "⚠️  NODE_ENV not set, loading from .env.test..."
    export NODE_ENV=test

    # Carica .env.test se esiste
    if [ -f ".env.test" ]; then
        echo "📋 Loading environment from .env.test"
        set -a  # Automatically export all variables
        source .env.test
        set +a
    else
        echo "❌ .env.test file not found!"
        echo "   Create .env.test with test environment variables"
        exit 1
    fi
fi

# Verifica che NODE_ENV sia 'test'
if [ "$NODE_ENV" != "$REQUIRED_ENV" ]; then
    echo "❌ SAFETY CHECK FAILED!"
    echo "   Current NODE_ENV: $NODE_ENV"
    echo "   Required for tests: $REQUIRED_ENV"
    echo ""
    echo "🔧 To fix this issue:"
    echo "   export NODE_ENV=test"
    echo "   or ensure .env.test contains NODE_ENV=test"
    exit 1
fi

# Verifica configurazione database test
if [ -n "$DATABASE_NAME" ]; then
    # Controlla se il nome database contiene "test" o pattern sicuri
    case "$DATABASE_NAME" in
        *test*|*dev*|*local*)
            echo "✅ Database name looks safe for testing: $DATABASE_NAME"
            ;;
        *prod*|*production*|*live*)
            echo "❌ DANGER! Database name suggests production: $DATABASE_NAME"
            echo "   Never run tests against production database!"
            exit 1
            ;;
        *)
            echo "⚠️  Database name: $DATABASE_NAME"
            echo "   Ensure this is a test database, not production!"
            ;;
    esac
fi

# Controlla host database
if [ -n "$DATABASE_HOST" ] && [ "$DATABASE_HOST" != "localhost" ] && [ "$DATABASE_HOST" != "127.0.0.1" ]; then
    case "$DATABASE_HOST" in
        *test*|*dev*|*local*|*-database|app-database)
            echo "✅ Database host looks safe for testing: $DATABASE_HOST"
            ;;
        *)
            echo "⚠️  Database host: $DATABASE_HOST"
            echo "   Ensure this points to test database, not production!"
            read -p "   Continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "❌ Test execution cancelled for safety"
                exit 1
            fi
            ;;
    esac
fi

# Informazioni ambiente corrente
echo "📋 Test Environment Info:"
echo "   NODE_ENV: $NODE_ENV"
echo "   DATABASE_HOST: ${DATABASE_HOST:-'not set'}"
echo "   DATABASE_NAME: ${DATABASE_NAME:-'not set'}"
echo "   DATABASE_PORT: ${DATABASE_PORT:-'not set'}"

echo "✅ Environment safety checks passed"

# Assicuriamoci che il database sia disponibile
echo "🔍 Ensuring database is available..."
./scripts/ensure-database.sh

# Esegui il comando di test appropriato
case "$TEST_TYPE" in
    "integration")
        echo "🔗 Running integration tests..."
        exec npm run test:integration
        ;;
    "e2e")
        echo "🌐 Running E2E tests..."
        exec npm run test:e2e
        ;;
    "all")
        echo "🧪 Running all tests..."
        exec npm run test:integration && npm run test:e2e
        ;;
    *)
        echo "❌ Unknown test type: $TEST_TYPE"
        echo "   Usage: $0 {integration|e2e|all}"
        exit 1
        ;;
esac
