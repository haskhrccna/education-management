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
COPY --from=builder /app/packages/server/assets ./assets
COPY --from=builder /app/packages/server/package.json ./

# Shared package — workspace symlink in node_modules points here
COPY --from=builder /app/packages/shared ./packages/shared

# Production node_modules (includes Prisma client + @quran-review/shared symlink)
COPY --from=builder /app/node_modules ./node_modules

# Mushaf page images (604 WebPs, ~51MB) are not in git and not baked into the
# image — mount them here (docker-compose does this) or point
# MUSHAF_PAGES_DIR at a persistent volume. src/server.ts refuses to start in
# production with an incomplete set, so a container with neither exits
# immediately unless ALLOW_MISSING_MUSHAF_PAGES=1 is set deliberately.
ENV MUSHAF_PAGES_DIR=/app/mushaf-pages
RUN mkdir -p /app/mushaf-pages

# Startup script: migrations, then the server (see the script for why this is
# not a platform "start command" string).
COPY packages/server/docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 4000

CMD ["./docker-entrypoint.sh"]
