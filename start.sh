#!/bin/bash

# IC Lib - Unified Startup Script
# This script starts both nginx (frontend) and Express.js (backend) in a single container

set -e

echo "[info] [Startup] IC Lib - Starting..."
echo ""

# Function to handle shutdown gracefully
cleanup() {
    echo ""
    echo "[info] [Startup] Shutting down services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $NGINX_PID 2>/dev/null || true
    wait $BACKEND_PID 2>/dev/null || true
    wait $NGINX_PID 2>/dev/null || true
    echo "[info] [Startup] Services stopped."
    exit 0
}

# Trap SIGTERM and SIGINT
trap cleanup SIGTERM SIGINT

# Check required environment variables
if [ -z "$DB_HOST" ]; then
    echo "[error] [Startup] DB_HOST environment variable is not set"
    echo "Please set database connection parameters:"
    echo "  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME"
    exit 1
fi

echo ""
echo "[info] [Startup] Configuration:"
echo "  Database: ${DB_HOST}:${DB_PORT}"
echo "  Database Name: ${DB_NAME}"
echo "  Backend Port: ${PORT}"
echo "  Frontend: http://localhost:80"
echo "  Environment: ${NODE_ENV}"
echo ""

# Wait for database to be ready
echo "[info] [Startup] Waiting for database connection..."
MAX_RETRIES=30
RETRY_COUNT=0

cd /app/server

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    # Try to connect to database using node
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
        echo "[info] [Database] Connection successful"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "[error] [Database] Could not connect after $MAX_RETRIES attempts"
        echo "Please check your database connection settings:"
        echo "  DB_HOST=${DB_HOST}"
        echo "  DB_PORT=${DB_PORT}"
        echo "  DB_NAME=${DB_NAME}"
        exit 1
    fi
    
    echo "  Attempt $RETRY_COUNT/$MAX_RETRIES - retrying in 2 seconds..."
    sleep 2
done

echo ""
echo "[info] [Startup] Starting services..."
echo ""

# Start nginx in background
echo "[info] [Nginx] Starting nginx (frontend)..."
nginx -g 'daemon off;' 2>&1 | sed 's/^/[nginx] /' &
NGINX_PID=$!

# Give nginx a moment to start
sleep 2

if ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "[error] [Nginx] Failed to start"
    exit 1
fi

echo "[info] [Nginx] Started (PID: $NGINX_PID)"

# Start backend
echo "[info] [Backend] Starting Express.js backend..."
cd /app/server
node src/index.js 2>&1 | sed 's/^/[backend] /' &
BACKEND_PID=$!

# Give backend a moment to start
sleep 2

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "[error] [Backend] Failed to start"
    kill $NGINX_PID 2>/dev/null || true
    exit 1
fi

echo "[info] [Backend] Started (PID: $BACKEND_PID)"

echo ""
echo "[info] [Startup] All services running successfully!"
echo ""
echo "  Frontend: http://localhost"
echo "  Backend API: http://localhost:3500/api"
echo "  Health Check: http://localhost:3500/health"
echo ""
echo "  Authentication:"
echo "     Default Admin Username: admin"
echo "     Default Admin Password: admin123"
echo "     IMPORTANT: Change password after first login!"
echo ""

# Wait for either process to exit
wait -n $BACKEND_PID $NGINX_PID

# If we get here, one of the processes exited
EXIT_CODE=$?

if ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "[error] [Nginx] Exited unexpectedly"
elif ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "[error] [Backend] Exited unexpectedly"
fi

cleanup
exit $EXIT_CODE
