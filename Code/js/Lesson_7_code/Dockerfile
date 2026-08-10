# Build & production runtime image for Node.js Bookmarks API
FROM node:22-alpine

WORKDIR /app

# Layer 1: manifest + lockfile only, so this layer caches until a dependency changes.
# Runs as root: node_modules stays root-owned and the app user cannot rewrite its own deps.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Layer 2: application code
COPY . .

# Drop privileges only after the install and the copy are done.
USER node

ENV PORT=8000
ENV NODE_ENV=production

EXPOSE 8000

# Exec form CMD for signal handling (SIGTERM -> graceful shutdown)
CMD ["node", "server.js"]
