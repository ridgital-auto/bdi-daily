# BDI Daily Quran & Hadis - Cloud Run deployment
FROM node:22-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps || npm install

# Copy source and build frontend
COPY . .
RUN npm run build

# Cloud Run sets PORT env var; server listens on 0.0.0.0
ENV NODE_ENV=production

# Run with tsx (TypeScript runtime)
CMD ["npx", "tsx", "server.ts"]
