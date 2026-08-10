FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN chown -R node:node /app
ENV FORGEOS_PORT=8787
ENV HOST=0.0.0.0
EXPOSE 8787
USER node
CMD ["node", "scripts/docker-entrypoint.mjs"]
