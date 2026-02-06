#!/bin/bash

# IC Lib - Unified Startup Script
# Automatically detects environment:
#   - If .env file exists: Local development mode (hot reload, Vite dev server)
#   - Otherwise: Production mode (nginx + node, for Docker container)

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Detect environment: .env file present = local development
if [ -f .env ] || [ -f "$(dirname "$0")/.env" ]; then
    MODE="development"
else
    MODE="production"
fi

# Allow override via NODE_ENV, but .env always wins
if [ "$MODE" != "development" ] && [ "$NODE_ENV" = "development" ]; then
    MODE="development"
fi

# ============================================================
# LOCAL DEVELOPMENT MODE
# ============================================================
if [ "$MODE" = "development" ]; then
    echo "IC Lib - Local Development Mode"
    echo ""

    # Load .env file
    if [ -f .env ]; then
        export $(grep -v '^#' .env | xargs)
    elif [ -f "$(dirname "$0")/.env" ]; then
        export $(grep -v '^#' "$(dirname "$0")/.env" | xargs)
    fi

    # Validate required variables
    if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
        echo -e "${RED}ERROR: Missing database configuration in .env${NC}"
        exit 1
    fi

    if [ -z "$JWT_SECRET" ]; then
        echo -e "${RED}WARNING: JWT_SECRET not set - authentication will not work${NC}"
    fi

    echo "Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
    echo "Backend: http://localhost:${PORT:-3500}"
    echo "Frontend: http://localhost:5173"
    echo ""
    echo "Starting Server..."

    # Check dependencies
    if [ ! -d "server/node_modules" ]; then
        echo "Installing backend dependencies..."
        cd server && npm install && cd ..
    fi

    if [ ! -d "client/node_modules" ]; then
        echo "Installing frontend dependencies..."
        cd client && npm install && cd ..
    fi

    # Cleanup function
    cleanup() {
        echo ""
        echo "Shutting down..."
        [ ! -z "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null || true
        [ ! -z "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null || true
        echo "Stopped."
        exit 0
    }

    trap cleanup SIGTERM SIGINT

    # Start backend with hot reload
    cd server
    npm run dev &
    BACKEND_PID=$!
    cd ..
    sleep 2
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "${RED}ERROR: Backend failed to start${NC}"
        exit 1
    fi
    echo -e "${GREEN}OK${NC} Backend started (PID: $BACKEND_PID)"

    # Build and start frontend dev server
    cd client
    npm run build
    npm run dev &
    FRONTEND_PID=$!
    cd ..
    sleep 2
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "${RED}ERROR: Frontend failed to start${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi

    echo -e "${GREEN}OK${NC} Frontend started (PID: $FRONTEND_PID)"
    echo ""
    echo -e "${GREEN}Servers running:${NC}"
    echo "  Frontend: http://localhost:5173"
    echo "  Backend:  http://localhost:${PORT:-3500}"
    echo ""

    # Wait for either process to exit
    wait -n $BACKEND_PID $FRONTEND_PID

    EXIT_CODE=$?
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "${RED}ERROR: Backend exited unexpectedly${NC}"
    elif ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "${RED}ERROR: Frontend exited unexpectedly${NC}"
    fi

    cleanup
    exit $EXIT_CODE

# ============================================================
# PRODUCTION MODE (Docker container with nginx)
# ============================================================
else
    echo "IC Lib - Production Mode"
    echo ""

    # Cleanup handler
    cleanup() {
        echo "Shutting down..."
        kill $BACKEND_PID 2>/dev/null || true
        kill $NGINX_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
        wait $NGINX_PID 2>/dev/null || true
        echo "Stopped."
        exit 0
    }

    trap cleanup SIGTERM SIGINT

    # Validate environment
    if [ -z "$DB_HOST" ]; then
        echo "ERROR: DB_HOST not set"
        exit 1
    fi

    # Wait for database to be ready
    cd /app/server
    MAX_RETRIES=30
    RETRY_COUNT=0
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if node -e "
            import pg from 'pg';
            const { Client } = pg;
            const client = new Client({
                host: process.env.DB_HOST,
                port: process.env.DB_PORT,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME
            });
            client.connect()
                .then(() => { client.end(); process.exit(0); })
                .catch(() => process.exit(1));
        " 2>/dev/null; then
            break
        fi

        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
            echo "[error] Database connection failed after $MAX_RETRIES attempts"
            exit 1
        fi

        sleep 2
    done

    # Start nginx
    nginx -g 'daemon off;' 2>&1 | sed 's/^/[nginx] /' &
    NGINX_PID=$!
    sleep 2

    if ! kill -0 $NGINX_PID 2>/dev/null; then
        echo "ERROR: nginx failed to start"
        exit 1
    fi

    # Start backend
    cd /app/server
    node src/index.js 2>&1 | sed 's/^/[backend] /' &
    BACKEND_PID=$!
    sleep 2

    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "ERROR: Backend failed to start"
        kill $NGINX_PID 2>/dev/null || true
        exit 1
    fi

    echo ""
    echo -e "${GREEN}OK${NC} nginx started (PID: $NGINX_PID)"
    echo -e "${GREEN}OK${NC} Backend started (PID: $BACKEND_PID)"
    echo -e "${GREEN}OK${NC} Services Running"
    echo -e "  ${GREEN}Database:${NC}      ${DB_HOST}:${DB_PORT:-5432}/${DB_NAME:-emd}"
    echo -e "  ${GREEN}Backend:${NC}       ${BASE_DOMAIN}${BASE_URL}/api"
    echo -e "  ${GREEN}Frontend:${NC}      ${BASE_DOMAIN}${BASE_URL}"
    echo -e "  ${GREEN}Default Login:${NC} admin/admin123"
    echo ""

    # Wait for either process to exit
    wait -n $BACKEND_PID $NGINX_PID

    EXIT_CODE=$?
    if ! kill -0 $NGINX_PID 2>/dev/null; then
        echo "ERROR: nginx exited unexpectedly"
    elif ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "ERROR: Backend exited unexpectedly"
    fi

    cleanup
    exit $EXIT_CODE
fi
