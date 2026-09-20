ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS web-build
ARG NPM_REGISTRY=https://registry.npmjs.org
WORKDIR /app
COPY --chmod=644 package.json package-lock.json ./
RUN npm ci --registry="$NPM_REGISTRY"
COPY tsconfig.json tsconfig.node.json vite.config.ts ./
COPY web ./web
COPY src ./src
RUN npm run build

FROM ${NODE_IMAGE}
ARG NPM_REGISTRY=https://registry.npmjs.org
WORKDIR /app
COPY --chmod=644 package.json package-lock.json ./
RUN npm ci --omit=dev --registry="$NPM_REGISTRY"
COPY --from=web-build /app/build ./build
COPY --from=web-build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
ENV HOST=0.0.0.0
ENV PORT=3300
EXPOSE 3300
USER node
ENTRYPOINT ["node"]
CMD ["build/server/index.js"]
