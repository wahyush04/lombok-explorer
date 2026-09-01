# ==========================================
# STAGE 1: Builder
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install native dependencies for Prisma and native module build tools (bcrypt, etc.)
RUN apk add --no-cache openssl libc6-compat python3 make g++

# Configure npm timeouts for reliable network installation
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy source code and build
COPY tsconfig.json ./
COPY src ./src
COPY openapi*.yaml ./
RUN npm run build
RUN npx prisma generate

# Remove devDependencies to optimize production footprint
RUN npm prune --omit=dev

# ==========================================
# STAGE 2: Runner
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Install OpenSSL for Prisma client runtime
RUN apk add --no-cache openssl libc6-compat

# Create non-root user and group for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create assets/image storage directory with proper permissions
RUN mkdir -p /app/assets/image && chown -R appuser:appgroup /app/assets

# Copy production node_modules, compiled artifacts, and Prisma client from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY openapi*.yaml ./

# Switch to non-root user
USER appuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1

CMD ["node", "dist/server.js"]
