FROM node:20-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Keep node_modules from deps because server runs TypeScript via tsx at runtime.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
COPY server.ts ./server.ts
COPY src ./src
COPY public ./public
COPY tsconfig.json ./tsconfig.json
COPY vite.config.ts ./vite.config.ts

EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]
