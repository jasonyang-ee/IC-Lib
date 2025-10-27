#!/bin/bash

# Allegro Component Library - Unified Startup Script
# This script starts both nginx (frontend) and Express.js (backend) in a single container

set -e

echo "Allegro Component Library - Starting..."
echo ""

# Function to handle shutdown gracefully
cleanup() {
    echo ""
    echo "Shutting down services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $NGINX_PID 2>/dev/null || true
    wait $BACKEND_PID 2>/dev/null || true
    wait $NGINX_PID 2>/dev/null || true
    echo "Services stopped."
    exit 0
}

# Trap SIGTERM and SIGINT
trap cleanup SIGTERM SIGINT

# Check required environment variables
if [ -z "$DB_HOST" ]; then
    echo "ERROR: DB_HOST environment variable is not set"
    echo "Please set database connection parameters:"
    echo "  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME"
    exit 1
fi

echo ""
echo "Configuration:"
echo "  Database: ${DB_HOST}:${DB_PORT:-5432}"
echo "  Database Name: ${DB_NAME:-cip}"
echo "  Backend Port: ${PORT:-3500}"
echo "  Frontend: http://localhost (nginx on port 80)"
echo "  Environment: ${NODE_ENV:-production}"
echo ""

# Wait for database to be ready
echo "Waiting for database connection..."
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
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'cip'
        });
        client.connect()
            .then(() => { console.log('Connected!'); client.end(); process.exit(0); })
            .catch(() => process.exit(1));
    " 2>/dev/null; then
        echo "✓ Database connection successful"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "ERROR: Could not connect to database after $MAX_RETRIES attempts"
        echo "Please check your database connection settings:"
        echo "  DB_HOST=${DB_HOST}"
        echo "  DB_PORT=${DB_PORT:-5432}"
        echo "  DB_NAME=${DB_NAME:-cip}"
        exit 1
    fi
    
    echo "  Attempt $RETRY_COUNT/$MAX_RETRIES - retrying in 2 seconds..."
    sleep 2
done

echo ""
echo "Starting services..."
echo ""

# Start nginx in background
echo "→ Starting nginx (frontend)..."
nginx -g 'daemon off;' 2>&1 | sed 's/^/[nginx] /' &
NGINX_PID=$!

# Give nginx a moment to start
sleep 2

if ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "ERROR: nginx failed to start"
    exit 1
fi

echo "✓ nginx started (PID: $NGINX_PID)"

# Start backend
echo "→ Starting Express.js backend..."
cd /app/server
node src/index.js 2>&1 | sed 's/^/[backend] /' &
BACKEND_PID=$!

# Give backend a moment to start
sleep 2

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "ERROR: Backend failed to start"
    kill $NGINX_PID 2>/dev/null || true
    exit 1
fi

echo "✓ Backend started (PID: $BACKEND_PID)"

echo ""
echo "✓ All services running successfully!"
echo ""
echo "  Frontend: http://localhost"
echo "  Backend API: http://localhost:3500/api"
echo "  Health Check: http://localhost:3500/health"
echo ""
echo "  📝 Authentication:"
echo "     Default Admin Username: admin"
echo "     Default Admin Password: admin123"
echo "     ⚠️  Change password after first login!"
echo ""
echo "  Press Ctrl+C to stop all services"
echo ""

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
