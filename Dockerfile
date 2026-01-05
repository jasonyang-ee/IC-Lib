# Multi-stage Dockerfile for Allegro Component Library
# Builds both frontend and backend in a single container

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

# Stage 2: Build Backend and Final Image
FROM node:22-alpine

WORKDIR /app
COPY database/ ./database/

# Install bash for our startup script and nginx for frontend
RUN apk add --no-cache bash nginx wget

# Copy backend source code
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --prefer-offline --no-audit
COPY server/ .
 
# Copy built frontend to nginx html directory
COPY --from=frontend-builder /app/client/dist /usr/share/nginx/html

# Configure nginx
COPY nginx.conf /etc/nginx/http.d/default.conf

# Create directories for downloads
RUN mkdir -p /app/download/footprint /app/download/symbol /app/download/pad

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
