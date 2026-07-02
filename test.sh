#!/bin/bash

# IC Lib - Check Script
# CI-parity gate: lint (autofix + no-fix check) and tests for client, server, scripts.
# Fails on lint errors, test failures, and autofix drift (autofix rewrote a clean tree).

set -e

echo "IC-Lib Check (Lint + Test)"
echo "=========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_DIRS=(client server scripts)

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

ensure_dependencies() {
    local dir="$1"

    if [ ! -d "$SCRIPT_DIR/$dir/node_modules" ]; then
        echo "Installing $dir dependencies..."
        cd "$SCRIPT_DIR/$dir"
        npm install
        cd "$SCRIPT_DIR"
    fi
}

run_npm_script() {
    local dir="$1"
    local label="$2"
    local script_name="$3"

    cd "$SCRIPT_DIR/$dir"
    if npm run "$script_name"; then
        echo -e "${GREEN}${label} passed${NC}"
    else
        echo -e "${RED}${label} failed${NC}"
        FAILED=1
    fi
    cd "$SCRIPT_DIR"
}

# Tree cleanliness over the lint targets: tracked modifications or untracked files.
tree_is_clean() {
    git diff --quiet -- "${PACKAGE_DIRS[@]}" 2>/dev/null \
        && [ -z "$(git ls-files --others --exclude-standard -- "${PACKAGE_DIRS[@]}")" ]
}

for dir in "${PACKAGE_DIRS[@]}"; do
    ensure_dependencies "$dir"
done

# ==================
# LINT PHASE
# ==================
if [ "$TEST_ONLY" = false ]; then
    echo "=== LINT PHASE ==="
    echo ""

    # Autofix-drift guard: only meaningful when the lint targets start clean.
    STARTED_CLEAN=0
    if git -C "$SCRIPT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        if tree_is_clean; then
            STARTED_CLEAN=1
        else
            echo -e "${YELLOW}Working tree not clean - autofix-drift guard disabled for this run${NC}"
            echo ""
        fi
    fi

    for dir in "${PACKAGE_DIRS[@]}"; do
        echo "Linting $dir (auto-fix)..."
        run_npm_script "$dir" "${dir^} lint (fix)" 'lint:fix'
        echo ""
    done

    # CI-parity: the no-fix lint must pass on the tree as it stands.
    for dir in "${PACKAGE_DIRS[@]}"; do
        echo "Linting $dir (no-fix check)..."
        run_npm_script "$dir" "${dir^} lint (check)" 'lint'
        echo ""
    done

    if [ "$STARTED_CLEAN" = "1" ] && ! tree_is_clean; then
        echo -e "${RED}Autofix rewrote tracked files - review/commit the changes, then rerun${NC}"
        git -C "$SCRIPT_DIR" status --short -- "${PACKAGE_DIRS[@]}"
        echo ""
        FAILED=1
    fi
fi

# ==================
# TEST PHASE
# ==================
if [ "$LINT_ONLY" = false ]; then
    echo "=== TEST PHASE ==="
    echo ""

    if [ "$WATCH" = true ]; then
        # Watch mode blocks; scripts has no watch runner, so it is skipped here.
        for dir in client server; do
            echo "Testing $dir (watch)..."
            cd "$SCRIPT_DIR/$dir"
            npm test
            cd "$SCRIPT_DIR"
            echo ""
        done
    else
        TEST_SCRIPT='test:run'
        if [ "$COVERAGE" = true ]; then
            TEST_SCRIPT='test:coverage'
        fi

        for dir in client server; do
            echo "Testing $dir..."
            run_npm_script "$dir" "${dir^} tests" "$TEST_SCRIPT"
            echo ""
        done

        # scripts test = one-shot dry-run import; no coverage/watch variants.
        echo "Testing scripts..."
        run_npm_script scripts 'Scripts tests' 'test'
        echo ""
    fi
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
