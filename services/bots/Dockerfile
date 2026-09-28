# syntax=docker/dockerfile:1

# Build: install only what this service needs, compile it, then keep production dependencies.
FROM node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @maschina/bots...
RUN pnpm --filter @maschina/bots build
# A flat node_modules, so the bundle can resolve every package its workspace code imports.
RUN pnpm --filter @maschina/bots deploy --legacy --prod --config.node-linker=hoisted /out

# Run: a small image, as an unprivileged user, with nothing but the build output.
FROM node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
ARG SERVICE_VERSION=dev
ENV NODE_ENV=production
ENV SERVICE_VERSION=$SERVICE_VERSION
WORKDIR /app
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/services/bots/dist ./dist
USER node
EXPOSE 4300
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
	CMD wget -qO- http://127.0.0.1:4300/health || exit 1
CMD ["node", "--enable-source-maps", "dist/main.mjs"]
