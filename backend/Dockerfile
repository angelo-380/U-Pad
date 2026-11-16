FROM node:22-alpine
WORKDIR /usr/src/app

# Litestream: replica la base SQLite a Cloud Storage (versión fija y checksum verificado)
ARG LITESTREAM_VERSION=0.5.18
ARG TARGETARCH
RUN set -eu; \
    case "${TARGETARCH:-amd64}" in \
      amd64) ARCH=x86_64; SHA=d3687b9fd0f2e9426bbd3da828429ff3f1dfc5c9b74d54fdf028e4ee510e7dea ;; \
      arm64) ARCH=arm64;  SHA=922a09e6a7ac67f2095571894dc6382e94e1dd4cdd9674883ddf1a8e74ab982d ;; \
      *) echo "Arquitectura no soportada: ${TARGETARCH}"; exit 1 ;; \
    esac; \
    wget -q -O /tmp/litestream.tar.gz "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-${LITESTREAM_VERSION}-linux-${ARCH}.tar.gz"; \
    echo "${SHA}  /tmp/litestream.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/litestream.tar.gz -C /usr/local/bin litestream; \
    rm /tmp/litestream.tar.gz; \
    litestream version

COPY package*.json ./
RUN npm install --omit=dev

COPY src/ ./src/
COPY public_html/ ./public_html/
COPY scripts/arranque.sh ./scripts/arranque.sh
COPY litestream.yml /etc/litestream.yml

# La base NO va dentro de la imagen: se restaura desde Cloud Storage al arrancar (ver scripts/arranque.sh)
ENV NODE_ENV=production
ENV PORT=8080
ENV CORS_ORIGIN=*
ENV DB_PATH=/data/upad_relational.db
RUN mkdir -p /data

EXPOSE 8080
CMD ["sh", "scripts/arranque.sh"]
