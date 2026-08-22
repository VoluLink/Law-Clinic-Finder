# Multi-stage build for the standalone Next.js server (see next.config.ts)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Public identifiers/origin needed while Next.js builds the standalone server.
# Credentials and SMTP/Anthropic secrets stay runtime-only.
ARG FIREBASE_PROJECT_ID=law-clinic-finder
ARG FIREBASE_STORAGE_BUCKET
ARG IDENTITY_PLATFORM_API_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID \
    FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET \
    IDENTITY_PLATFORM_API_KEY=$IDENTITY_PLATFORM_API_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
