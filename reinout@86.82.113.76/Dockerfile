# syntax=docker/dockerfile:1
ARG NODE_VERSION=22.19.0
FROM node:${NODE_VERSION}-alpine

WORKDIR /usr/src/api

ENV NODE_ENV=production

COPY package*.json ./
# Install dev dependencies for build, they are removed later via npm prune
RUN npm install --include=dev

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

RUN npm run prisma:generate \
 && npm run build \
 && npm prune --omit=dev

EXPOSE 4000

CMD ["node", "dist/server.js"]
