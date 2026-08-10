# Build & production runtime image for Node.js Bookmarks API
FROM node:22-alpine

WORKDIR /app

# Non-root app user
USER node

# Layer 1: Copy package files and install dependencies
COPY --chown=node:node package*.json ./
RUN npm ci --only=production

# Layer 2: Copy application code
COPY --chown=node:node . .

ENV PORT=8000
ENV NODE_ENV=production

EXPOSE 8000

# Exec form CMD for signal handling (SIGTERM -> graceful shutdown)
CMD ["node", "server.js"]
