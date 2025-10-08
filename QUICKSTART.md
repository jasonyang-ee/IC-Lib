# Quick Start Guide

## Development Setup (Manual)

### Option 1: Using Existing PostgreSQL Server

Since you have PostgreSQL running at `infra.main.local:5435`:

#### 1. Initialize the Database
```bash
cd scripts
npm install
npm run init-db
```
This will set up all tables, indexes, and optionally load sample data.

**Detailed instructions**: See [DATABASE_SETUP.md](DATABASE_SETUP.md)

#### 2. Start Backend Server
Open a terminal:
```bash
cd server
npm run dev
```
Backend API will be available at http://localhost:3001

#### 3. Start Frontend
Open another terminal:
```bash
cd client
npm run dev
```
Frontend will be available at http://localhost:5173

#### 4. Access the Application
Open your browser to http://localhost:5173

---

### Option 2: Using Docker for Local Database

If you prefer Docker for local development:

#### 1. Start PostgreSQL Database
```bash
docker-compose -f docker-compose.dev.yml up -d
```
This starts PostgreSQL on port 5435 with the schema automatically initialized.

#### 2. Start Backend Server
Open a terminal:
```bash
cd server
npm run dev
```
Backend API will be available at http://localhost:3001

### 3. Start Frontend
Open another terminal:
```bash
cd client
npm run dev
```
Frontend will be available at http://localhost:5173

### 4. Access the Application
Open your browser to http://localhost:5173

---

## Production Deployment (Docker)

For production, use the unified Docker deployment:

### 1. Initialize Database
```bash
cd scripts
npm run init-db
```

### 2. Configure Database Connection
Edit `docker-compose.yml` and update:
```yaml
environment:
  - DB_HOST=infra.main.local  # Your PostgreSQL host
  - DB_PORT=5435
  - DB_USER=sami
  - DB_PASSWORD=123456
  - DB_NAME=cip
```

### 3. Build and Start
```bash
docker-compose up -d
```

### 4. View Logs
```bash
docker-compose logs -f web
```

### 5. Access Application
- Frontend: http://localhost
- API: http://localhost/api
- Health: http://localhost/health

### 6. Stop
```bash
docker-compose down
```

**See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for detailed production deployment guide.**

---

## First Time Setup

### Configure API Keys (Optional)
Edit `server/.env` and add your API keys:
```env
DIGIKEY_CLIENT_ID=your_client_id
DIGIKEY_CLIENT_SECRET=your_client_secret
MOUSER_API_KEY=your_api_key
ULTRA_LIBRARIAN_TOKEN=your_token
SNAPEDA_API_KEY=your_api_key
```

**Note**: The application works without API keys, but vendor search features will be limited.

## Database Access

### Using Your Existing PostgreSQL
```bash
psql -h infra.main.local -p 5435 -U sami -d cip
```

### If Using Docker Dev Database
```bash
docker exec -it allegro-postgres-dev psql -U sami -d cip
```

### Via GUI Tool
- Host: localhost (or infra.main.local)
- Port: 5435
- User: sami
- Password: 123456
- Database: cip

## Common Commands

### Development

#### Stop Backend/Frontend
Press `Ctrl+C` in each terminal

#### Restart Backend
```bash
cd server
npm run dev
```

#### Restart Frontend
```bash
cd client
npm run dev
```

### Production (Docker)

#### Stop Services
```bash
docker-compose down
```

#### Restart Services
```bash
docker-compose restart web
```

#### View Logs
```bash
docker-compose logs -f web
```

#### Rebuild
```bash
docker-compose up -d --build
```

### Stop Development Database (if using Docker)
```bash
# Stop database only
docker-compose -f docker-compose.dev.yml down

# Stop all (Ctrl+C in terminals running npm)
```

### Reset Database
```bash
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

### View Logs
```bash
# Backend logs
cd server && npm run dev

# Database logs
docker logs allegro-postgres-dev
```

## Production Deployment

### Using Docker Compose
```bash
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

Access:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Database: localhost:5435

## Troubleshooting

### Port Already in Use
If port 5435, 3001, or 5173 is already in use:
1. Stop the conflicting service
2. Or modify the port in docker-compose files

### Database Connection Error
1. Verify PostgreSQL is running: `docker ps`
2. Check logs: `docker logs allegro-postgres-dev`
3. Verify .env configuration in server folder

### Frontend Not Loading
1. Verify backend is running on port 3001
2. Check browser console for errors
3. Verify .env in client folder points to correct API URL

## Testing the Application

### 1. View Dashboard
- Navigate to http://localhost:5173
- Should see dashboard with statistics

### 2. Browse Library
- Click "Library" in sidebar
- Browse components by category
- Use search functionality

### 3. Try Vendor Search
- Click "Vendor Search"
- Enter a part number (e.g., "LM358")
- View results from Digikey/Mouser

### 4. View Reports
- Click "Reports"
- Select different report types
- View generated data

## API Testing

### Using curl
```bash
# Health check
curl http://localhost:3001/api/health

# Get all categories
curl http://localhost:3001/api/categories

# Get dashboard stats
curl http://localhost:3001/api/dashboard/stats
```

### Using Postman
Import the base URL: http://localhost:3001/api

## Next Steps

1. ✅ Add sample data to the database
2. ✅ Configure API keys for vendor search
3. ✅ Customize categories for your needs
4. ✅ Set up backup strategy
5. ✅ Configure production environment

## Need Help?

Refer to the main README.md for:
- Detailed API documentation
- Database schema explanation
- Advanced configuration options
- Deployment best practices
