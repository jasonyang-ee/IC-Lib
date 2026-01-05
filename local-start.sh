#!/bin/bash

# IC Lib - Local Development Startup Script
# This script loads environment variables from .env and starts services with hot reload

set -e

echo "[info] [Startup] OrCAD Component Library - Local Development Mode"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "[error] [Startup] .env file not found!"
    echo ""
    echo "Please create a .env file from .env.example:"
    echo "  cp .env.example .env"
    echo ""
    echo "Then edit .env with your database configuration."
    exit 1
fi

# Load environment variables from .env
echo "[info] [Startup] Loading environment variables from .env..."
export $(grep -v '^#' .env | xargs)

# Validate required environment variables
if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
    echo "[error] [Startup] Missing required database configuration in .env"
    echo ""
    echo "Required variables:"
    echo "  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME"
    exit 1
fi

# Validate JWT_SECRET for authentication
if [ -z "$JWT_SECRET" ]; then
    echo "[warn] [Auth] JWT_SECRET not set in .env"
    echo "[warn] [Auth] Authentication will not work properly!"
    echo ""
    echo "Generate a secure secret:"
    echo "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    echo ""
    echo "Add it to your .env file:"
    echo "  JWT_SECRET=<generated-secret>"
    echo ""
fi

echo "[info] [Startup] Environment variables loaded"
echo ""

echo "[info] [Startup] Configuration:"
echo "  Database: ${DB_HOST}:${DB_PORT}"
echo "  Database Name: ${DB_NAME}"
echo "  Backend Port: ${PORT:-3500}"
echo "  JWT Secret: ${JWT_SECRET:+Configured}"
echo "  Frontend Port: 5173 (Vite dev server)"
echo "  Environment: ${NODE_ENV:-development}"
echo ""

# Test database connection
echo "[info] [Database] Testing database connection..."
cd server
if node -e "
import pg from 'pg';
const { Client } = pg;
const client = new Client({
    host: process.env.DB_HOST || '${DB_HOST}',
    port: process.env.DB_PORT || ${DB_PORT},
    user: process.env.DB_USER || '${DB_USER}',
    password: process.env.DB_PASSWORD || '${DB_PASSWORD}',
    database: process.env.DB_NAME || '${DB_NAME}'
});
client.connect()
    .then(() => { 
        console.log('[info] [Database] Connection successful'); 
        client.end(); 
        process.exit(0); 
    })
    .catch((err) => { 
        console.error('[error] [Database] Connection failed:', err.message); 
        process.exit(1); 
    });
" 2>&1; then
    echo "[info] [Database] Connection successful"
else
    echo "[error] [Database] Connection failed"
    echo ""
    echo "Please check your database configuration in .env:"
    echo "  DB_HOST=${DB_HOST}"
    echo "  DB_PORT=${DB_PORT}"
    echo "  DB_NAME=${DB_NAME}"
    exit 1
fi

cd ..
echo ""

# Check if node_modules exist
echo "[info] [Startup] Checking dependencies..."

if [ ! -d "server/node_modules" ]; then
    echo "[info] [Backend] Installing dependencies..."
    cd server
    npm install
    cd ..
    echo "[info] [Backend] Dependencies installed"
else
    echo "[info] [Backend] Dependencies found"
fi

if [ ! -d "client/node_modules" ]; then
    echo "[info] [Frontend] Installing dependencies..."
    cd client
    npm install
    cd ..
    echo "[info] [Frontend] Dependencies installed"
else
    echo "[info] [Frontend] Dependencies found"
fi

echo ""
echo "[info] [Startup] Starting Development Servers..."
echo ""

# Function to handle cleanup
cleanup() {
    echo ""
    echo "[info] [Startup] Shutting down servers..."
    
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
        wait $FRONTEND_PID 2>/dev/null || true
    fi
    
    echo "[info] [Startup] Servers stopped."
    exit 0
}

# Trap SIGTERM and SIGINT
trap cleanup SIGTERM SIGINT

# Start backend with hot reload
echo "[info] [Backend] Starting Express.js with nodemon..."
cd server
npm run dev &
BACKEND_PID=$!
cd ..

# Give backend a moment to start
sleep 2

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "[error] [Backend] Failed to start"
    exit 1
fi

echo "[info] [Backend] Started (PID: $BACKEND_PID)"
echo "   URL: http://localhost:${PORT:-3500}"
echo ""

# Start frontend with hot reload
echo "[info] [Frontend] Starting Vite dev server..."
cd client
npm run build
npm run dev &
FRONTEND_PID=$!
cd ..

# Give frontend a moment to start
sleep 2

if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "[error] [Frontend] Failed to start"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo "[info] [Frontend] Started (PID: $FRONTEND_PID)"
echo "   URL: http://localhost:5173"
echo ""

echo ""
echo "[info] [Startup] Development servers running!"
echo ""
echo "Frontend: http://localhost:5173"
echo "Backend API: http://localhost:${PORT:-3500}/api"
echo "Health Check: http://localhost:${PORT:-3500}/health"
echo ""
echo "Hot Reload: Both servers will automatically reload on file changes"
echo ""
echo "Download Folders:"
echo "  - ./download/footprint"
echo "  - ./download/symbol"
echo "  - ./download/pad"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for either process to exit
wait -n $BACKEND_PID $FRONTEND_PID

# If we get here, one of the processes exited
EXIT_CODE=$?

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "[error] [Backend] Exited unexpectedly"
elif ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "[error] [Frontend] Exited unexpectedly"
fi

cleanup
exit $EXIT_CODE
