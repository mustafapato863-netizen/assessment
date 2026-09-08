# Multi-stage Dockerfile for AssessFlow Frontend SPA
FROM node:20-alpine AS builder
RUN npm install -g pnpm@10.11.0
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Build arguments for frontend API URL
ARG VITE_API_URL=https://endrec.zainx.cloud/api/v1/assessflow
ARG VITE_FEATURE_CALIBRATION=true
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_FEATURE_CALIBRATION=$VITE_FEATURE_CALIBRATION

# Step 1: Dependencies stage
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/database/package.json packages/database/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile

# Step 2: Build contracts and web client
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY packages/database packages/database
COPY apps/web apps/web

RUN pnpm --filter @assessflow/contracts build
RUN pnpm --filter @assessflow/web build

# Step 3: Production web server
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
