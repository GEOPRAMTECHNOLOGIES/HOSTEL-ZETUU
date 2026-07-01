# ---------- deps ----------
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------- runtime ----------
FROM node:18-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Run as a non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S hostelizetu -u 1001

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN chown -R hostelizetu:nodejs /app
USER hostelizetu

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 5000) + '/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
