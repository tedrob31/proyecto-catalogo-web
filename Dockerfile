FROM node:20-alpine AS base
RUN apk add --no-cache openssl

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Next.js telemetry is disabled
ENV NEXT_TELEMETRY_DISABLED 1

# Set a dummy database URL for build time pre-rendering
ENV DATABASE_URL="file:./dummy.db"
RUN npx prisma db push --skip-generate

# Build the project
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set the correct permission for prerender cache
RUN mkdir .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copiar base de datos de plantilla y el entrypoint
COPY --from=builder /app/dummy.db ./dummy.db
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["./entrypoint.sh"]
