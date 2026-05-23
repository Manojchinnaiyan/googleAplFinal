# Build context: REPO ROOT, so we can reuse the monorepo .gcloudignore.
# Example: gcloud builds submit --config web/cloudbuild.yaml .
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY web/package.json web/pnpm-lock.yaml web/.npmrc ./
# pnpm 11+ enforces a 24h release-age policy on transitive deps. Two of ours
# (baseline-browser-mapping, enhanced-resolve) shipped <24h before the
# hackathon build, so disable the policy for this install only.
ENV npm_config_minimum_release_age=0
RUN pnpm install --frozen-lockfile --prod=false

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY web/ ./
# Disable Next.js telemetry during build for a cleaner log.
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0

# Standalone output bundles its own minimal node_modules.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 8080
CMD ["node", "server.js"]
