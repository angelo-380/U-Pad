#!/usr/bin/env bash
# ==============================================================================
# Google Cloud Platform (GCP) Automated Deployment Script (Bash)
# All resource names, services, and identifiers are strictly in English.
# ==============================================================================

set -e

PROJECT_ID="project-e287e159-4fc1-4b7f-bf9"
REGION="us-central1"
SERVICE_NAME="upad-backend-service"
STORAGE_BUCKET_NAME="upad-storage-assets-prod"
SERVICE_ACCOUNT_NAME="upad-backend-runner"

echo "=========================================================="
echo " Starting Google Cloud Platform (GCP) Deployment for U-Pad"
echo " Project ID: $PROJECT_ID | Region: $REGION"
echo "=========================================================="

# 1. Set Active GCP Project
echo "[1/5] Configuring active project in Google Cloud CLI..."
gcloud config set project "$PROJECT_ID"

# 2. Enable Required APIs
echo "[2/5] Enabling Google Cloud service APIs..."
gcloud services enable \
    run.googleapis.com \
    sqladmin.googleapis.com \
    storage.googleapis.com \
    iam.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    --project "$PROJECT_ID"

# 3. Create Cloud IAM Service Account
echo "[3/5] Setting up Cloud IAM Service Account ($SERVICE_ACCOUNT_NAME)..."
gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
    --display-name="U-Pad Core Backend Service Account" \
    --project "$PROJECT_ID" || true

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudsql.client" || true

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.objectAdmin" || true

# 4. Deploy to Google Cloud Run
echo "[4/5] Deploying container to Google Cloud Run ($SERVICE_NAME)..."
gcloud run deploy "$SERVICE_NAME" \
    --source=. \
    --region="$REGION" \
    --platform=managed \
    --allow-unauthenticated \
    --service-account="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
    --port=8080 \
    --project "$PROJECT_ID"

# 5. Fetch Service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --platform=managed \
    --region="$REGION" \
    --format="value(status.url)" \
    --project "$PROJECT_ID")

echo "=========================================================="
echo " Deployment Successful!"
echo " Service URL: $SERVICE_URL"
echo " Health URL:  $SERVICE_URL/api/v1/health"
echo "=========================================================="
