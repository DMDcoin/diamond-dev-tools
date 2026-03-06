#!/bin/bash
# Database Resume Setup
set -e

echo "🔄 Database Resume Setup"
echo "=========================================="

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Load environment variables if they exist and EXPORT them
if [ -f ".env" ]; then
    echo "📋 Loading and exporting environment variables..."
    set -a  # Automatically export all variables
    source .env
    set +a  # Stop auto-exporting
    echo "✅ Environment variables loaded and exported"
    echo "   DMD_DB_POSTGRES: ${DMD_DB_POSTGRES:-NOT SET}"
    echo "   DMD_DB_POSTGRES_PORT: ${DMD_DB_POSTGRES_PORT:-NOT SET}"
else
    echo "⚠️  WARNING: .env file not found!"
    echo "   Creating .env file with defaults..."
    cat > .env << 'EOF'
export DMD_DB_POSTGRES=postgres
export DMD_DB_POSTGRES_PORT=5433
export POSTGRES_INSTANCE=127.0.0.1:5433
export RPC_URL=http://localhost:54100/
export RPC_URL_DOCKER=http://host.docker.internal:54100/
export HOST=localhost
export PORT=4000
EOF
    echo "✅ Created .env file with defaults"
    set -a
    source .env
    set +a
fi

# Verify environment variables are set
if [ -z "$DMD_DB_POSTGRES" ] || [ -z "$DMD_DB_POSTGRES_PORT" ]; then
    echo "❌ ERROR: Required environment variables not set after loading .env"
    echo "   Please check your .env file contains:"
    echo "   export DMD_DB_POSTGRES=postgres"
    echo "   export DMD_DB_POSTGRES_PORT=5433"
    exit 1
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
echo "🚀 Services running:"
echo "   Express API: http://${HOST:-0.0.0.0}:${PORT:-9990}"
echo "   PostgreSQL: 127.0.0.1:$DMD_DB_POSTGRES_PORT"
echo "   Grafana: http://localhost:3000"
echo "   PgAdmin: http://localhost:3002"
echo ""
echo "🚀 Next steps:"
echo "   npm run test-db                 # Test database connection"
echo "   npm run db-fill-from-network    # Fill database from network (fresh)"
echo "   npm run db-fill-from-network-persistent    # Fill database from network (persistent)"