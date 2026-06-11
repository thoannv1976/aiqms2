#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AIQMS — Dựng CI/CD: GitHub Actions tự deploy lên Cloud Run (Workload Identity
# Federation — KHÔNG cần lưu key JSON trong GitHub).
#
# Chạy MỘT LẦN trong Cloud Shell (https://shell.cloud.google.com) hoặc máy có gcloud
# đã đăng nhập tài khoản có quyền IAM Admin trên project:
#   bash scripts/setup-cicd.sh
#
# Script idempotent (chạy lại an toàn). Làm:
#   1) Tạo service account triển khai (aiqms-deployer) + cấp quyền build/deploy
#   2) Tạo Workload Identity Pool + Provider cho GitHub OIDC (khóa theo đúng repo)
#   3) Cho phép repo GitHub mạo danh SA triển khai
#   4) IN RA 5 biến repo cần dán vào GitHub (Settings → Secrets and variables →
#      Actions → Variables) để workflow .github/workflows/deploy.yml chạy được.
#
# Tuỳ biến qua biến môi trường (đều có mặc định):
#   PROJECT_ID (mặc định: project đang active)  REGION (asia-southeast1)
#   SERVICE (aiqms2)                             REPO (thoannv1976/aiqms2)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-asia-southeast1}"
SERVICE="${SERVICE:-aiqms2}"
REPO="${REPO:-thoannv1976/aiqms2}"
POOL="github-pool"
PROVIDER="github-provider"
DEPLOYER="aiqms-deployer"

[ -n "$PROJECT_ID" ] || { echo "✗ Chưa chọn project: gcloud config set project <ID>" >&2; exit 1; }
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
DEPLOY_SA="${DEPLOYER}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "── Cấu hình ──────────────────────────────────────────"
echo "  Project : $PROJECT_ID ($PROJECT_NUMBER)"
echo "  Region  : $REGION   Service: $SERVICE   Repo: $REPO"
echo "──────────────────────────────────────────────────────"

# 0) Bật API
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com iamcredentials.googleapis.com \
  sts.googleapis.com --project "$PROJECT_ID" --quiet

# 1) Service account triển khai + quyền
gcloud iam service-accounts create "$DEPLOYER" --project "$PROJECT_ID" \
  --display-name "AIQMS CI/CD deployer" 2>/dev/null \
  && echo "✓ Tạo SA $DEPLOY_SA" || echo "✓ SA $DEPLOY_SA đã tồn tại"

for ROLE in roles/run.admin roles/cloudbuild.builds.editor \
            roles/artifactregistry.admin roles/storage.admin roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member "serviceAccount:${DEPLOY_SA}" --role "$ROLE" --condition=None --quiet >/dev/null
done
echo "✓ Cấp quyền build/deploy cho $DEPLOY_SA"

# SA runtime mà Cloud Run service đang chạy (mặc định = compute SA) — deployer cần actAs.
RUNTIME_SA="$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" \
  --format 'value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
[ -n "$RUNTIME_SA" ] || RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --project "$PROJECT_ID" \
  --member "serviceAccount:${DEPLOY_SA}" --role roles/iam.serviceAccountUser --quiet >/dev/null
echo "✓ deployer được actAs runtime SA ($RUNTIME_SA)"

# Cloud Build worker (compute SA) cần quyền build/push image.
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for ROLE in roles/artifactregistry.writer roles/logging.logWriter roles/storage.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member "serviceAccount:${COMPUTE_SA}" --role "$ROLE" --condition=None --quiet >/dev/null
done
echo "✓ Cấp quyền build cho Cloud Build worker ($COMPUTE_SA)"

# 2) Workload Identity Pool + Provider (OIDC GitHub)
gcloud iam workload-identity-pools create "$POOL" --project "$PROJECT_ID" --location global \
  --display-name "GitHub Actions" 2>/dev/null \
  && echo "✓ Tạo WIF pool $POOL" || echo "✓ WIF pool $POOL đã tồn tại"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --project "$PROJECT_ID" \
  --location global --workload-identity-pool "$POOL" \
  --display-name "GitHub OIDC" \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition "assertion.repository=='${REPO}'" 2>/dev/null \
  && echo "✓ Tạo WIF provider $PROVIDER (khóa theo repo $REPO)" \
  || echo "✓ WIF provider $PROVIDER đã tồn tại"

# 3) Cho phép đúng repo mạo danh SA triển khai
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --project "$PROJECT_ID" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO}" \
  --quiet >/dev/null
echo "✓ Repo $REPO được phép mạo danh $DEPLOY_SA"

WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"

cat <<EOF

── HOÀN TẤT — DÁN 5 BIẾN SAU VÀO GITHUB ──────────────────
GitHub repo → Settings → Secrets and variables → Actions → tab "Variables" → New repository variable:

  GCP_PROJECT_ID    = ${PROJECT_ID}
  GCP_REGION        = ${REGION}
  GCP_SERVICE       = ${SERVICE}
  GCP_DEPLOY_SA     = ${DEPLOY_SA}
  GCP_WIF_PROVIDER  = ${WIF_PROVIDER}

Sau khi dán: mỗi lần push lên nhánh main / claude/magical-dirac-pUhEy sẽ tự build + deploy.
Có thể chạy tay: tab Actions → "Deploy to Cloud Run" → Run workflow.
──────────────────────────────────────────────────────────
EOF
