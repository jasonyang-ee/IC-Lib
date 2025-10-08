# 🎉 Database Initialization Scripts Created!

## ✅ What Was Added

I've created comprehensive database initialization scripts to set up your blank PostgreSQL database at `infra.main.local:5435`.

### New Files Created

```
scripts/
├── init-database.js       # Node.js initialization script (recommended)
├── init-database.sh       # Bash script for Linux/Mac
├── init-database.bat      # Windows batch script
├── reset-database.js      # Reset utility (drops all data)
├── package.json           # Dependencies
└── README.md              # Detailed documentation

DATABASE_SETUP.md          # Quick start guide for your setup
```

### Scripts Also Updated

- `README.md` - Added section for existing PostgreSQL setup
- `QUICKSTART.md` - Updated with database initialization steps

---

## 🚀 How to Initialize Your Database

### Method 1: Node.js Script (✨ Recommended)

```bash
cd scripts
npm install     # Already installed!
npm run init-db
```

**Why this is recommended:**
- ✅ Works on Windows, Mac, and Linux
- ✅ No need to install PostgreSQL client tools
- ✅ Better error messages
- ✅ Interactive prompts guide you through the process

### Method 2: Bash Script (Linux/Mac/Git Bash)

```bash
./scripts/init-database.sh
```

### Method 3: Windows Batch Script

```cmd
scripts\init-database.bat
```

---

## 📋 What the Scripts Do

### Step-by-Step Process

1. **Test Connection** ✓
   - Connects to `infra.main.local:5435`
   - Verifies database `cip` is accessible

2. **Check Existing Schema** ✓
   - Detects if tables already exist
   - Asks for confirmation before dropping (if any exist)

3. **Create Schema** ✓
   - Creates all 10+ tables
   - Sets up indexes for performance
   - Creates triggers for auto-timestamps
   - Creates views for common queries

4. **Load Sample Data** (Optional) ✓
   - 10 Manufacturers
   - 8 Component Categories
   - 15+ Sample Components
   - 6 Inventory Items
   - Distributor information

5. **Verify** ✓
   - Lists all created tables
   - Shows record counts
   - Confirms success

---

## 📊 Database Schema Created

### Tables (10+)

| Table | Description |
|-------|-------------|
| `component_categories` | Categories like Resistor, Capacitor, IC |
| `manufacturers` | Manufacturer information |
| `distributors` | Digikey, Mouser, etc. |
| `components` | Master component table |
| `component_specifications` | Flexible key-value specs |
| `distributor_info` | Pricing and stock data |
| `inventory` | In-house stock tracking |
| `footprint_sources` | CAD footprint downloads |

### Features

- ✅ UUID primary keys throughout
- ✅ Automatic timestamp updates via triggers
- ✅ Optimized indexes on commonly queried fields
- ✅ Foreign key constraints for data integrity
- ✅ Views for complex queries
- ✅ JSONB for flexible price breaks storage

---

## 🎯 Quick Start (3 Steps)

### 1. Initialize Database
```bash
cd scripts
npm run init-db
```

**When prompted:**
- If database is blank: Script will proceed
- If tables exist: Choose whether to drop them
- Sample data: Choose "yes" to get started quickly

### 2. Start Backend
```bash
cd ../server
npm run dev
```
Runs on: http://localhost:3001

### 3. Start Frontend
```bash
cd ../client
npm run dev
```
Runs on: http://localhost:5173

### 4. Open Browser
Visit: **http://localhost:5173**

---

## 🔧 Configuration

The scripts are pre-configured for your setup:

```env
DB_HOST=infra.main.local
DB_PORT=5435
DB_USER=sami
DB_PASSWORD=123456
DB_NAME=cip
```

### Override Settings (Optional)

You can override with environment variables:

```bash
export DB_HOST=different-host
export DB_PORT=5432
npm run init-db
```

---

## 🛠️ Additional Scripts

### Reset Database

**⚠️ WARNING**: This drops ALL data!

```bash
cd scripts
npm run reset-db
```

You'll need to confirm twice to prevent accidents.

---

## 📚 Documentation

### Detailed Guides

| File | Purpose |
|------|---------|
| `DATABASE_SETUP.md` | Quick reference for your setup |
| `scripts/README.md` | Comprehensive script documentation |
| `README.md` | Full project documentation |
| `QUICKSTART.md` | Fast setup guide |
| `API.md` | API endpoints reference |

---

## 🔍 Verification

After initialization, verify everything works:

