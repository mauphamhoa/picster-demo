FROM node:20-slim
WORKDIR /app
COPY package.json ./
# sharp có thể cần build tools khi không có binary prebuilt
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install --omit=dev
COPY . .
ENV PORT=8080 NODE_ENV=production
EXPOSE 8080
CMD ["npm","start"]
