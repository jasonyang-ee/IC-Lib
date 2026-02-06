# Multi-stage Dockerfile for Allegro Component Library
# Builds both frontend and backend in a single container
# Uses Debian (not Alpine) to support Wine64 for OrCAD OLB conversion

# Stage 1: Build Frontend
FROM node:22-alpine AS frontend-builder

# Accept build arguments for environment variables
ARG VITE_CONFIG_ECO=false

# Copy root package.json for version info (needed by vite.config.js)
WORKDIR /app
COPY package.json ./

# Copy all client source code
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --prefer-offline --no-audit
COPY client/ .

# Replace placeholder with actual build argument value in .env.production
RUN sed -i "s/__VITE_CONFIG_ECO__/${VITE_CONFIG_ECO}/g" .env.production

# Build the React app with the substituted environment variables
RUN npm run build

# Stage 2: Build Backend and Final Image (Debian for Wine64 support)
FROM node:22-bookworm-slim

WORKDIR /app
COPY database/ ./database/

# Install nginx, Wine64, and utilities
RUN dpkg --add-architecture amd64 && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      bash nginx wget procps wine64 && \
    rm -rf /var/lib/apt/lists/* && \
    # Initialize Wine prefix for OrCAD tclsh execution
    mkdir -p /tmp/wine-orcad && \
    WINEPREFIX=/tmp/wine-orcad WINEDEBUG=-all wine64 wineboot --init 2>/dev/null; \
    WINEPREFIX=/tmp/wine-orcad wineserver --wait 2>/dev/null || true

# Copy backend source code
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --prefer-offline --no-audit
COPY server/ .

# Copy built frontend to nginx html directory
COPY --from=frontend-builder /app/client/dist /usr/share/nginx/html

# Configure nginx (Debian uses sites-enabled, but conf.d also works)
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Remove the Debian default site config to avoid conflicts
RUN rm -f /etc/nginx/sites-enabled/default

# Create directories for CAD file library and OrCAD tools
RUN mkdir -p /app/library/footprint /app/library/symbol /app/library/pad \
             /app/library/pspice /app/library/model /app/orcad

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose only port 80 (nginx handles both frontend and API proxy)
EXPOSE 80

# Set working directory back to /app
WORKDIR /app

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# Use our startup script as entrypoint
ENTRYPOINT ["/app/start.sh"]
