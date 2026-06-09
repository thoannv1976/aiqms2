#!/bin/sh
set -e

# Áp migration (idempotent, có advisory lock — an toàn khi nhiều instance).
echo "[entrypoint] prisma migrate deploy..."
npx prisma migrate deploy

# Seed CHỈ khi RUN_SEED=true (lần deploy đầu). Seed idempotent nên chạy lại an toàn,
# nhưng để tránh tốn thời gian cold-start, mặc định tắt.
if [ "$RUN_SEED" = "true" ]; then
  echo "[entrypoint] seeding (roles, AUN-QA, MOET, super-admin)..."
  npm run db:seed || echo "[entrypoint] CẢNH BÁO: seed lỗi, tiếp tục khởi động."
fi

# Cloud Run cấp PORT (mặc định 8080). next start bind 0.0.0.0:$PORT.
echo "[entrypoint] khởi động Next.js trên cổng ${PORT:-8080}..."
exec npm run start -- -p "${PORT:-8080}"
