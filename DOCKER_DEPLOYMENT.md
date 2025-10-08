# Docker Deployment Guide

## Overview

The Allegro Component Library now uses a **unified Docker deployment** with both frontend and backend running in a single container. This simplifies deployment and reduces resource usage.

## Architecture

```
┌─────────────────────────────────────────────┐
│         Docker Container (allegro-web)      │
│                                             │
│  ┌────────────┐      ┌──────────────────┐  │
│  │   Nginx    │──────│  Express.js API  │  │
│  │  (Port 80) │      │   (Port 3001)    │  │
│  └────────────┘      └──────────────────┘  │
│       │                                     │
│   Static Files                              │
│   (React App)                               │
└─────────────────────────────────────────────┘
                  │
                  ▼
        External PostgreSQL
     (infra.main.local:5435)
```

## What Changed

### Before (3 Services)
- ❌ Separate frontend container
- ❌ Separate backend container  
- ❌ PostgreSQL container (now external)

### After (1 Service)
- ✅ Single unified container with both frontend and backend
- ✅ Uses your existing PostgreSQL at `infra.main.local:5435`
- ✅ Nginx serves frontend and proxies API to backend
- ✅ Simplified deployment and maintenance

## Quick Start

### Prerequisites

1. **Database must be initialized first:**
   ```bash
   cd scripts
   npm run init-db
   ```

2. **Update database connection in docker-compose.yml:**
   ```yaml
   environment:
     - DB_HOST=infra.main.local  # Your PostgreSQL host
     - DB_PORT=5435              # Your PostgreSQL port
     - DB_USER=sami
     - DB_PASSWORD=123456
     - DB_NAME=cip
   ```

### Deploy

```bash
# Build and start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

### Access

- **Frontend**: http://localhost
- **API**: http://localhost:3001/api (also accessible via nginx at http://localhost/api)
- **Health Check**: http://localhost/health

## Files

### New Files

1. **`Dockerfile`** (root directory)
   - Multi-stage build for both frontend and backend
   - Installs nginx and Node.js in single image
   - Copies startup script

2. **`startup.sh`** (root directory)
   - Starts nginx and Express.js in parallel
   - Waits for database connection
   - Gracefully handles shutdown
   - Monitors both processes

3. **`nginx.conf`** (root directory)
   - Serves React frontend from `/`
   - Proxies API requests to backend
   - Configures caching and compression
   - Security headers

4. **`.dockerignore`**
   - Excludes unnecessary files from build
   - Reduces image size

### Modified Files

1. **`docker-compose.yml`**
   - Removed `postgres` service (using external DB)
   - Removed `backend` service (merged into web)
   - Removed `frontend` service (merged into web)
   - Single `web` service with all functionality

2. **`docker-compose.dev.yml`**
   - Kept for local development (PostgreSQL only)
   - Use this if you want a local database for testing

## Environment Variables

Configure in `docker-compose.yml`:

### Required
```yaml
- DB_HOST=infra.main.local    # Your PostgreSQL host
- DB_PORT=5435                # Your PostgreSQL port
- DB_USER=sami                # Database user
- DB_PASSWORD=123456          # Database password
- DB_NAME=cip                 # Database name
```

### Optional
```yaml
- NODE_ENV=production
- PORT=3001
- CORS_ORIGIN=*
- DIGIKEY_CLIENT_ID=...
- DIGIKEY_CLIENT_SECRET=...
- MOUSER_API_KEY=...
- ULTRA_LIBRARIAN_TOKEN=...
- SNAPEDA_API_KEY=...
```

## Startup Process

When the container starts, `startup.sh` performs these steps:

1. **Validate Configuration**
   - Check required environment variables
   - Display configuration summary

2. **Wait for Database**
   - Test connection to PostgreSQL
   - Retry up to 30 times with 2-second intervals
   - Exit with error if database unavailable

3. **Start Services**
   - Start nginx (frontend) in background
   - Start Express.js (backend) in background
   - Monitor both processes

4. **Health Monitoring**
   - Both processes run in parallel
   - Container exits if either process fails
   - Graceful shutdown on SIGTERM/SIGINT

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs web

# Common issues:
# 1. Database not initialized
cd scripts && npm run init-db

# 2. Can't connect to database
# Check DB_HOST, DB_PORT in docker-compose.yml
# Verify network connectivity to infra.main.local:5435

# 3. Port already in use
# Change port mapping in docker-compose.yml:
ports:
  - "8080:80"  # Use 8080 instead of 80
```