```bash
# Connect to database
psql -h infra.main.local -p 5435 -U sami -d cip

# List tables
\dt

# If you loaded sample data, check counts
SELECT 
    'Components' as type, COUNT(*) as count FROM components
UNION ALL
SELECT 'Categories', COUNT(*) FROM component_categories
UNION ALL
SELECT 'Manufacturers', COUNT(*) FROM manufacturers
UNION ALL
SELECT 'Inventory', COUNT(*) FROM inventory;

# Exit
\q
```

---

## 🆘 Troubleshooting

### Can't Connect to Database

```bash
# Test connection manually
psql -h infra.main.local -p 5435 -U sami -d cip

# If fails, check:
# 1. PostgreSQL server is running
# 2. Port 5435 is accessible
# 3. Network can reach infra.main.local
# 4. Firewall allows connection
```

### psql Not Installed

Use the Node.js script - it doesn't require psql:
```bash
cd scripts
npm run init-db
```

### Permission Denied

Grant necessary privileges:
```sql
-- As postgres superuser
GRANT CREATE ON DATABASE cip TO sami;
GRANT ALL PRIVILEGES ON SCHEMA public TO sami;
```

### Script Errors

Check:
1. Database `cip` exists
2. User `sami` can connect
3. Network connectivity
4. PostgreSQL version (18 recommended)

---

## 🎯 Sample Data Contents

If you choose to load sample data:

### Components (15+)
- **Resistors**: 10K, 1K, 100Ω, 22K, 4.7K (various packages)
- **Capacitors**: 10µF, 1µF, 100nF, 22pF, 47µF (various types)
- **ICs**: LM358, LM324, TL072, 74HC595, NE555

### Manufacturers (10)
- Texas Instruments
- STMicroelectronics
- Microchip Technology
- Analog Devices
- NXP Semiconductors
- Infineon Technologies
- Yageo
- Murata
- TDK
- Vishay

### Categories (8)
- Resistor
- Capacitor
- Inductor
- IC
- Diode
- Transistor
- Connector
- Crystal

---

## ✨ Features of the Schema

### Flexible Design
- **Any component can have any specifications**
  - Key-value storage in `component_specifications`
  - No rigid column structure

### Smart Tracking
- **Automatic timestamps** on create/update
- **Footprint source tracking** (Ultra Librarian, SnapEDA)
- **Price breaks as JSONB** - flexible pricing tiers

### Performance
- **Optimized indexes** on foreign keys and search fields
- **Views** for common complex queries
- **Cascading deletes** maintain referential integrity

---

## 🎓 Next Steps

After database initialization:

### 1. Configure API Keys (Optional)
Edit `server/.env` to add:
- Digikey API credentials
- Mouser API key
- Ultra Librarian token
- SnapEDA API key

**Note**: App works without these, but vendor search will be limited.

### 2. Start the Application
```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend
cd client && npm run dev
```

### 3. Explore the Application
- **Dashboard**: View statistics
- **Library**: Browse components
- **Inventory**: Check stock levels
- **Vendor Search**: Search Digikey/Mouser
- **Reports**: Generate analytics

### 4. Add Your Components
- Via UI: Use the vendor search and "Add to Library"
- Via API: POST to `/api/components`
- Direct SQL: Insert into components table

---

## 📈 Database Maintenance

### Backup Database

```bash
# Full backup
pg_dump -h infra.main.local -p 5435 -U sami -d cip > backup_$(date +%Y%m%d).sql

# Specific table
pg_dump -h infra.main.local -p 5435 -U sami -d cip -t components > components_backup.sql
```

### Restore Backup

```bash
psql -h infra.main.local -p 5435 -U sami -d cip < backup_20251007.sql
```

### Monitor Database

```sql
-- Table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Record counts
SELECT 'components' as table_name, COUNT(*) FROM components
UNION ALL SELECT 'inventory', COUNT(*) FROM inventory
UNION ALL SELECT 'manufacturers', COUNT(*) FROM manufacturers;
```

---

## 🎉 Summary

You now have:

✅ **3 initialization scripts** (Node.js, Bash, Windows)
✅ **Complete database schema** (10+ tables, indexes, triggers)
✅ **Sample data** (optional, for testing)
✅ **Reset utility** (for starting over)
✅ **Comprehensive documentation** (4 guide files)

**Everything is ready!** Just run:

```bash
cd scripts
npm run init-db
```

Then start your backend and frontend servers! 🚀

---

**Questions?** Check:
- `DATABASE_SETUP.md` - Quick reference
- `scripts/README.md` - Detailed script docs
- `README.md` - Full project guide
