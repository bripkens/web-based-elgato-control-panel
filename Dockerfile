FROM node:16.14.0-alpine

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

EXPOSE 8080

COPY . .

RUN npm ci

USER node

CMD ["node", "."]