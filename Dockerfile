FROM node:22-alpine
WORKDIR /app
COPY . .
ENV PORT=3000
ENV STORAGE_DIR=/storage
RUN mkdir -p /storage
EXPOSE 3000
CMD ["node", "server.js"]
