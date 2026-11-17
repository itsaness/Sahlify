FROM node:22-alpine

WORKDIR /app/storefront
COPY storefront/package*.json ./
RUN npm ci

COPY storefront/ ./
ENV NUXT_TELEMETRY_DISABLED=1
RUN npm run build && chown -R node:node /app

USER node
ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

CMD ["node", ".output/server/index.mjs"]
