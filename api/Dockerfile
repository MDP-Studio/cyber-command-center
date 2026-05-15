FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY api ./api

EXPOSE 8080
CMD ["node", "api/server.js"]
