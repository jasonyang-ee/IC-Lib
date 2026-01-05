#!/bin/bash

# IC Lib - Lint Script
# Runs ESLint on client, server, and scripts packages

set -e

echo "IC-Lib Lint Check"
echo "================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# Lint client
echo "Linting client..."
cd client
if npm run lint; then
    echo -e "${GREEN}Client lint passed${NC}"
else
    echo -e "${RED}Client lint failed${NC}"
    FAILED=1
fi
cd ..

echo ""

# Lint server
echo "Linting server..."
cd server
if npm run lint; then
    echo -e "${GREEN}Server lint passed${NC}"
else
    echo -e "${RED}Server lint failed${NC}"
    FAILED=1
fi
cd ..

echo ""

# Lint scripts
echo "Linting scripts..."
cd scripts
if npm run lint; then
    echo -e "${GREEN}Scripts lint passed${NC}"
else
    echo -e "${RED}Scripts lint failed${NC}"
    FAILED=1
fi
cd ..

echo ""
echo "================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All lint checks passed${NC}"
    exit 0
else
    echo -e "${RED}Some lint checks failed${NC}"
    exit 1
fi
