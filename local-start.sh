#!/bin/bash

# IC Lib - Local Development Startup Script
# This script loads environment variables from .env and starts services with hot reload

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "IC Lib - Local Development Mode"
echo ""

# Check and load .env
if [ ! -f .env ]; then
    echo -e "${RED}ERROR: .env file not found${NC}"
    echo "Create .env from .env.example and configure database settings"
    exit 1
fi

export $(grep -v '^#' .env | xargs)

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

# Trap SIGTERM and SIGINT
trap cleanup SIGTERM SIGINT


# Start backend
cd server
npm run dev &
BACKEND_PID=$!
cd ..
sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}ERROR: Backend failed to start${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Backend started (PID: $BACKEND_PID)"


# Start frontend
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

echo -e "${GREEN}✓${NC} Frontend started (PID: $FRONTEND_PID)"
echo ""
echo -e "${GREEN}Servers running:${NC}"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:${PORT:-3500}"
echo ""



# Wait for either process to exit
wait -n $BACKEND_PID $FRONTEND_PID

# If we get here, one of the processes exited
EXIT_CODE=$?

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}ERROR: Backend exited unexpectedly${NC}"
elif ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}ERROR: Frontend exited unexpectedly${NC}"
fi

cleanup
exit $EXIT_CODE
