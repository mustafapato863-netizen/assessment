# Multi-stage Dockerfile for AssessFlow Background Worker
FROM node:20-alpine AS base
RUN npm install -g pnpm@10.11.0
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Step 1: Dependencies stage
FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/database/package.json packages/database/
COPY apps/worker/package.json apps/worker/

RUN pnpm install --frozen-lockfile

# Step 2: Build contracts, prisma, and worker
FROM dependencies AS builder
COPY packages/contracts packages/contracts
COPY packages/database packages/database
COPY apps/worker apps/worker

RUN pnpm --filter @assessflow/contracts build
RUN pnpm --filter @assessflow/database build
RUN pnpm --filter @assessflow/worker build

# Step 3: Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/database/package.json packages/database/
COPY apps/worker/package.json apps/worker/

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=dependencies /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=dependencies /app/apps/worker/node_modules ./apps/worker/node_modules

COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/packages/database/generated ./packages/database/generated
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist

CMD ["node", "apps/worker/dist/main.js"]
