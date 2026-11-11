FROM node:22-alpine
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY src/ ./src/
COPY public_html/ ./public_html/
COPY upad_relational.db ./upad_relational.db

ENV NODE_ENV=production
ENV PORT=8080
ENV CORS_ORIGIN=*

EXPOSE 8080
CMD ["node", "src/server.js"]
