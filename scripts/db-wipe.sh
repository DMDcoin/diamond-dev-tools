#!/bin/bash
# Wipes all persistent data and resets to fresh state
set -e

echo "⚠️  Database Wipe - This will delete ALL persistent data!"
echo "======================================================="
echo ""

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Ask for confirmation
read -p "Are you sure you want to delete all database data? (yes/NO): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Cancelled - no data was deleted"
    exit 0
fi

echo ""
echo "🛑 Stopping all containers..."
cd db
docker compose -f docker-compose-persistent.yml down || true

echo "🗑️  Removing persistent volumes..."
docker volume rm diamond-dev-tools-db-data 2>/dev/null && echo "   ✅ Removed database volume" || echo "   ℹ️  Database volume didn't exist"
docker volume rm diamond-dev-tools-grafana-data 2>/dev/null && echo "   ✅ Removed grafana volume" || echo "   ℹ️  Grafana volume didn't exist"

echo ""
echo "✅ All persistent data has been wiped"
echo ""
echo "🚀 Next steps:"
echo "   ./scripts/db-resume.sh          # Start fresh with persistent storage"
echo "   ./scripts/db-fresh.sh           # Start fresh without persistent storage"
echo ""
