#!/bin/bash

# Verification script for unified Docker deployment
# This script checks that all necessary files are in place

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Docker Deployment Verification                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

ERRORS=0
WARNINGS=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1 exists"
        return 0
    else
        echo -e "${RED}✗${NC} $1 missing"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

check_executable() {
    if [ -x "$1" ]; then
        echo -e "${GREEN}✓${NC} $1 is executable"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $1 is not executable (run: chmod +x $1)"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
}

check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $1 contains '$2'"
        return 0
    else
        echo -e "${RED}✗${NC} $1 missing '$2'"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

echo "Checking core Docker files..."
echo "────────────────────────────────────────────────────────────"
check_file "Dockerfile"
check_file "startup.sh"
check_file "nginx.conf"
check_file "docker-compose.yml"
check_file ".dockerignore"
echo ""

echo "Checking startup.sh configuration..."
echo "────────────────────────────────────────────────────────────"
check_executable "startup.sh"
check_content "startup.sh" "#!/bin/bash"
check_content "startup.sh" "nginx"
check_content "startup.sh" "node src/index.js"
echo ""

echo "Checking Dockerfile configuration..."
echo "────────────────────────────────────────────────────────────"
check_content "Dockerfile" "FROM node:20-alpine AS frontend-builder"
check_content "Dockerfile" "COPY startup.sh"
check_content "Dockerfile" "ENTRYPOINT"
echo ""

echo "Checking docker-compose.yml configuration..."
echo "────────────────────────────────────────────────────────────"
check_content "docker-compose.yml" "web:"
if grep -q "postgres:" "docker-compose.yml" 2>/dev/null; then
    echo -e "${YELLOW}⚠${NC} docker-compose.yml still contains 'postgres' service"
    WARNINGS=$((WARNINGS + 1))
fi
if grep -q "backend:" "docker-compose.yml" 2>/dev/null; then
    echo -e "${YELLOW}⚠${NC} docker-compose.yml still contains 'backend' service"
    WARNINGS=$((WARNINGS + 1))
fi
if grep -q "frontend:" "docker-compose.yml" 2>/dev/null; then
    echo -e "${YELLOW}⚠${NC} docker-compose.yml still contains 'frontend' service"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

echo "Checking nginx configuration..."
echo "────────────────────────────────────────────────────────────"
check_content "nginx.conf" "server {"
check_content "nginx.conf" "location /api"
check_content "nginx.conf" "proxy_pass"
echo ""

echo "Checking documentation..."
echo "────────────────────────────────────────────────────────────"
check_file "DOCKER_DEPLOYMENT.md"
check_file "DOCKER_UPDATE_COMPLETE.md"
check_file "DOCKER_QUICK_REFERENCE.txt"
check_file "DOCKER_BEFORE_AFTER.md"
check_file "DOCKER_DEPLOYMENT_SUMMARY.md"
check_file "DEPLOYMENT_READY.txt"
echo ""

echo "Checking database initialization scripts..."
echo "────────────────────────────────────────────────────────────"
check_file "scripts/init-database.js"
check_file "scripts/package.json"
if [ -d "scripts/node_modules" ]; then
    echo -e "${GREEN}✓${NC} scripts/node_modules exists"
else
    echo -e "${YELLOW}⚠${NC} scripts/node_modules missing (run: cd scripts && npm install)"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

echo "Checking application files..."
echo "────────────────────────────────────────────────────────────"
check_file "server/src/index.js"
check_file "server/package.json"
check_file "client/package.json"
check_file "database/schema.sql"
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Verification Summary                                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Your deployment is ready. To deploy:"
    echo "  1. Ensure database is initialized: cd scripts && npm run init-db"
    echo "  2. Configure database connection in docker-compose.yml"
    echo "  3. Deploy: docker-compose up -d"
    echo "  4. Monitor: docker-compose logs -f web"
    echo "  5. Access: http://localhost"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
    echo ""
    echo "Deployment should work, but check warnings above."
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s) found${NC}"
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
    echo ""
    echo "Please fix errors before deploying."
    exit 1
fi
