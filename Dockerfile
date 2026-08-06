FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
    EGG_SERVER_ENV=prod \
    PORT=7001 \
    HOME=/tmp \
    NODE_LOG_DIR=/tmp/egg-logs

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY app ./app
COPY app.js ./app.js
COPY config ./config
COPY README.md ./README.md

RUN mkdir -p /app/app/public /app/run /data \
    && useradd --system --uid 10001 --create-home appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 7001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:7001/health', res => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["npm", "start"]
