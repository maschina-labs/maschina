# syntax=docker/dockerfile:1

# Build: install only what this service needs, compile it, then keep production dependencies.
FROM node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @maschina/daemon...
RUN pnpm --filter @maschina/daemon build
# A flat node_modules, so the bundle can resolve every package its workspace code imports.
RUN pnpm --filter @maschina/daemon deploy --legacy --prod --config.node-linker=hoisted /out

# Run: a small image, as an unprivileged user, with nothing but the build output.
FROM node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f
ARG SERVICE_VERSION=dev
ENV NODE_ENV=production
ENV SERVICE_VERSION=$SERVICE_VERSION
WORKDIR /app
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/services/daemon/dist ./dist
# A fresh volume takes this directory's ownership, so it exists here and belongs to the node user.
RUN mkdir -p /home/node/.maschina && chown node:node /home/node/.maschina && chmod 700 /home/node/.maschina

USER node
CMD ["node", "--enable-source-maps", "dist/main.mjs"]
