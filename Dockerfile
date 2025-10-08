# Multi-stage Dockerfile for Allegro Component Library
# Builds both frontend and backend in a single container

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client

COPY client/package*.json ./

RUN npm ci

COPY client/ .

# Build the React app
RUN npm run build

# Stage 2: Build Backend and Final Image
FROM node:20-alpine

WORKDIR /app

# Install bash for our startup script
RUN apk add --no-cache bash nginx

# Copy backend dependencies and install
COPY server/package*.json ./server/

WORKDIR /app/server

RUN npm ci --only=production

# Copy backend source code
COPY server/ .

# Copy built frontend to nginx html directory
COPY --from=frontend-builder /app/client/dist /usr/share/nginx/html

# Configure nginx
COPY nginx.conf /etc/nginx/http.d/default.conf

# Create directories for downloads
RUN mkdir -p /app/downloads/footprints

# Copy startup script
COPY startup.sh /app/startup.sh
RUN chmod +x /app/startup.sh

# Expose ports
EXPOSE 80 3001

# Set working directory back to /app
WORKDIR /app

# Use our startup script as entrypoint
ENTRYPOINT ["/app/startup.sh"]
