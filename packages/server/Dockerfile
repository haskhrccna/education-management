FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server
RUN npm ci --workspace=@edu/server --workspace=@edu/shared
RUN npm run build --workspace=@edu/server

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/server/prisma ./prisma
COPY --from=builder /app/packages/server/package.json ./
EXPOSE 4000
CMD ["node", "dist/server.js"]
