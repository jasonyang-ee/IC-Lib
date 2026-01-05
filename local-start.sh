#!/bin/bash

# IC Lib - Local Development Startup Script
# This script loads environment variables from .env and starts services with hot reload

set -e

echo ""
echo "╭──────────────────────────────────────────╮"
echo "│       IC Lib - Development Mode          │"
echo "╰──────────────────────────────────────────╯"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "[error] .env file not found! Run: cp .env.example .env"
    exit 1
fi

# Load environment variables from .env (silent)
export $(grep -v '^#' .env | xargs)

# Validate required environment variables
if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
    echo "[error] Missing database config in .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)"
    exit 1
fi

# Validate JWT_SECRET for authentication
if [ -z "$JWT_SECRET" ]; then
    echo "[warn] JWT_SECRET not set - auth may not work!"
fi

echo ""
echo "Config: ${DB_HOST}:${DB_PORT}/${DB_NAME} | Backend: ${PORT:-3500} | Frontend: 5173"

# Test database connection (silent unless error)
cd server
if ! node -e "
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
    .then(() => { client.end(); process.exit(0); })
    .catch(() => process.exit(1));
" 2>/dev/null; then
    echo "[error] Database connection failed. Check .env configuration."
    exit 1
fi
cd ..

# Check if node_modules exist (silent install if needed)
if [ ! -d "server/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd server && npm install --silent && cd ..
fi

if [ ! -d "client/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd client && npm install --silent && cd ..
fi

echo "Starting servers..."

# Function to handle cleanup
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    echo "Stopped."
    exit 0
}

# Trap SIGTERM and SIGINT
trap cleanup SIGTERM SIGINT

# Start backend with hot reload (suppress npm output)
cd server
npm run dev 2>&1 | grep -v "^>" | grep -v "^$" &
BACKEND_PID=$!
cd ..

sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "[error] Backend failed to start"
    exit 1
fi

# Start frontend with hot reload (suppress verbose output)
cd client
npm run build 2>&1 | tail -3
npm run dev 2>&1 | grep -v "^>" | grep -v "^$" &
FRONTEND_PID=$!
cd ..

sleep 2
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "[error] Frontend failed to start"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo ""
echo "╭──────────────────────────────────────────╮"
echo "│  ✓ Servers Ready                         │"
echo "│                                          │"
echo "│  Frontend:  http://localhost:5173        │"
echo "│  Backend:   http://localhost:${PORT:-3500}/api    │"
echo "│                                          │"
echo "│  Default:   admin / admin123             │"
echo "│  Press Ctrl+C to stop                    │"
echo "╰──────────────────────────────────────────╯"
echo ""

# Wait for either process to exit
wait -n $BACKEND_PID $FRONTEND_PID

# If we get here, one of the processes exited
EXIT_CODE=$?

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "[error] Backend exited unexpectedly"
elif ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "[error] Frontend exited unexpectedly"
fi

cleanup
exit $EXIT_CODE
