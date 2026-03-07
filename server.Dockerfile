# --- Stage 1: Build the TypeScript server ---
FROM node:20-alpine AS builder
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

COPY server/ ./
RUN npm run build


# --- Stage 2: Production image ---
FROM node:20-alpine AS production
WORKDIR /app/server

# Install Docker CLI so the server can manage execution containers
RUN apk add --no-cache docker-cli

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only (includes autocannon for load tests)
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy compiled server from builder
COPY --from=builder /app/server/dist ./dist

# Copy test runner scripts (used by admin dashboard load tests)
COPY server/tests/ ./tests/

# Copy cleanup script and ensure it is executable
COPY scripts/cleanup.sh ../cleanup.sh
RUN chmod +x ../cleanup.sh

EXPOSE 3000

CMD ["node", "dist/index.js"]
