#!/bin/bash
# Wrapper script to run keygen commands
# Usage: ./keygen.sh [command] [args...]

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
else
    echo "Warning: .env file not found in $PROJECT_ROOT"
    echo "Using default values..."
    export DMD_DB_POSTGRES="${DMD_DB_POSTGRES:-postgres}"
    export DMD_DB_POSTGRES_PASS="${DMD_DB_POSTGRES_PASS:-postgres}"
    export DMD_DB_POSTGRES_PORT="${DMD_DB_POSTGRES_PORT:-5433}"
fi

# Set database connection for local execution
export DB_HOST=127.0.0.1
export DB_PORT=$DMD_DB_POSTGRES_PORT
export POSTGRES_PASSWORD=$DMD_DB_POSTGRES_PASS

# Run keygen with all arguments
cd "$SCRIPT_DIR"
npm run keygen "$@"
