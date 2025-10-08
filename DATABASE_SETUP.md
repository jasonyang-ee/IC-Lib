# Database Initialization - Quick Start

## Your Setup
- **Database Host**: infra.main.local
- **Port**: 5435
- **User**: sami
- **Password**: 123456
- **Database**: cip (already created, currently blank)

## Initialize Your Database (Choose One Method)

### Method 1: Node.js Script (✨ Recommended)

```bash
cd scripts
npm install     # Already done!
npm run init-db
```

**Advantages**:
- No need to install PostgreSQL client tools
- Works on all platforms (Windows/Mac/Linux)
- Better error handling
- Interactive prompts

### Method 2: Bash Script (Linux/Mac/Git Bash)

```bash
./scripts/init-database.sh
```

**Advantages**:
- Fast and direct
- No additional dependencies beyond psql
- Good for automation

### Method 3: Windows Batch Script

```cmd
scripts\init-database.bat
```

## What Will Happen

1. ✅ Script tests connection to `infra.main.local:5435`
2. ✅ Checks if database is blank or has existing tables
3. ✅ Creates complete schema (10+ tables, indexes, triggers, views)
4. ✅ Asks if you want to load sample data
5. ✅ Verifies everything is working

## Sample Data Includes

If you choose to load sample data:
- 10 Manufacturers (TI, STMicro, Yageo, Murata, etc.)
- 8 Component Categories (Resistor, Capacitor, IC, etc.)
- 15+ Sample Components with specifications
- 6 Inventory entries
- 3 Distributor pricing examples

## After Initialization

### Start the Backend
```bash
cd server
npm run dev
```
Backend will run on: http://localhost:3001

### Start the Frontend
```bash
cd client
npm run dev
```
Frontend will run on: http://localhost:5173

### Access the Application
Open your browser to: **http://localhost:5173**

## Troubleshooting

### Can't Connect
```bash
# Test connection manually
psql -h infra.main.local -p 5435 -U sami -d cip

# If this fails, check:
# 1. Database server is running
# 2. Firewall allows port 5435
# 3. Network can reach infra.main.local
```

### psql Not Found
Use the Node.js script instead:
```bash
cd scripts
npm run init-db
```

### Permission Denied
The user `sami` needs CREATE privileges:
```sql
-- Run as postgres superuser
GRANT CREATE ON DATABASE cip TO sami;
GRANT ALL PRIVILEGES ON SCHEMA public TO sami;
```

## Verify Installation

After initialization, check if everything worked:

```bash
# Connect to database
psql -h infra.main.local -p 5435 -U sami -d cip

# List tables
\dt

# Count records (if you loaded sample data)
SELECT COUNT(*) FROM components;
SELECT COUNT(*) FROM component_categories;

# Exit
\q
```

## Reset Database (If Needed)

If you need to start over:

```bash
cd scripts
npm run reset-db
```

⚠️ **WARNING**: This will delete ALL data!

## Manual Method (If Scripts Don't Work)

```bash
# Connect to database
psql -h infra.main.local -p 5435 -U sami -d cip

# Run schema
\i database/schema.sql

# Optional: Load sample data
\i database/sample-data.sql

# Verify
\dt
\q
```

## Next Steps

1. ✅ Initialize database (you're here!)
2. ⬜ Configure API keys in `server/.env` (optional)
3. ⬜ Start backend server
4. ⬜ Start frontend
5. ⬜ Start adding your components!

## Need Help?

- Full documentation: `scripts/README.md`
- Main project guide: `README.md`
- API documentation: `API.md`
- Quick start: `QUICKSTART.md`

---

**Ready?** Run: `cd scripts && npm run init-db` 🚀
