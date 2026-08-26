# ==========================================
# Stage 1: Build Expo Web Bundle
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install project dependencies
RUN npm ci --legacy-peer-deps

# Copy application source code
COPY . .

# Export static web bundle
RUN npx expo export --platform web

# ==========================================
# Stage 2: High-Performance Nginx Web Server
# ==========================================
FROM nginx:alpine

# Copy custom Nginx configuration with SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy exported web assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Cloud Run dynamic port binding
EXPOSE 8080

CMD ["sh", "-c", "sed -i 's/8080/'\"$PORT\"'/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
