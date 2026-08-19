# Kurumera Marketplace — standalone Next.js container.
# Build:  docker build -t kurumera-marketplace .
# Run:    docker run -d --name kurumera-marketplace --restart unless-stopped \
#           --network website-builder_web -e PORT=4400 kurumera-marketplace

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public          # ensure it exists even if the app ships no static assets
# Build ONLY this app, not every workspace.
#
# `npm run build` at the root compiles the whole monorepo, so the marketplace
# image was being blocked by an unrelated package: @kurumera/base-theme fails to
# resolve @kurumera/editable (added after this image was last built), and its
# failure aborted the marketplace build with it. The marketplace has no
# workspace dependencies — next/react/react-dom only — so it builds alone, and
# a broken sibling theme can no longer stop the storefront shipping.
RUN npm run build -w @kurumera/marketplace

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4400
ENV HOSTNAME=0.0.0.0
# Standalone output: server.js + minimal node_modules, plus static assets.
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 4400
CMD ["node", "server.js"]
