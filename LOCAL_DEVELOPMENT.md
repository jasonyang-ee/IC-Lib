# Local Development Guide

## Quick Start

### 1. Initial Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your database configuration
nano .env
```

### 2. Start Development Servers

```bash
# Start both frontend and backend with hot reload
./start_local.sh
```

This will:
- Load environment variables from `.env`
- Test database connection
- Install dependencies if needed
- Start backend on port 3500 with nodemon (auto-reload)
- Start frontend on port 5173 with Vite (auto-reload)

### 3. Access Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3500/api
- **Health Check**: http://localhost:3500/health

## Environment Configuration

### .env File

Create a `.env` file in the project root (already gitignored):

```env
# Database Configuration
DB_HOST=infra.main.local
DB_PORT=5435
DB_USER=sami
DB_PASSWORD=123456
DB_NAME=cip

# Server Configuration
PORT=3500
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# API Keys (Optional)
DIGIKEY_CLIENT_ID=
DIGIKEY_CLIENT_SECRET=
MOUSER_API_KEY=
ULTRA_LIBRARIAN_TOKEN=
SNAPEDA_API_KEY=
```

## Development Scripts

### start_local.sh (Local Development)

**Purpose**: Run both frontend and backend with hot reload

**Features**:
- Loads environment from `.env` file
- Tests database connection
- Auto-installs dependencies if missing
- Starts backend with nodemon (watches for changes)
- Starts frontend with Vite dev server (hot module reload)
- Both servers automatically restart on file changes

**Usage**:
```bash
./start_local.sh
```

**What you'll see**:
```
================================================================
  Allegro Component Library - Local Development Mode
================================================================

Loading environment variables from .env...
✓ Environment variables loaded

Configuration:
  Database: infra.main.local:5435
  Database Name: cip
  Backend Port: 3500
  Frontend Port: 5173 (Vite dev server)
  Environment: development

Testing database connection...
✓ Database connection successful

Checking dependencies...
✓ Backend dependencies found
✓ Frontend dependencies found

================================================================
  Starting Development Servers...
================================================================

→ Starting Backend (Express.js with nodemon)...
✓ Backend started (PID: 1234)
   URL: http://localhost:3500

→ Starting Frontend (Vite dev server)...
✓ Frontend started (PID: 5678)
   URL: http://localhost:5173

================================================================
  ✓ Development servers running!
================================================================

Frontend: http://localhost:5173
Backend API: http://localhost:3500/api
Health Check: http://localhost:3500/health

Hot Reload: Both servers will automatically reload on file changes

Download Folders:
  - ./download/footprint
  - ./download/symbol
  - ./download/pad

