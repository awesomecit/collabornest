#!/usr/bin/env bash
set -euo pipefail

# CollaborNest Setup Script
# Initializes development environment

echo "🚀 CollaborNest Setup"
echo "===================="

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is required. Install with: npm install -g pnpm"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "⚠️  Docker not found. Some features may not work."; }

echo "✅ Prerequisites check passed"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
  echo ""
  echo "📝 Creating .env file from .env.example..."
  cp .env.example .env
  echo "✅ .env created. Please review and update as needed."
else
  echo "✅ .env already exists"
fi

# Start services with Docker Compose
if command -v docker >/dev/null 2>&1; then
  echo ""
  read -p "🐳 Start Docker services (Redis, RabbitMQ, PostgreSQL)? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose up -d
    echo "✅ Docker services started"
    echo "   - Redis: localhost:6379"
    echo "   - RabbitMQ: localhost:5672 (Management: http://localhost:15672)"
    echo "   - PostgreSQL: localhost:5432"
  fi
fi

# Build packages
echo ""
echo "🔨 Building packages..."
pnpm build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Review .env file and update configuration"
echo "  2. Run 'pnpm dev' to start development"
echo "  3. Run 'pnpm test' to run tests"
echo ""
echo "📚 Documentation:"
echo "  - README.md - Project overview"
echo "  - docs/API.md - Socket API reference"
echo "  - docs/INTERFACES.md - TypeScript interfaces"
echo ""
