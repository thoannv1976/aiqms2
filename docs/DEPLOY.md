# Hướng dẫn Deploy — Hệ thống Kiểm định CTĐT (AUN-QA)

> Mục tiêu: deploy app lên **Google Cloud Run + Cloud SQL (PostgreSQL)** (đúng định
> hướng `docs/HUONG_DAN_XAY_DUNG_APP_KIEM_DINH.md` mục 11). Toàn bộ lệnh chạy trong
> **Cloud Shell**. File này đủ chi tiết để giao cho người khác (hoặc Claude for Chrome)
> thực thi tuần tự.

## 0. Kiến trúc deploy

```
Người dùng ──HTTPS──> Cloud Run (container Next.js 16, 1 service)
                          │  (migrate deploy chạy tự động lúc khởi động)
                          └──Unix socket /cloudsql──> Cloud SQL PostgreSQL 16
File minh chứng/báo cáo: STORAGE_DRIVER=local (TẠM, mất khi restart) → prod nên dùng GCS/S3
```

- **DB**: PostgreSQL (KHÔNG SQLite). Migration chạy tự động trong `docker-entrypoint.sh`.
- **Bí mật**: `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY` để trong **Secret Manager**.
- **Container**: dùng `Dockerfile` trong repo (Cloud Build tự build khi `--source .`).

## 1. Chuẩn bị (chạy 1 lần)

```bash
# Lấy mã nguồn mới nhất (đã có Dockerfile + entrypoint)
cd ~ && git clone -b claude/magical-dirac-pUhEy https://github.com/thoannv1976/aiqms2.git || \
  (cd ~/aiqms2 && git fetch origin claude/magical-dirac-pUhEy && git checkout claude/magical-dirac-pUhEy && git pull)
cd ~/aiqms2

# Cấu hình project + region
export PROJECT_ID=aiqms2
export REGION=asia-southeast1
export SERVICE=aiqms2
export SQL_INSTANCE=aiqms-pg
export DB_NAME=aiqms
export DB_USER=aiqms
gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION

# Bật các API cần dùng
gcloud services enable run.googleapis.com sqladmin.googleapis.com \
  cloudbuild.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com
```

## 2. Tạo Cloud SQL PostgreSQL

```bash
# Tạo instance (db-f1-micro cho demo; nâng cấp khi cần)
gcloud sql instances create $SQL_INSTANCE \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=$REGION \
  --storage-size=10GB

# Tạo database + user
export DB_PASSWORD="$(openssl rand -base64 24)"
gcloud sql databases create $DB_NAME --instance=$SQL_INSTANCE
gcloud sql users create $DB_USER --instance=$SQL_INSTANCE --password="$DB_PASSWORD"

# Lấy connection name dạng PROJECT:REGION:INSTANCE
export SQL_CONN="$(gcloud sql instances describe $SQL_INSTANCE --format='value(connectionName)')"
echo "SQL_CONN=$SQL_CONN"
```

## 3. Tạo bí mật trong Secret Manager

```bash
# DATABASE_URL: kết nối Cloud SQL qua Unix socket (Cloud Run mount tại /cloudsql)
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost/${DB_NAME}?host=/cloudsql/${SQL_CONN}&schema=public"

# JWT_SECRET (>=32 ký tự) và ENCRYPTION_KEY (đúng 32 byte, base64)
export JWT_SECRET="$(openssl rand -base64 48)"
export ENCRYPTION_KEY="$(openssl rand -base64 32)"   # 32 byte

printf "%s" "$DATABASE_URL"  | gcloud secrets create aiqms-database-url   --data-file=- 2>/dev/null || printf "%s" "$DATABASE_URL"  | gcloud secrets versions add aiqms-database-url   --data-file=-
printf "%s" "$JWT_SECRET"    | gcloud secrets create aiqms-jwt-secret     --data-file=- 2>/dev/null || printf "%s" "$JWT_SECRET"    | gcloud secrets versions add aiqms-jwt-secret     --data-file=-
printf "%s" "$ENCRYPTION_KEY"| gcloud secrets create aiqms-encryption-key --data-file=- 2>/dev/null || printf "%s" "$ENCRYPTION_KEY"| gcloud secrets versions add aiqms-encryption-key --data-file=-

# Cho phép service account của Cloud Run đọc secret
export PROJECT_NUMBER="$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')"
export RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for S in aiqms-database-url aiqms-jwt-secret aiqms-encryption-key; do
  gcloud secrets add-iam-policy-binding $S \
    --member="serviceAccount:${RUN_SA}" --role="roles/secretmanager.secretAccessor"
done
```

