FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++

# Dependencies
FROM base AS deps
COPY package.json ./
RUN npm install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

RUN mkdir -p logs
EXPOSE 4000
CMD ["node", "dist/index.js"]
