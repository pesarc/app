# Portable image for the Pesarc web app (Next.js 15 standalone, pnpm workspace).
# Builds and runs identically under Docker or Podman on any host (DO Droplet,
# Fly, k8s, …). NEXT_PUBLIC_* are inlined at build from a BuildKit secret so no
# secret is baked into a layer; server-only env is supplied at runtime.
#
#   docker build --secret id=dotenv,src=.env -t pesarc-web .
#   podman build --secret id=dotenv,src=.env -t pesarc-web .
#   podman run --env-file .env -p 3000:3000 pesarc-web
#
# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22

# ---- build: install the workspace and compile @pesarc/web to standalone ----
# Install + build in one stage: copying node_modules across stages makes pnpm
# re-resolve and re-download, so we keep them together and lean on the pnpm store
# cache mount to make repeat builds fast.
FROM node:${NODE_VERSION}-slim AS build
RUN corepack enable
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Manifests first so the install layer caches until dependencies change.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/abi/package.json packages/abi/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
# The root .env is mounted only for this step so NEXT_PUBLIC_* inline into the
# client bundle; it is never written to a layer. Server secrets are read at run.
RUN --mount=type=secret,id=dotenv,target=/app/.env \
    pnpm --filter @pesarc/web build

# ---- runner: minimal image, non-root ----
FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs
# Standalone server + its traced node_modules, plus static assets and public/.
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
# server.js is emitted at the traced path for the workspace app.
CMD ["node", "apps/web/server.js"]
