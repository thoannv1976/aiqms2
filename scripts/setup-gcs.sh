#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AIQMS — Cấu hình Google Cloud Storage (GCS) cho Cloud Run
#
# Chạy trong Cloud Shell (https://shell.cloud.google.com) hoặc máy có gcloud:
#   bash scripts/setup-gcs.sh
#
# Script idempotent: chạy lại an toàn. Làm 5 việc:
#   1. Tạo bucket GCS (uniform access, chặn public)
#   2. Tạo service account aiqms-storage + cấp quyền objectAdmin trên bucket
#   3. Tạo HMAC key (giao thức S3-compatible của GCS)
#   4. Cất HMAC secret vào Secret Manager + cấp quyền đọc cho SA của Cloud Run
#   5. Set env cho Cloud Run: STORAGE_DRIVER=s3 + S3_* (tự tạo revision mới)
#
# Tuỳ biến qua biến môi trường trước khi chạy (đều có mặc định):
#   PROJECT_ID  (mặc định: project đang active của gcloud)
#   REGION      (mặc định: asia-southeast1)
#   SERVICE     (mặc định: aiqms2)
#   BUCKET      (mặc định: ${PROJECT_ID}-aiqms-evidence)
#   FORCE_NEW_KEY=1  -> ép tạo HMAC key mới kể cả khi đã cấu hình
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-asia-southeast1}"
SERVICE="${SERVICE:-aiqms2}"
BUCKET="${BUCKET:-${PROJECT_ID}-aiqms-evidence}"
SECRET_NAME="aiqms-s3-secret"
STORAGE_SA="aiqms-storage@${PROJECT_ID}.iam.gserviceaccount.com"

if [[ -z "$PROJECT_ID" ]]; then
  echo "✗ Chưa chọn project. Chạy: gcloud config set project <PROJECT_ID>" >&2
  exit 1
fi

echo "── Cấu hình ──────────────────────────────────────────"
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "  Service : $SERVICE"
echo "  Bucket  : gs://$BUCKET"
echo "──────────────────────────────────────────────────────"

# 0) Bật API cần thiết (no-op nếu đã bật)
gcloud services enable storage.googleapis.com secretmanager.googleapis.com \
  --project "$PROJECT_ID" --quiet

# 1) Bucket: uniform access + chặn public hoàn toàn
if gcloud storage buckets describe "gs://$BUCKET" --project "$PROJECT_ID" >/dev/null 2>&1; then
  echo "✓ Bucket gs://$BUCKET đã tồn tại — bỏ qua tạo mới"
else
  gcloud storage buckets create "gs://$BUCKET" \
    --project "$PROJECT_ID" --location "$REGION" \
    --uniform-bucket-level-access --public-access-prevention
  echo "✓ Đã tạo bucket gs://$BUCKET"
fi

# 2) Service account riêng cho storage + quyền trên ĐÚNG bucket này
gcloud iam service-accounts create aiqms-storage \
  --display-name "AIQMS storage (HMAC)" --project "$PROJECT_ID" 2>/dev/null \
  && echo "✓ Đã tạo service account $STORAGE_SA" \
  || echo "✓ Service account $STORAGE_SA đã tồn tại"

gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member "serviceAccount:${STORAGE_SA}" --role "roles/storage.objectAdmin" \
  --project "$PROJECT_ID" >/dev/null
echo "✓ Đã cấp roles/storage.objectAdmin trên bucket cho $STORAGE_SA"

# 3) HMAC key — chỉ tạo khi chưa cấu hình (secret + env đã có) hoặc FORCE_NEW_KEY=1
HAVE_SECRET=$(gcloud secrets describe "$SECRET_NAME" --project "$PROJECT_ID" >/dev/null 2>&1 && echo 1 || echo 0)
HAVE_ENV=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" \
  --format 'value(spec.template.spec.containers[0].env)' 2>/dev/null | grep -c S3_ACCESS_KEY_ID || true)

ACCESS_ID=""
if [[ "${FORCE_NEW_KEY:-0}" != "1" && "$HAVE_SECRET" == "1" && "$HAVE_ENV" != "0" ]]; then
  echo "✓ HMAC key + secret đã cấu hình từ trước — bỏ qua (đặt FORCE_NEW_KEY=1 nếu muốn tạo mới)"
else
  echo "… Tạo HMAC key cho $STORAGE_SA"
  HMAC_JSON=$(gcloud storage hmac create "$STORAGE_SA" --project "$PROJECT_ID" --format=json)
  ACCESS_ID=$(echo "$HMAC_JSON" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["metadata"]["accessId"])')
  SECRET_VAL=$(echo "$HMAC_JSON" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["secret"])')
  echo "✓ HMAC Access ID: $ACCESS_ID"

  # 4) Cất secret vào Secret Manager (tạo mới hoặc thêm version)
  if [[ "$HAVE_SECRET" == "1" ]]; then
    printf "%s" "$SECRET_VAL" | gcloud secrets versions add "$SECRET_NAME" --project "$PROJECT_ID" --data-file=-
  else
    printf "%s" "$SECRET_VAL" | gcloud secrets create "$SECRET_NAME" --project "$PROJECT_ID" --data-file=-
  fi
  echo "✓ Đã lưu HMAC secret vào Secret Manager ($SECRET_NAME)"
fi

# 4b) Cấp quyền đọc secret cho service account mà Cloud Run đang chạy
RUN_SA=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" \
  --format 'value(spec.template.spec.serviceAccountName)')
if [[ -z "$RUN_SA" ]]; then
  PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format 'value(projectNumber)')
  RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
fi
gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --member "serviceAccount:${RUN_SA}" --role "roles/secretmanager.secretAccessor" \
  --project "$PROJECT_ID" >/dev/null
echo "✓ Đã cấp quyền đọc secret cho SA của Cloud Run ($RUN_SA)"

# 5) Set env cho Cloud Run (tự tạo revision mới — không cần redeploy thủ công)
ENV_VARS="STORAGE_DRIVER=s3,S3_ENDPOINT=https://storage.googleapis.com,S3_REGION=${REGION},S3_BUCKET=${BUCKET}"
if [[ -n "$ACCESS_ID" ]]; then
  ENV_VARS="${ENV_VARS},S3_ACCESS_KEY_ID=${ACCESS_ID}"
fi
gcloud run services update "$SERVICE" --region "$REGION" --project "$PROJECT_ID" \
  --update-env-vars "$ENV_VARS" \
  --update-secrets "S3_SECRET_ACCESS_KEY=${SECRET_NAME}:latest" >/dev/null
echo "✓ Đã cập nhật env cho Cloud Run service '$SERVICE' (revision mới đang triển khai)"

echo
echo "── HOÀN TẤT ──────────────────────────────────────────"
echo "Kiểm tra nhanh:"
echo "  1. Mở app → Minh chứng → upload một file."
echo "  2. Liệt kê file trong bucket:"
echo "       gcloud storage ls -r gs://$BUCKET/tenants/ | head"
echo "File giờ lưu VĨNH VIỄN trên GCS (gs://$BUCKET/tenants/<tenantId>/…),"
echo "không mất khi container restart. Link tải về là presigned URL (1 giờ)."
