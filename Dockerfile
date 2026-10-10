# Wireflow as a Node.js server (README "Docker"). The Cloudflare deploy is a
# separate path (OpenNext, wrangler.jsonc); both build the same app.
#
#   docker compose up -d --build      # http://localhost:8083
#
# Settings that are read at build time (the pages are prerendered) are build
# args; see .env.example. Unset, the site loads no analytics.

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_RYBBIT_SRC
ARG NEXT_PUBLIC_RYBBIT_SITE_ID
ARG CLOUDFLARE_WEB_ANALYTICS
ARG BLOG_ORIGIN
ARG NEXT_PUBLIC_OFFLINE
# next build (output: "standalone", see next.config.ts), then public/sw.js.
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# The standalone server plus what it doesn't copy by itself: the static
# chunks and public/ (with the offline worker written after next build).
# Owned by the unprivileged user, so the ISR cache in .next/cache is writable.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
