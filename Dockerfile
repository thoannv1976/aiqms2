# syntax=docker/dockerfile:1
# Image production cho Cloud Run (Next.js 16 + Prisma 7 + Postgres).
# Một stage cho đơn giản & tin cậy: giữ đủ deps để chạy `prisma migrate deploy`
# và seed (tsx) lúc khởi động.
FROM node:22-slim

# openssl + ca-certificates cho Prisma engine và kết nối TLS tới Cloud SQL.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# 1) Cài deps trước (cache tốt). postinstall chạy `prisma generate`.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# 2) Copy mã nguồn và build.
COPY . .
# Biến môi trường GIẢ chỉ dùng cho lúc build (qua được Zod validate ở src/config/env.ts).
# Runtime dùng giá trị THẬT do Cloud Run cung cấp — các biến này KHÔNG được giữ lại.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    JWT_SECRET="build-only-placeholder-secret-needs-32chars!!" \
    ENCRYPTION_KEY="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=" \
    npm run build

# 3) Entrypoint: chạy migrate (+ seed nếu RUN_SEED=true) rồi khởi động server.
COPY docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
