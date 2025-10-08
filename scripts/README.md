# Database Initialization Scripts

Helper scripts to initialize your PostgreSQL database for Allegro Component Library.

## Prerequisites

- PostgreSQL server running at `infra.main.local:5435`
- Database `cip` already created
- User `sami` with password `123456` has access to the database

## Available Scripts

### 1. Initialize Database (Recommended)

Initializes a blank database with the complete schema and optionally loads sample data.

#### Option A: Node.js Script (Recommended)
```bash
cd scripts
npm install
npm run init-db
```

#### Option B: Bash Script (Linux/Mac)
```bash
chmod +x scripts/init-database.sh
./scripts/init-database.sh
```

#### Option C: Batch Script (Windows)
```cmd
scripts\init-database.bat
```

### 2. Reset Database

**⚠️ WARNING**: Drops all data and reinitializes the schema.

```bash
cd scripts
npm run reset-db
```

## What the Scripts Do

### Initialization Process

1. **Connection Test**: Verifies connection to your PostgreSQL server
2. **Schema Check**: Checks if tables already exist
3. **Confirmation**: If tables exist, asks for confirmation to drop them
4. **Schema Creation**: Creates all required tables, indexes, triggers, and views
5. **Verification**: Lists all created tables
6. **Sample Data**: Optionally loads sample components, categories, and inventory

### Schema Created

The scripts create the following database objects:

**Tables:**
- `component_categories` - Component categories (Resistor, Capacitor, IC, etc.)
- `manufacturers` - Manufacturer information
- `distributors` - Distributor information (Digikey, Mouser)
- `components` - Master component table
- `component_specifications` - Flexible key-value specifications
- `distributor_info` - Pricing and stock information
- `inventory` - In-house inventory tracking
- `footprint_sources` - Footprint download tracking

**Features:**
- UUID primary keys
- Automatic timestamp updates via triggers
- Optimized indexes
- Foreign key constraints
- Views for common queries

## Environment Variables

You can override default connection settings with environment variables:

```bash
export DB_HOST=infra.main.local
export DB_PORT=5435
export DB_USER=sami
export DB_PASSWORD=123456
export DB_NAME=cip

# Then run the script
npm run init-db
```

### Windows
```cmd
set DB_HOST=infra.main.local
set DB_PORT=5435
set DB_USER=sami
set DB_PASSWORD=123456
set DB_NAME=cip

scripts\init-database.bat
```

## Sample Data

The sample data includes:

- **10 Manufacturers**: Texas Instruments, STMicroelectronics, Yageo, Murata, etc.
- **8 Categories**: Resistor, Capacitor, Inductor, IC, Diode, etc.
- **15+ Components**: Sample resistors, capacitors, and ICs with specifications
- **6 Inventory Entries**: Sample stock tracking
- **3 Distributor Info Entries**: Sample pricing from Digikey and Mouser

## Troubleshooting

### Cannot Connect to Database

**Error**: `Error: Cannot connect to database`

**Solutions**:
1. Verify PostgreSQL is running:
   ```bash
   # Linux/Mac
   sudo systemctl status postgresql
   
   # Or check if port is open
   telnet infra.main.local 5435
   ```

2. Check firewall settings allow connection to port 5435

3. Verify credentials in your `.env` or environment variables

4. Test connection manually:
   ```bash
   psql -h infra.main.local -p 5435 -U sami -d cip
   ```

### psql Command Not Found

**Error**: `psql is not installed`

**Solutions**:

**Linux (Debian/Ubuntu)**:
```bash
sudo apt-get update
sudo apt-get install postgresql-client
```

**Linux (RedHat/CentOS)**:
```bash
sudo yum install postgresql
```

**macOS**:
```bash
brew install postgresql
```

**Windows**:
Download from: https://www.postgresql.org/download/windows/

Or use the Node.js script which doesn't require psql:
```bash
cd scripts
npm install
npm run init-db
```

### Permission Denied

**Error**: Permission errors when creating tables

**Solutions**:
1. Ensure user `sami` has CREATE privileges:
   ```sql
   GRANT CREATE ON DATABASE cip TO sami;
   GRANT ALL PRIVILEGES ON SCHEMA public TO sami;
   ```

2. Connect as superuser to grant permissions:
   ```bash
   psql -h infra.main.local -p 5435 -U postgres -d cip
   ```

### Database Already Has Tables

The script will detect existing tables and ask for confirmation before dropping them. If you want to keep existing data, answer "no" when prompted.

To add tables alongside existing ones, manually run specific parts of `schema.sql`.

## Manual Initialization

If you prefer to initialize manually:

```bash
# Connect to your database
psql -h infra.main.local -p 5435 -U sami -d cip

# Run schema file
\i database/schema.sql

# Optionally load sample data
\i database/sample-data.sql

# Verify tables
\dt

# Quit
\q
```

## Backup Before Reset

Before using the reset script, always backup your data:

```bash
# Backup entire database
pg_dump -h infra.main.local -p 5435 -U sami -d cip > backup.sql

# Backup specific table
pg_dump -h infra.main.local -p 5435 -U sami -d cip -t components > components_backup.sql
```

## Verifying Installation

After initialization, verify the setup:

```bash
# Connect to database
psql -h infra.main.local -p 5435 -U sami -d cip

# Check tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

# Check record counts
SELECT 'components' as table_name, COUNT(*) as count FROM components
UNION ALL SELECT 'categories', COUNT(*) FROM component_categories
UNION ALL SELECT 'manufacturers', COUNT(*) FROM manufacturers;

# Check a sample component
SELECT * FROM component_full_details LIMIT 1;
```

## Next Steps After Initialization

1. **Start the Backend**:
   ```bash
   cd server
   npm run dev
   ```

2. **Start the Frontend**:
   ```bash
   cd client
   npm run dev
   ```

3. **Access the Application**:
   Open http://localhost:5173

4. **Add Your Components**:
   - Use the UI to add components
   - Or use the API endpoints
   - Or import from CSV (future feature)

## Script Options

### Automated (Non-Interactive)

For CI/CD or automated setups, you can modify the scripts to skip prompts:

**Node.js**:
```javascript
// Set environment variable
process.env.AUTO_CONFIRM = 'yes';
```

**Bash**:
```bash
# Pass yes to all prompts
yes yes | ./scripts/init-database.sh
```

## Support

If you encounter issues:

1. Check the main `README.md` for general setup
2. Review database credentials in `server/.env`
3. Verify network connectivity to database server
4. Check PostgreSQL server logs
5. Ensure database `cip` exists and is accessible

## Files

- `init-database.js` - Node.js initialization script
- `init-database.sh` - Bash script for Linux/Mac
- `init-database.bat` - Batch script for Windows
- `reset-database.js` - Database reset utility
- `package.json` - Node.js dependencies
- `README.md` - This file

## License

Part of the Allegro Component Library Management System
