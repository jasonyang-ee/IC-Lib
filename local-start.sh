#!/bin/bash

# Allegro Component Library - Local Development Startup Script
# This script loads environment variables from .env and starts services with hot reload

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "================================================================"
echo "  OrCAD Component Library - Local Development Mode"
echo "================================================================"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}ERROR: .env file not found!${NC}"
    echo ""
    echo "Please create a .env file from .env.example:"
    echo "  cp .env.example .env"
    echo ""
    echo "Then edit .env with your database configuration."
    exit 1
fi

# Load environment variables from .env
echo -e "${BLUE}Loading environment variables from .env...${NC}"
export $(grep -v '^#' .env | xargs)

# Validate required environment variables
if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
    echo -e "${RED}ERROR: Missing required database configuration in .env${NC}"
    echo ""
    echo "Required variables:"
    echo "  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME"
    exit 1
fi

echo -e "${GREEN}✓${NC} Environment variables loaded"
echo ""

echo "Configuration:"
echo "  Database: ${DB_HOST}:${DB_PORT}"
echo "  Database Name: ${DB_NAME}"
echo "  Backend Port: ${PORT:-3500}"
echo "  Frontend Port: 5173 (Vite dev server)"
echo "  Environment: ${NODE_ENV:-development}"
echo ""

# Test database connection
echo -e "${BLUE}Testing database connection...${NC}"
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
        console.log('✓ Database connection successful'); 
        client.end(); 
        process.exit(0); 
    })
    .catch((err) => { 
        console.error('✗ Database connection failed:', err.message); 
        process.exit(1); 
    });
" 2>&1; then
    echo -e "${GREEN}✓${NC} Database connection successful"
else
    echo -e "${RED}✗${NC} Database connection failed"
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
echo -e "${BLUE}Checking dependencies...${NC}"

if [ ! -d "server/node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    cd server
    npm install
    cd ..
    echo -e "${GREEN}✓${NC} Backend dependencies installed"
else
    echo -e "${GREEN}✓${NC} Backend dependencies found"
fi

if [ ! -d "client/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd client
    npm install
    cd ..
    echo -e "${GREEN}✓${NC} Frontend dependencies installed"
else
    echo -e "${GREEN}✓${NC} Frontend dependencies found"
fi

echo ""
echo "================================================================"
echo "  Starting Development Servers..."
echo "================================================================"
echo ""

# Function to handle cleanup
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down servers...${NC}"
    
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
        wait $FRONTEND_PID 2>/dev/null || true
    fi
    
    echo -e "${GREEN}Servers stopped.${NC}"
    exit 0
}

# Trap SIGTERM and SIGINT
trap cleanup SIGTERM SIGINT

# Start backend with hot reload
echo -e "${BLUE}→ Starting Backend (Express.js with nodemon)...${NC}"
cd server
npm run dev &
BACKEND_PID=$!
cd ..

# Give backend a moment to start
sleep 2

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}ERROR: Backend failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Backend started (PID: $BACKEND_PID)"
echo -e "   URL: ${BLUE}http://localhost:${PORT:-3500}${NC}"
echo ""

# Start frontend with hot reload
echo -e "${BLUE}→ Starting Frontend (Vite dev server)...${NC}"
cd client
npm run build
npm run dev &
FRONTEND_PID=$!
cd ..

# Give frontend a moment to start
sleep 2

if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}ERROR: Frontend failed to start${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}✓${NC} Frontend started (PID: $FRONTEND_PID)"
echo -e "   URL: ${BLUE}http://localhost:5173${NC}"
echo ""

echo "================================================================"
echo -e "  ${GREEN}✓ Development servers running!${NC}"
echo "================================================================"
echo ""
echo -e "${GREEN}Frontend:${NC} http://localhost:5173"
echo -e "${GREEN}Backend API:${NC} http://localhost:${PORT:-3500}/api"
echo -e "${GREEN}Health Check:${NC} http://localhost:${PORT:-3500}/health"
echo ""
echo -e "${YELLOW}Hot Reload:${NC} Both servers will automatically reload on file changes"
echo ""
echo -e "${BLUE}Download Folders:${NC}"
echo "  - ./download/footprint"
echo "  - ./download/symbol"
echo "  - ./download/pad"
echo ""
echo -e "Press ${RED}Ctrl+C${NC} to stop all servers"
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
