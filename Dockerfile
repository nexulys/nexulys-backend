FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p logs public

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "server.js"]
