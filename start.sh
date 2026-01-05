#!/bin/bash

# IC Lib - Unified Startup Script
# This script starts both nginx (frontend) and Express.js (backend) in a single container

set -e

echo ""
echo "╭────────────────────────────────────╮"
echo "│     IC Lib - Production Mode          │"
echo "╰────────────────────────────────────╯"

# Function to handle shutdown gracefully
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID $NGINX_PID 2>/dev/null || true
    wait $BACKEND_PID $NGINX_PID 2>/dev/null || true
    echo "Stopped."
    exit 0
}

# Trap SIGTERM and SIGINT
trap cleanup SIGTERM SIGINT

# Check required environment variables
if [ -z "$DB_HOST" ]; then
    echo "[error] DB_HOST not set. Set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME"
    exit 1
fi

echo ""
echo "Config: ${DB_HOST}:${DB_PORT}/${DB_NAME} | Backend: ${PORT} | Frontend: :80"

# Wait for database to be ready
echo "Connecting to database..."
MAX_RETRIES=30
RETRY_COUNT=0

cd /app/server

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

echo "Starting services..."

# Start nginx in background
nginx -g 'daemon off;' 2>&1 | sed 's/^/[nginx] /' &
NGINX_PID=$!

sleep 2
if ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "[error] Nginx failed to start"
    exit 1
fi

echo "[info] [Nginx] Started (PID: $NGINX_PID)"

# Start backend
echo "[info] [Backend] Starting Express.js backend..."
cd /app/server
node src/index.js 2>&1 | sed 's/^/[backend] /' &
BACKEND_PID=$!

sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "[error] Backend failed to start"
    kill $NGINX_PID 2>/dev/null || true
    exit 1
fi

echo ""
echo "╭────────────────────────────────────╮"
echo "│  ✓ Services Ready                  │"
echo "│                                    │"
echo "│  Frontend:  http://localhost       │"
echo "│  Backend:   http://localhost:3500  │"
echo "│                                    │"
echo "│  Default:   admin / admin123       │"
echo "╰────────────────────────────────────╯"
echo ""

# Wait for either process to exit
wait -n $BACKEND_PID $NGINX_PID
EXIT_CODE=$?

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "[error] Backend exited unexpectedly"
elif ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "[error] Nginx exited unexpectedly"
fi

cleanup
exit $EXIT_CODE
