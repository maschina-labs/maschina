# syntax=docker/dockerfile:1

# Build: install only what this service needs, compile it, then keep production dependencies.
FROM node:26.8-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @maschina/signer...
RUN pnpm --filter @maschina/signer build
# A flat node_modules, so the bundle can resolve every package its workspace code imports.
RUN pnpm --filter @maschina/signer deploy --legacy --prod --config.node-linker=hoisted /out

# Run: a small image, as an unprivileged user, with nothing but the build output.
FROM node:26.8-alpine
ARG SERVICE_VERSION=dev
ENV NODE_ENV=production
ENV SERVICE_VERSION=$SERVICE_VERSION
WORKDIR /app
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/services/signer/dist ./dist
USER node
EXPOSE 4200
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
	CMD wget -qO- http://127.0.0.1:4200/health || exit 1
CMD ["node", "--enable-source-maps", "dist/main.mjs"]
