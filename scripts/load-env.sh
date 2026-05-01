#!/bin/bash
# This script loads and exports environment variables from .env file
# Usage: source ./scripts/load-env.sh

# Get the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

echo "🔐 Loading Environment Variables"
echo "=========================================="
echo "Project Root: $PROJECT_ROOT"
echo "Environment File: $ENV_FILE"
echo ""

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ ERROR: .env file not found at $ENV_FILE"
    echo ""
    echo "Creating default .env file..."
    cat > "$ENV_FILE" << 'EOF'
export DMD_DB_POSTGRES=postgres
export DMD_DB_POSTGRES_PASS=postgres
export DMD_DB_POSTGRES_PORT=5433
export POSTGRES_INSTANCE=127.0.0.1:5433
export RPC_URL=http://localhost:54100/
export RPC_URL_DOCKER=http://host.docker.internal:54100/
export HOST=localhost
export PORT=4000
EOF
    echo "✅ Created .env file with defaults"
fi

# Load and export all variables
set -a  # Automatically export all variables
source "$ENV_FILE"
set +a  # Stop auto-exporting

# Verify critical variables are set
REQUIRED_VARS=("DMD_DB_POSTGRES" "DMD_DB_POSTGRES_PASS" "DMD_DB_POSTGRES_PORT" "POSTGRES_INSTANCE" "RPC_URL" "RPC_URL_DOCKER" "HOST" "PORT")
ALL_PRESENT=true

echo "✅ Environment variables loaded:"
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "   ❌ $var: NOT SET"
        ALL_PRESENT=false
    else
        echo "   ✅ $var: ${!var}"
    fi
done

echo ""
if [ "$ALL_PRESENT" = true ]; then
    echo "✅ All required environment variables are set and exported"
else
    echo "⚠️  WARNING: Some required variables are missing"
    echo "   Please update your .env file with the missing values"
    return 1 2>/dev/null || exit 1
fi

# Validate Docker Compose configuration
echo ""
echo "🐳 Validating Docker Compose Configuration..."
if [ -f "db/docker-compose-persistent.yml" ]; then
    if grep -q "env_file:" db/docker-compose-persistent.yml; then
        echo "✅ Docker Compose will load .env via env_file directive"
        
        if command -v docker &> /dev/null; then
            if docker compose -f db/docker-compose-persistent.yml config > /dev/null 2>&1; then
                echo "✅ Docker Compose configuration is valid"
            else
                echo "⚠️  Docker Compose configuration has warnings (may still work)"
            fi
        fi
    else
        echo "⚠️  Docker Compose missing env_file - add it to docker-compose-persistent.yml"
    fi
else
    echo "⚠️  docker-compose-persistent.yml not found"
fi

echo ""
echo "🚀 Next steps:"
echo "   npm run db-resume          # Start fresh with persistent storage"
echo "   npm run db-fill-from-network-persistent    # Fill database"
echo ""
