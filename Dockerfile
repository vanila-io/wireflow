# Self-hosted alternative to Cloudflare: build the Next.js app and run `next start`.
FROM node:24-alpine
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
USER node
CMD ["node_modules/.bin/next", "start"]
