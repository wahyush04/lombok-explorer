# ==========================================
# STAGE 1: Builder
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install native dependencies for Prisma and build tools
RUN apk add --no-cache openssl libc6-compat

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy source code and build
COPY tsconfig.json ./
COPY src ./src
COPY openapi.yaml ./
RUN npm run build
RUN npx prisma generate

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

# Install production dependencies only
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production

# Copy compiled artifacts from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY openapi.yaml ./

# Switch to non-root user
USER appuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/v1/health || exit 1

CMD ["node", "dist/server.js"]
