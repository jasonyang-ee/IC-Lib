#!/bin/bash

# IC Lib - Check Script
# Runs both linting and testing for all packages

set -e

echo "IC-Lib Check (Lint + Test)"
echo "=========================="
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
LINT_ONLY=false
TEST_ONLY=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --coverage) COVERAGE=true ;;
        --watch) WATCH=true ;;
        --lint-only) LINT_ONLY=true ;;
        --test-only) TEST_ONLY=true ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# ==================
# LINT PHASE
# ==================
if [ "$TEST_ONLY" = false ]; then
    echo "=== LINT PHASE ==="
    echo ""

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
fi

# ==================
# TEST PHASE
# ==================
if [ "$LINT_ONLY" = false ]; then
    echo "=== TEST PHASE ==="
    echo ""

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
fi

# ==================
# SUMMARY
# ==================
echo "=========================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All checks passed${NC}"
    exit 0
else
    echo -e "${RED}Some checks failed${NC}"
    exit 1
fi
