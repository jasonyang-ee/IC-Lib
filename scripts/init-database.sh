#!/bin/bash

# Allegro Component Library - Database Initialization Script
# This script initializes a blank PostgreSQL database with the required schema

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database configuration
DB_HOST="${DB_HOST:-infra.main.local}"
DB_PORT="${DB_PORT:-5435}"
DB_USER="${DB_USER:-sami}"
DB_PASSWORD="${DB_PASSWORD:-123456}"
DB_NAME="${DB_NAME:-cip}"

echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}Allegro Component Library${NC}"
echo -e "${GREEN}Database Initialization Script${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql is not installed${NC}"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

echo "Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  User: $DB_USER"
echo "  Database: $DB_NAME"
echo ""

# Test connection
echo -e "${YELLOW}Testing database connection...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Cannot connect to database${NC}"
    echo "Please verify:"
    echo "  1. Database server is running"
    echo "  2. Connection details are correct"
    echo "  3. Network/firewall allows connection"
    exit 1
fi

echo -e "${GREEN}✓ Database connection successful${NC}"
echo ""

# Check if schema already exists
echo -e "${YELLOW}Checking existing schema...${NC}"
TABLE_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")

if [ "$TABLE_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}Warning: Database already contains $TABLE_COUNT tables${NC}"
    read -p "Do you want to drop all tables and reinitialize? (yes/no): " CONFIRM
    
    if [ "$CONFIRM" = "yes" ]; then
        echo -e "${YELLOW}Dropping existing tables...${NC}"
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT ALL ON SCHEMA public TO public;
EOF
        echo -e "${GREEN}✓ Existing tables dropped${NC}"
    else
        echo -e "${YELLOW}Initialization cancelled${NC}"
        exit 0
    fi
fi

# Initialize schema
echo ""
echo -e "${YELLOW}Initializing database schema...${NC}"

PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f ./database/schema.sql

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to initialize schema${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Schema initialized successfully${NC}"
echo ""

# Verify tables
echo -e "${YELLOW}Verifying installation...${NC}"
TABLE_LIST=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")

echo "Tables created:"
echo "$TABLE_LIST" | while read line; do
    if [ ! -z "$line" ]; then
        echo "  ✓ $line"
    fi
done

# Ask about sample data
echo ""
read -p "Do you want to load sample data? (yes/no): " LOAD_SAMPLE

if [ "$LOAD_SAMPLE" = "yes" ]; then
    echo -e "${YELLOW}Loading sample data...${NC}"
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f ./database/sample-data.sql
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Sample data loaded successfully${NC}"
        
        # Show record counts
        echo ""
        echo "Record counts:"
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
            SELECT 'Components: ' || COUNT(*) FROM components
            UNION ALL
            SELECT 'Categories: ' || COUNT(*) FROM component_categories
            UNION ALL
            SELECT 'Manufacturers: ' || COUNT(*) FROM manufacturers
            UNION ALL
            SELECT 'Inventory Items: ' || COUNT(*) FROM inventory;
        " | while read line; do
            echo "  $line"
        done
    else
        echo -e "${YELLOW}Warning: Failed to load sample data${NC}"
    fi
fi

echo ""
echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}Database initialization complete!${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Start the backend server: cd server && npm run dev"
echo "  2. Start the frontend: cd client && npm run dev"
echo "  3. Open http://localhost:5173 in your browser"
echo ""