### Database Connection Errors

```bash
# Test database connection from host
psql -h infra.main.local -p 5435 -U sami -d cip

# If that fails, check:
# 1. PostgreSQL is running
# 2. Firewall allows port 5435
# 3. Network can reach infra.main.local
# 4. Credentials are correct
```

### View Live Logs

```bash
# All logs
docker-compose logs -f web

# Last 100 lines
docker-compose logs --tail=100 web

# Only errors
docker-compose logs web 2>&1 | grep -i error
```

### Restart Services

```bash
# Restart container
docker-compose restart web

# Rebuild and restart
docker-compose up -d --build web

# Complete rebuild (no cache)
docker-compose build --no-cache web
docker-compose up -d web
```

### Access Container Shell

```bash
# Interactive shell
docker exec -it allegro-web sh

# Check processes
docker exec -it allegro-web ps aux

# Test backend health
docker exec -it allegro-web wget -qO- http://localhost:3001/health

# Check nginx config
docker exec -it allegro-web nginx -t
```

## Health Checks

The container includes a health check that tests the `/health` endpoint:

```bash
# Check container health status
docker ps

# View health check logs
docker inspect allegro-web | grep -A 10 Health
```

## Volumes

```yaml
volumes:
  footprint_downloads:/app/downloads/footprints
```

Footprint downloads are persisted in a named volume. To backup:

```bash
# List volumes
docker volume ls

# Backup volume
docker run --rm -v allegroSQL_footprint_downloads:/data -v $(pwd):/backup alpine tar czf /backup/footprints-backup.tar.gz /data

# Restore volume
docker run --rm -v allegroSQL_footprint_downloads:/data -v $(pwd):/backup alpine tar xzf /backup/footprints-backup.tar.gz -C /
```

## Production Deployment

### Option 1: Docker Compose (Recommended for single server)

```bash
# Clone repository
git clone <your-repo>
cd allegroSQL

# Configure database connection
nano docker-compose.yml  # Update DB_* variables

# Start
docker-compose up -d

# Setup HTTPS (optional)
# Use a reverse proxy like nginx or Traefik
```

### Option 2: Docker Standalone

```bash
# Build image
docker build -t allegro-web .

# Run container
docker run -d \
  --name allegro-web \
  -p 80:80 \
  -p 3001:3001 \
  -e DB_HOST=infra.main.local \
  -e DB_PORT=5435 \
  -e DB_USER=sami \
  -e DB_PASSWORD=123456 \
  -e DB_NAME=cip \
  -e NODE_ENV=production \
  -v footprint_downloads:/app/downloads/footprints \
  --restart unless-stopped \
  allegro-web
```

### Option 3: Kubernetes

See `k8s/` directory (coming soon) for Kubernetes manifests.

## Updates

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Verify
docker-compose logs -f web
```

## Rollback

```bash
# Stop current version
docker-compose down

# Checkout previous version
git checkout <previous-commit>

# Start previous version
docker-compose up -d
```

## Performance Tuning

### Nginx Worker Processes

Edit `nginx.conf` and rebuild:

```nginx
worker_processes auto;
worker_connections 1024;
```

### Node.js Memory

Update `docker-compose.yml`:

```yaml
environment:
  - NODE_OPTIONS=--max-old-space-size=2048
```

### Container Resources

Limit CPU and memory:

```yaml
services:
  web:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Security

### Use Docker Secrets (Production)

```bash
# Create secrets
echo "123456" | docker secret create db_password -

# Update docker-compose.yml
secrets:
  - db_password

environment:
  - DB_PASSWORD_FILE=/run/secrets/db_password
```

### Run as Non-Root

Update `Dockerfile`:

```dockerfile
RUN addgroup -g 1001 appuser && \
    adduser -D -u 1001 -G appuser appuser

USER appuser
```

## Monitoring

### Prometheus Metrics

Add to `docker-compose.yml`:

```yaml
ports:
  - "9090:9090"  # Prometheus metrics endpoint
```

### Health Check Endpoint

```bash
curl http://localhost/health

# Response:
{
  "status": "healthy",
  "timestamp": "2025-10-07T12:00:00Z",
  "database": "connected"
}
```

## Summary

- ✅ Single container deployment
- ✅ Frontend + Backend unified
- ✅ Uses external PostgreSQL
- ✅ Nginx reverse proxy
- ✅ Graceful shutdown
- ✅ Health checks
- ✅ Easy to deploy and maintain

For development, see `QUICKSTART.md`.
For API documentation, see `API.md`.
