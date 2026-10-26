FROM node:22.22.1-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
COPY packages/types/package.json packages/types/package.json
RUN npm ci --ignore-scripts
COPY api api
COPY web web
COPY packages packages
RUN npm run prisma:generate -w api

FROM build AS api-build
RUN npm run build -w api

FROM node:22.22.1-alpine AS api
RUN apk add --no-cache openssl postgresql16-client
WORKDIR /app
COPY --from=api-build /app/node_modules ./node_modules
COPY --from=api-build --chown=node:node /app/api ./api
COPY --from=api-build --chown=node:node /app/packages ./packages
COPY --from=api-build /app/package.json ./package.json
RUN mkdir -p /app/api/uploads && chown node:node /app/api/uploads
USER node
WORKDIR /app/api
EXPOSE 4000
CMD ["node", "dist/server.js"]

FROM build AS web-build
ENV DEPLOY_TARGET=vps
ENV VITE_API_URL=""
ENV VITE_WS_URL=""
RUN npm run build -w web

FROM node:22.22.1-alpine AS web
WORKDIR /app
COPY --from=web-build --chown=node:node /app/web/.output ./
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
USER node
EXPOSE 3000
CMD ["node", "server/index.mjs"]
