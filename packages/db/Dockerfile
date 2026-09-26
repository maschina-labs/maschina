# syntax=docker/dockerfile:1

# The migrations, as an image, so a release carries its own schema.
#
# Nothing on the server has the repository, and migrations are a pair: the SQL files and the journal that
# records which ones have run. Shipping them with the release is what makes "the box runs what the
# release says it runs" true of the database as well as the code.
#
# It runs once and exits. It is never left running, and it holds no port.
FROM node:24.21.0-alpine@sha256:be80f76cf40ec8e42b9bec49f60a55e0660f30af58d3e5a25530785b30ea67e2 AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @maschina/db...
RUN pnpm --filter @maschina/db build
RUN pnpm --filter @maschina/db deploy --legacy --prod --config.node-linker=hoisted /out

FROM node:24.21.0-alpine@sha256:be80f76cf40ec8e42b9bec49f60a55e0660f30af58d3e5a25530785b30ea67e2
ARG SERVICE_VERSION=dev
ENV NODE_ENV=production
ENV SERVICE_VERSION=$SERVICE_VERSION
WORKDIR /app
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/packages/db/dist ./dist
# The SQL files themselves, which are what actually gets applied. The bundle looks for them one level
# up from itself, the same as it does from source.
COPY --from=build --chown=node:node /repo/packages/db/migrations ./migrations
USER node
CMD ["node", "--enable-source-maps", "dist/migrate.mjs"]
