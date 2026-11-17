FROM node:22-alpine

WORKDIR /app

COPY packages/theme-schema ./packages/theme-schema
COPY backend/package*.json ./backend/

WORKDIR /app/backend
RUN npm ci --omit=dev

COPY backend/src ./src
RUN mkdir -p /app/backend/uploads && chown -R node:node /app

USER node
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/server.js"]
