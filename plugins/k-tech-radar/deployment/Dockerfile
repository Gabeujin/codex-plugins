FROM node:22-alpine

WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node config ./config
COPY --chown=node:node lib ./lib
COPY --chown=node:node mcp ./mcp
COPY --chown=node:node ontology ./ontology
COPY --chown=node:node scripts ./scripts

RUN mkdir -p /data && \
    node ./scripts/seed-public-data.mjs /data && \
    chown -R node:node /data

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    K_TECH_RADAR_MODE=public \
    K_TECH_RADAR_DATA_DIR=/data \
    K_TECH_RADAR_REQUIRE_AUTH=1

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then((r)=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "./mcp/http-server.mjs"]
