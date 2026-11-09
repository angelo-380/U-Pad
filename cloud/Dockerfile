# ==============================================================================
# Dockerfile for U-Pad Core Cloud Backend
# Target Platform: Google Cloud Run / Google Kubernetes Engine / Compute Engine
# Language: Node.js 22 LTS (Alpine Linux)
# ==============================================================================

FROM node:22-alpine

LABEL maintainer="UPad Cloud Infrastructure Team"
LABEL description="U-Pad Relational Cloud Backend for Autism Visual Schedules & Realtime GPS Tracking"

WORKDIR /usr/src/app

# Copy application sources
COPY schema.sql ./
COPY server.js ./

# Set Environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/usr/src/app/upad_relational.db

# Expose HTTP port for Google Cloud Run
EXPOSE 8080

# Healthcheck configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/api/v1/health || exit 1

# Start production server
CMD ["node", "server.js"]
