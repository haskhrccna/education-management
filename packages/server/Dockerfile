FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

# Copy workspace manifests and source. mobile/package.json is COPYed because
# the root package.json declares mobile as a workspace: npm ci requires every
# workspace manifest to be present to resolve the tree (mobile's dependencies
# are NOT installed — the --workspace filters below exclude them).
COPY package*.json ./
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server
COPY mobile/package.json ./mobile/

# Install all dependencies (devDeps required for Prisma CLI + tsc).
# --ignore-scripts: the root postinstall patches the Expo podspec (iOS only)
# and is not needed for the server image.
RUN npm ci --ignore-scripts --workspace=@quran-review/server --workspace=@quran-review/shared

# Generate Prisma client and compile server
RUN cd packages/server && npx prisma generate
RUN npm run build --workspace=@quran-review/server

# Compile the shared package and point its entry at the JS. package.json keeps
# "main": "src/index.ts" for Metro, ts-node and jest, which read the source.
# Production node can't load that: it crashed on start with ERR_MODULE_NOT_FOUND
# for src/enums/roles. A failed compile must fail the build, not be swallowed.
RUN cd packages/shared && npx tsc --outDir dist --rootDir src && npm pkg set main=dist/index.js

# ─── Production dependencies ─────────────────────────────────────────────────
# Runtime deps only. The Prisma CLI is a runtime dependency of the server
# (see packages/server/package.json) because the container entrypoint runs
# `prisma migrate deploy` on every boot.
FROM node:22-alpine AS prod-deps
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY mobile/package.json ./mobile/

RUN npm ci --omit=dev --ignore-scripts --workspace=@quran-review/server --workspace=@quran-review/shared

# Prisma's generated client (default output: node_modules/.prisma/client).
# Generation needs the prisma CLI and the schema, both present only in the
# builder, so the generated client is overlaid onto the runtime deps. Both
# stages install @prisma/client from the same lockfile, so the versions match.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# ─── Production runner ────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Server compiled output
COPY --from=builder --chown=node:node /app/packages/server/dist ./dist
COPY --from=builder --chown=node:node /app/packages/server/prisma ./prisma
COPY --from=builder --chown=node:node /app/packages/server/assets ./assets
COPY --from=builder --chown=node:node /app/packages/server/package.json ./

# Shared package — workspace symlink in node_modules points here
COPY --from=builder --chown=node:node /app/packages/shared ./packages/shared

# Runtime node_modules (prod deps only, incl. Prisma client + CLI)
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
# npm nests the server's copies of deps whose versions clash with another
# workspace under packages/server/node_modules. dist/ runs from /app, so lay
# them over the root copy, or the API dies on start with "Cannot find module".
COPY --from=prod-deps --chown=node:node /app/packages/server/node_modules ./node_modules

# Mushaf page images (604 WebPs, ~51MB) are not in git and not baked into the
# image — mount them here (docker-compose does this) or point
# MUSHAF_PAGES_DIR at a persistent volume. src/server.ts refuses to start in
# production with an incomplete set, so a container with neither exits
# immediately unless ALLOW_MISSING_MUSHAF_PAGES=1 is set deliberately.
ENV MUSHAF_PAGES_DIR=/app/mushaf-pages
RUN mkdir -p /app/mushaf-pages && chown -R node:node /app

# Startup script: migrations, then the server (see the script for why this is
# not a platform "start command" string).
COPY --chown=node:node packages/server/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Non-root: the `node` user ships with the base image.
USER node

# Liveness for `docker ps` / orchestrators. The API applies migrations before
# listening, so the start-period covers the first boot of a fresh database.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

EXPOSE 4000

CMD ["./docker-entrypoint.sh"]
