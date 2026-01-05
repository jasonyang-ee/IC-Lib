#!/bin/bash

# IC Lib - Test Script
# Runs tests for client and server packages

set -e

echo "IC-Lib Test Runner"
echo "=================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# Parse arguments
COVERAGE=false
WATCH=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --coverage) COVERAGE=true ;;
        --watch) WATCH=true ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Test client
echo "Testing client..."
cd client
if [ "$WATCH" = true ]; then
    npm test
elif [ "$COVERAGE" = true ]; then
    if npm run test:coverage; then
        echo -e "${GREEN}Client tests passed${NC}"
    else
        echo -e "${RED}Client tests failed${NC}"
        FAILED=1
    fi
else
    if npm run test:run; then
        echo -e "${GREEN}Client tests passed${NC}"
    else
        echo -e "${RED}Client tests failed${NC}"
        FAILED=1
    fi
fi
cd ..

echo ""

# Test server
echo "Testing server..."
cd server
if [ "$WATCH" = true ]; then
    npm test
elif [ "$COVERAGE" = true ]; then
    if npm run test:coverage; then
        echo -e "${GREEN}Server tests passed${NC}"
    else
        echo -e "${RED}Server tests failed${NC}"
        FAILED=1
    fi
else
    if npm run test:run; then
        echo -e "${GREEN}Server tests passed${NC}"
    else
        echo -e "${RED}Server tests failed${NC}"
        FAILED=1
    fi
fi
cd ..

echo ""
echo "=================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed${NC}"
    exit 1
fi
