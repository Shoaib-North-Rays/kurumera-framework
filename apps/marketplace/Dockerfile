# Kurumera Marketplace — standalone Next.js container.
#
# Do not build or run this by hand. Use ops/run-marketplace.sh, which tags the
# image, carries the environment forward, verifies the new container is healthy
# and rolls back to the previous image if it is not.
#
# THE ORIGINS ARE BAKED AT BUILD TIME, NOT RUN TIME.
# next.config.mjs exposes them through Next's `env`, which is a DefinePlugin
# substitution: after `npm run build` they are literal strings in the emitted
# JS. An earlier version of this header told you to pass them with
# `docker run -e`, which does nothing at all — the image keeps whatever they
# resolved to during the build. They are build args now so the build and the
# run cannot disagree. Repointing at staging means rebuilding.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public          # ensure it exists even if the app ships no static assets

# Unset args become empty strings, which are falsy, so next.config.mjs falls
# back to its production defaults. Passing nothing is therefore safe.
ARG KURUMERA_MARKET_ORIGIN=""
ARG KURUMERA_AUTH_ORIGIN=""
ARG KURUMERA_BUILDER_ORIGIN=""
ENV KURUMERA_MARKET_ORIGIN=$KURUMERA_MARKET_ORIGIN \
    KURUMERA_AUTH_ORIGIN=$KURUMERA_AUTH_ORIGIN \
    KURUMERA_BUILDER_ORIGIN=$KURUMERA_BUILDER_ORIGIN
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
# PORT genuinely is runtime — server.js reads it. The origins above are not.
ENV PORT=4400
ENV HOSTNAME=0.0.0.0
# Standalone output: server.js + minimal node_modules, plus static assets.
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 4400
CMD ["node", "server.js"]
