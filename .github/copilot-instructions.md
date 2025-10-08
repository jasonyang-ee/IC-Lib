# Allegro Component Library - Project Setup

## Status Checklist

- [x] Verify copilot-instructions.md created
- [x] Clarify Project Requirements
- [x] Scaffold the Project
- [x] Customize the Project
- [x] Install Required Extensions (N/A)
- [x] Compile the Project
- [x] Create and Run Task (N/A)
- [x] Launch the Project
- [x] Ensure Documentation is Complete
- [x] Update Docker Deployment (Unified Container)

## Project Overview
Full-stack database management system for Allegro CIS component library with React + Vite + Tailwind frontend and Express.js backend, deployed as a unified Docker container.

## Summary
✅ Project successfully created with:
- React 19 + Vite 7 + Tailwind CSS frontend
- Express.js backend with PostgreSQL integration
- Complete API implementation for components, inventory, search, and reports
- **Unified Docker deployment** with frontend + backend in single container
- Nginx reverse proxy for production deployment
- Comprehensive database schema with flexible design
- Integration stubs for Digikey, Mouser, Ultra Librarian, and SnapEDA APIs
- All 5 main pages implemented (Dashboard, Library, Inventory, Vendor Search, Reports)
- Database initialization scripts for existing PostgreSQL server

## Deployment Architecture

### Production (Docker - Unified Container)
```
┌────────────────────────────────┐
│   Container: allegro-web       │
│  ┌──────────┐  ┌────────────┐  │
│  │  Nginx   │─▶│ Express.js │  │
│  │  :80     │  │   :3001    │  │
│  └──────────┘  └────────────┘  │
└────────────────────────────────┘
              │
              ▼
    External PostgreSQL
  (infra.main.local:5435)
```

### Development (Manual)
- Backend: `cd server && npm run dev` (port 3001)
- Frontend: `cd client && npm run dev` (port 5173)
- Database: External PostgreSQL at infra.main.local:5435

## Next Steps
1. **Production**: Deploy with `docker-compose up -d`
2. Configure API keys in `server/.env` for full vendor search functionality
3. Optional: Set up HTTPS with reverse proxy (Traefik/nginx)

## Key Files
- `Dockerfile` - Multi-stage build for unified deployment
- `startup.sh` - Orchestrates nginx + Express startup
- `nginx.conf` - Reverse proxy configuration
- `docker-compose.yml` - Single-service deployment (no PostgreSQL)
- `scripts/init-database.js` - Database initialization for external PostgreSQL
