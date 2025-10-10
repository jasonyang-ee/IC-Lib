# Multi-stage Dockerfile for Allegro Component Library
# Builds both frontend and backend in a single container

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client

# Copy package.json
COPY client/package.json ./

# Install dependencies (generates package-lock.json)
RUN npm install --prefer-offline --no-audit

# Copy all client source code
COPY client/ .

# Build the React app
RUN npm run build

# Stage 2: Build Backend and Final Image
FROM node:20-alpine

WORKDIR /app

# Install bash for our startup script and nginx for frontend
RUN apk add --no-cache bash nginx wget

# Copy backend package.json
COPY server/package.json ./server/

WORKDIR /app/server

# Install production dependencies (generates package-lock.json)
RUN npm install --omit=dev --prefer-offline --no-audit

# Copy backend source code
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
