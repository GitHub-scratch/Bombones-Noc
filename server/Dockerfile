FROM node:20-slim

WORKDIR /app

# Instalar dependencias de compilación para sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --prefer-offline

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
