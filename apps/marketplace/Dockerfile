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
RUN npm run build

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