> ⚠️ **Ghi lại mật khẩu DB** (`$DB_PASSWORD`) ở nơi an toàn — sẽ cần nếu phải dựng lại DATABASE_URL.

## 4. Deploy lên Cloud Run (lần đầu — có seed)

`--set-env-vars RUN_SEED=true` để entrypoint chạy seed (roles, AUN-QA, MOET, super-admin)
ở **lần deploy đầu**. Migration luôn tự chạy.

```bash
gcloud run deploy $SERVICE \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances "$SQL_CONN" \
  --cpu 1 --memory 1Gi --min-instances 0 --max-instances 4 --timeout 300 \
  --set-secrets "DATABASE_URL=aiqms-database-url:latest,JWT_SECRET=aiqms-jwt-secret:latest,ENCRYPTION_KEY=aiqms-encryption-key:latest" \
  --set-env-vars "NODE_ENV=production,JOB_MODE=inline,STORAGE_DRIVER=local,RLS_ENABLED=false,AI_ENABLED=false,DEFAULT_TENANT_SLUG=demo,RUN_SEED=true,CORS_ORIGIN_REGEX=^https://[a-z0-9-]+\.run\.app$"
```

Lấy URL service:

```bash
export URL="$(gcloud run services describe $SERVICE --region $REGION --format='value(status.url)')"
echo "URL=$URL"
```

## 5. Tắt seed cho các lần deploy sau

Sau khi seed xong, đặt `RUN_SEED=false` để không seed lại mỗi lần khởi động:

```bash
gcloud run services update $SERVICE --region $REGION --update-env-vars RUN_SEED=false
```

## 6. Kiểm tra hoạt động

```bash
# Health: phải trả {"status":"ok","db":"up",...}
curl -s "$URL/api/health"; echo

# Đăng nhập tenant demo (BẮT BUỘC kèm tenant: header X-Tenant hoặc ?tenant=demo)
curl -s -X POST "$URL/api/auth/login" \
  -H "Content-Type: application/json" -H "X-Tenant: demo" \
  -d '{"email":"admin@demo.local","password":"Demo1234!"}'; echo
# Kỳ vọng: {"user":{...,"roles":["qa_office"]}}
```

> **Vì sao gọi `/api/auth/login` trần lại lỗi?** App là multi-tenant: phải xác định
> tenant qua **header `X-Tenant: demo`**, query **`?tenant=demo`**, hoặc subdomain
> `demo.<domain>`. Đã đặt `DEFAULT_TENANT_SLUG=demo` nên request không kèm tenant sẽ
> mặc định về `demo`.

Tài khoản seed mặc định (ĐỔI NGAY ở prod):
- Super-admin (tenant `system`): `superadmin@aiqms.local` / `ChangeMe123!`
- Admin trường demo (tenant `demo`): `admin@demo.local` / `Demo1234!`

## 7. Sau khi deploy — nên làm

- **Đổi mật khẩu seed**: đăng nhập super-admin → đổi mật khẩu, hoặc set env
  `SUPERADMIN_PASSWORD` / `DEMO_ADMIN_PASSWORD` trước khi seed.
- **File lưu trữ bền vững (QUAN TRỌNG)**: `STORAGE_DRIVER=local` là *ephemeral* (mất khi
  restart) → chuyển sang **GCS** theo **Mục 7b** bên dưới.
- **Bật AI** (tùy chọn): `--update-env-vars AI_ENABLED=true` + cấu hình khóa theo tenant
  qua `PUT /api/ai/settings` (khóa được mã hóa bằng `ENCRYPTION_KEY`).
