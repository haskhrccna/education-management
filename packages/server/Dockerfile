FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

# Copy workspace manifests and source
COPY package*.json ./
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

# Install all dependencies (devDeps required for Prisma CLI + tsc)
RUN npm ci --workspace=@quran-review/server --workspace=@quran-review/shared

# Generate Prisma client and compile server
RUN cd packages/server && npx prisma generate
RUN npm run build --workspace=@quran-review/server

# Compile shared package so runner gets JS (not raw TS source)
RUN cd packages/shared && npx tsc --outDir dist --rootDir src 2>/dev/null || true

# ─── Production runner ────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Server compiled output
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/prisma ./prisma
COPY --from=builder /app/packages/server/package.json ./

# Shared package — workspace symlink in node_modules points here
COPY --from=builder /app/packages/shared ./packages/shared

# Production node_modules (includes Prisma client + @quran-review/shared symlink)
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000

# Run Prisma migrations then start the compiled server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
