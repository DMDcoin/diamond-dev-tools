#!/bin/bash
# Database Resume Setup
set -e

echo "🔄 Database Resume Setup"
echo "=========================================="

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Load environment variables if they exist
if [ -f ".env" ]; then
    echo "📋 Loading environment variables..."
    set -a
    source .env
    set +a
    echo "✅ Environment variables loaded"
fi

# Verify environment variables are set
if [ -z "$DMD_DB_POSTGRES" ] || [ -z "$DMD_DB_POSTGRES_PORT" ]; then
    echo "⚠️  Environment variables not set. Setting defaults..."
    export DMD_DB_POSTGRES=${DMD_DB_POSTGRES:-"postgres"}
    export DMD_DB_POSTGRES_PORT=${DMD_DB_POSTGRES_PORT:-"5435"}
    echo "✅ Using defaults: DMD_DB_POSTGRES=$DMD_DB_POSTGRES, DMD_DB_POSTGRES_PORT=$DMD_DB_POSTGRES_PORT"
fi

# Check if this is first run or resume
cd db
VOLUME_NAME="diamond-dev-tools-db-data"
if docker volume inspect $VOLUME_NAME >/dev/null 2>&1; then
    echo "📦 Found existing database volume - resuming from previous state"
    FIRST_RUN=false
else
    echo "📦 No existing database volume found - initializing new database"
    FIRST_RUN=true
fi

# Stop containers if running
echo "🛑 Stopping existing containers..."
docker compose -f docker-compose-persistent.yml down || true

# Start containers
echo "🚀 Starting database containers..."
envsubst < grafana/templates/postgres.yaml > grafana/provisioning/datasources/postgres.yaml
docker compose -f docker-compose-persistent.yml up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Check if database is responding
echo "🔍 Checking database connectivity..."
for i in {1..30}; do
    if PGPASSWORD=$DMD_DB_POSTGRES psql -h 127.0.0.1 -p $DMD_DB_POSTGRES_PORT -U postgres -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ Database is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Database failed to start after 5 minutes"
        exit 1
    fi
    echo "   Attempt $i/30: Database not ready yet, waiting..."
    sleep 10
done

# Apply migrations only on first run or if explicitly requested
cd ..
if [ "$FIRST_RUN" = true ]; then
    echo "📝 First run detected - applying database migrations..."
    sleep 3
    npx pg-migrations apply -c "postgres://postgres:$DMD_DB_POSTGRES@127.0.0.1:$DMD_DB_POSTGRES_PORT/postgres" -D db/migrations
else
    echo "🔄 Resuming from existing database - checking if migrations are needed..."
    # Check if migrations are up to date
    npx pg-migrations apply -c "postgres://postgres:$DMD_DB_POSTGRES@127.0.0.1:$DMD_DB_POSTGRES_PORT/postgres" -D db/migrations || true
fi

echo ""
echo "🎉 Database resume setup completed!"
if [ "$FIRST_RUN" = true ]; then
    echo "   ℹ️  This was a first run - database initialized"
else
    echo "   ℹ️  Resumed from existing data"
fi
echo ""
echo "📊 Database info:"
echo "   Volume: $VOLUME_NAME"
echo "   Port: $DMD_DB_POSTGRES_PORT"
echo ""
echo "🚀 Next steps:"
echo "   npm run db-fill-from-network    # Fill database from network"
echo "   npm run test-db                 # Test database connection"