- **Tên miền riêng + subdomain theo trường**: map custom domain vào Cloud Run, đặt
  `BASE_DOMAIN=<domain>` để phân giải tenant theo `<truong>.<domain>`.
- **pgvector** (cho RAG sau này): `gcloud sql ... ` chưa bật sẵn; khi cần chạy
  `CREATE EXTENSION vector;` trên DB.

## 7b. Lưu file bền vững bằng Google Cloud Storage (GCS) — KHUYẾN NGHỊ prod

`STORAGE_DRIVER=local` trên Cloud Run là **ephemeral**: minh chứng/báo cáo upload lên sẽ
**mất khi container restart hoặc scale**. Chuyển sang **GCS** (lớp Storage của app hỗ trợ
sẵn qua giao thức S3-compatible — đã cài `@aws-sdk/client-s3`). Chỉ cần đổi cấu hình env,
KHÔNG sửa code.

```bash
# 1) Tạo bucket (tên toàn cục duy nhất)
export BUCKET="${PROJECT_ID}-evidence"
gcloud storage buckets create "gs://$BUCKET" --location=$REGION --uniform-bucket-level-access

# 2) Service account cho storage + quyền trên bucket
gcloud iam service-accounts create aiqms-storage --display-name="AIQMS storage" 2>/dev/null || true
export STORAGE_SA="aiqms-storage@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:${STORAGE_SA}" --role="roles/storage.objectAdmin"

# 3) Tạo HMAC key (interoperability) — IN RA accessId & secret, GHI LẠI
gcloud storage hmac create "$STORAGE_SA"
#   -> Access ID:  GOOG1E...   |   Secret: ************
export S3_ACCESS_KEY_ID="<DÁN Access ID>"
export S3_SECRET="<DÁN Secret>"

# 4) Cất HMAC secret vào Secret Manager + cấp quyền cho SA của Cloud Run
printf "%s" "$S3_SECRET" | gcloud secrets create aiqms-s3-secret --data-file=- 2>/dev/null \
  || printf "%s" "$S3_SECRET" | gcloud secrets versions add aiqms-s3-secret --data-file=-
gcloud secrets add-iam-policy-binding aiqms-s3-secret \
  --member="serviceAccount:${RUN_SA}" --role="roles/secretmanager.secretAccessor"

# 5) Bật driver S3 (GCS) cho Cloud Run rồi redeploy
gcloud run services update $SERVICE --region $REGION \
  --update-env-vars "STORAGE_DRIVER=s3,S3_ENDPOINT=https://storage.googleapis.com,S3_REGION=${REGION},S3_BUCKET=${BUCKET},S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}" \
  --update-secrets "S3_SECRET_ACCESS_KEY=aiqms-s3-secret:latest"
```

Từ giờ file upload (minh chứng, gói báo cáo) ghi thẳng vào `gs://$BUCKET/tenants/<tenantId>/…`
và **không mất khi restart**. URL tải về là link **presigned** do app sinh tự động.

> Ghi chú: app dùng giao thức S3 của GCS (path-style, endpoint `storage.googleapis.com`).
> Nếu muốn dùng AWS S3 / MinIO thật, chỉ cần đổi `S3_ENDPOINT`/`S3_REGION`/khóa tương ứng.

## 8. Cập nhật phiên bản (deploy lại)

```bash
cd ~/aiqms2 && git pull
gcloud run deploy $SERVICE --source . --region $REGION   # giữ nguyên env/secrets đã set
```

## 9. Xem log & sự cố

```bash
# Log realtime
gcloud run services logs tail $SERVICE --region $REGION

# Lỗi thường gặp:
#  - 500 /api/health: sai DATABASE_URL hoặc chưa --add-cloudsql-instances.
#  - 503 lúc khởi động: migrate/seed lâu -> tăng --timeout, --memory.
#  - 401 khi login: thiếu tenant -> thêm header X-Tenant: demo.
#  - "Cấu hình môi trường không hợp lệ": thiếu JWT_SECRET (>=32) / ENCRYPTION_KEY (32 byte base64).
```
