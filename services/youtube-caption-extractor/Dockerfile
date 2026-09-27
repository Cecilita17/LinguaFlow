FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY services/youtube-caption-extractor ./services/youtube-caption-extractor

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "services/youtube-caption-extractor/index.js"]
