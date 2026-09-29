FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=80 \
    HOMEPIBOARD_DATA_DIR=/app/data

WORKDIR /app

COPY package.json ./package.json
COPY --from=build /app/dist ./dist
COPY server.mjs ./server.mjs
COPY src ./src

RUN apk add --no-cache ffmpeg && mkdir -p /app/data && chown -R node:node /app

USER node
EXPOSE 80
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:80/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