Press Ctrl+C to stop all servers
```

**Stop servers**: Press `Ctrl+C`

## Download Directories

Downloaded CAD files are organized into separate folders:

```
download/
├── footprint/    # Footprint files (.dra, .brd, etc.)
├── symbol/       # Symbol files (.psm, .sym, etc.)
└── pad/          # Pad stack files (.pad, etc.)
```

These directories are:
- Created automatically by `start_local.sh`
- Mounted as volumes in Docker
- Ignored by git (in .gitignore)
- Persistent across restarts

## Hot Reload

### Backend Hot Reload (nodemon)

- Watches all `.js` files in `server/src/`
- Automatically restarts server on changes
- No manual restart needed

**Example**: Edit `server/src/routes/components.js`
```
[nodemon] restarting due to changes...
[nodemon] starting `node src/index.js`
🚀 Server running on port 3500
```

### Frontend Hot Reload (Vite HMR)

- Watches all files in `client/src/`
- Hot Module Replacement (instant updates)
- No page refresh needed

**Example**: Edit `client/src/pages/Dashboard.jsx`
```
[vite] hmr update /src/pages/Dashboard.jsx
```

## Development Workflow

### 1. Make Code Changes

**Backend changes**: Edit files in `server/src/`
- Routes: `server/src/routes/*.js`
- Controllers: `server/src/controllers/*.js`
- Services: `server/src/services/*.js`

**Frontend changes**: Edit files in `client/src/`
- Pages: `client/src/pages/*.jsx`
- Components: `client/src/components/*.jsx`
- Styles: `client/src/index.css`

### 2. See Changes Instantly

- Backend: Server restarts automatically (1-2 seconds)
- Frontend: Updates instantly in browser (no refresh)

### 3. Test Your Changes

- Frontend: http://localhost:5173
- API: Use browser DevTools or curl

```bash
# Test API endpoint
curl http://localhost:3500/api/components

# Test health
curl http://localhost:3500/health
```

## Common Tasks

### Install New Dependencies

**Backend**:
```bash
cd server
npm install package-name
cd ..
```

**Frontend**:
```bash
cd client
npm install package-name
cd ..
```

Restart `start_local.sh` to pick up new dependencies.

### Database Changes

1. Update `database/schema.sql`
2. Run migration:
```bash
cd scripts
npm run reset-db  # WARNING: Deletes all data
# or manually apply changes with psql
```

### Environment Variables

1. Edit `.env` file
2. Restart `start_local.sh`

Variables are loaded on startup.

### Clear Cache/Rebuild

**Backend**:
```bash
cd server
rm -rf node_modules
npm install
cd ..
```

**Frontend**:
```bash
cd client
rm -rf node_modules dist
npm install
cd ..
```

## Troubleshooting

### "ERROR: .env file not found"

**Solution**:
```bash
cp .env.example .env
nano .env  # Edit database settings
```

### "Database connection failed"

**Check**:
1. PostgreSQL is running
2. Database settings in `.env` are correct
3. Network can reach database host

**Test manually**:
```bash
psql -h infra.main.local -p 5435 -U sami -d cip
```

### "Port already in use"

**Backend (port 3500)**:
```bash
# Find process
lsof -i :3500
# Kill it
kill -9 <PID>
```

**Frontend (port 5173)**:
```bash
# Find process
lsof -i :5173
# Kill it
kill -9 <PID>
```

### "Backend won't start"

**Check**:
```bash
cd server
npm install  # Ensure dependencies installed
node src/index.js  # Run directly to see errors
```

### "Frontend won't start"

**Check**:
```bash
cd client
npm install  # Ensure dependencies installed
npm run dev  # Run directly to see errors
```

### "Changes not reflecting"

**Backend**: Wait for nodemon to restart (watch terminal)

**Frontend**: Check browser console for HMR errors, refresh page

**Hard reset**:
```bash
# Stop servers (Ctrl+C)
# Clear browser cache
# Restart
./start_local.sh
```

## Production vs Development

### Development (start_local.sh)

- ✅ Hot reload enabled
- ✅ Source maps for debugging
- ✅ Verbose logging
- ✅ CORS enabled for localhost
- ✅ No build step needed
- ✅ Fast iteration

**Ports**:
- Frontend: 5173 (Vite dev server)
- Backend: 3500 (Express with nodemon)

### Production (Docker)

- ✅ Optimized builds
- ✅ Minified assets
- ✅ Nginx reverse proxy
- ✅ Single container deployment
- ✅ Health checks
- ✅ Auto-restart

**Ports**:
- All traffic: 80 (Nginx)
- Backend internal: 3500

See `DOCKER_DEPLOYMENT.md` for production deployment.

## Files Structure

```
allegroSQL/
├── .env                    # Your local config (gitignored)
├── .env.example            # Template for .env
├── start_local.sh          # Local dev script
├── start.sh                # Docker startup script
├── docker-compose.yml      # Docker deployment
│
├── server/
│   ├── .env.example        # Backend env template
│   ├── src/
│   │   ├── index.js        # Entry point (PORT=3500)
│   │   ├── routes/         # API routes
│   │   ├── controllers/    # Business logic
│   │   └── services/       # External services
│   └── package.json        # Backend dependencies
│
├── client/
│   ├── src/
│   │   ├── pages/          # React pages
│   │   ├── components/     # React components
│   │   ├── utils/
│   │   │   └── api.js      # API client (port 3500)
│   │   └── index.css       # Tailwind styles
│   └── package.json        # Frontend dependencies
│
├── download/               # CAD files (gitignored)
│   ├── footprint/
│   ├── symbol/
│   └── pad/
│
└── database/
    └── schema.sql          # Database schema
```

## Best Practices

1. **Always use start_local.sh** for development
2. **Never commit .env** (already in .gitignore)
3. **Test locally** before Docker deployment
4. **Use feature branches** for new development
5. **Check logs** if something doesn't work
6. **Keep dependencies updated** regularly

## Next Steps

1. ✅ Create `.env` from template
2. ✅ Run `./start_local.sh`
3. ✅ Open http://localhost:5173
4. ✅ Start coding!

Happy developing! 🚀
