#!/bin/bash

# IC Lib - Unified Startup Script
# This script starts both nginx (frontend) and Express.js (backend) in a single container

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "IC Lib - Starting Services..."
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

# Trap SIGTERM and SIGINT
trap cleanup SIGTERM SIGINT

# Validate environment
if [ -z "$DB_HOST" ]; then
    echo "ERROR: DB_HOST not set"
    exit 1
fi

# Test for database
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



echo -e ""
echo -e ""
echo -e "${GREEN}✓${NC} nginx started (PID: $NGINX_PID)"
echo -e "${GREEN}✓${NC} Backend started (PID: $BACKEND_PID)"
echo -e "${GREEN}✓${NC} Services Running"
echo -e "  ${GREEN}Database:${NC}      ${DB_HOST}:${DB_PORT:-5432}/${DB_NAME:-emd}"
echo -e "  ${GREEN}Backend:${NC}       ${BASE_DOMAIN}${BASE_URL}/api"
echo -e "  ${GREEN}Frontend:${NC}      ${BASE_DOMAIN}${BASE_URL}"
echo -e "  ${GREEN}Default Login:${NC} admin/admin123"
echo -e ""

# Wait for either process to exit
wait -n $BACKEND_PID $NGINX_PID

# If we get here, one of the processes exited
EXIT_CODE=$?

if ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "ERROR: nginx exited unexpectedly"
elif ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "ERROR: Backend exited unexpectedly"
fi

cleanup
exit $EXIT_CODE
