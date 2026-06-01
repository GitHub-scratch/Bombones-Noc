FROM node:20-bullseye

WORKDIR /app

# Instalar dependencias de compilación para sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Compilar sqlite3 desde fuente
RUN npm_config_build_from_source=true npm ci

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
