# ==============================================================================
# Google Cloud Platform (GCP) Automated Deployment Script
# All resource names, services, and identifiers are strictly in English.
# ==============================================================================

param (
    [string]$ProjectId = "project-e287e159-4fc1-4b7f-bf9",
    [string]$Region = "us-central1",
    [string]$Zone = "us-central1-a",
    [string]$ServiceName = "upad-backend-service",
    [string]$InstanceName = "upad-core-server",
    [string]$DatabaseInstanceName = "upad-postgres-instance",
    [string]$DatabaseName = "upad_relational_db",
    [string]$StorageBucketName = "upad-storage-assets-prod",
    [string]$ServiceAccountName = "upad-backend-runner"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Starting Google Cloud Platform (GCP) Deployment for U-Pad" -ForegroundColor Cyan
Write-Host " Project ID: $ProjectId | Region: $Region" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Set Active GCP Project
Write-Host "[1/6] Configuring active project in Google Cloud CLI..." -ForegroundColor Yellow
& "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" config set project $ProjectId

# 2. Enable Required Google Cloud APIs
Write-Host "[2/6] Enabling essential Google Cloud service APIs..." -ForegroundColor Yellow
& "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" services enable `
    compute.googleapis.com `
    run.googleapis.com `
    sqladmin.googleapis.com `
    storage.googleapis.com `
    iam.googleapis.com `
    artifactregistry.googleapis.com `
    cloudbuild.googleapis.com `
    --project $ProjectId

# 3. Create Cloud IAM Service Account
Write-Host "[3/6] Setting up Cloud IAM Service Account ($ServiceAccountName)..." -ForegroundColor Yellow
& "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" iam service-accounts create $ServiceAccountName `
    --display-name="U-Pad Core Backend Service Account" `
    --project $ProjectId

# Assign Cloud SQL and Storage IAM Roles
& "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$ServiceAccountName@$ProjectId.iam.gserviceaccount.com" `
    --role="roles/cloudsql.client"

& "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$ServiceAccountName@$ProjectId.iam.gserviceaccount.com" `
    --role="roles/storage.objectAdmin"

# 4. Create Google Cloud Storage Bucket for Pictograms & Assets
Write-Host "[4/6] Creating Google Cloud Storage Bucket ($StorageBucketName)..." -ForegroundColor Yellow
& "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" storage buckets create "gs://$StorageBucketName" `
    --location=$Region `
    --project=$ProjectId

# 5. Build and Deploy Cloud Run Service
Write-Host "[5/6] Deploying containerized service to Google Cloud Run ($ServiceName)..." -ForegroundColor Yellow
& "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" run deploy $ServiceName `
    --source="$PSScriptRoot" `
    --region=$Region `
    --platform=managed `
    --allow-unauthenticated `
    --service-account="$ServiceAccountName@$ProjectId.iam.gserviceaccount.com" `
    --port=8080 `
    --project=$ProjectId

# 6. Retrieve Deployment Endpoint URL
Write-Host "[6/6] Fetching public HTTPS endpoint URL..." -ForegroundColor Green
$ServiceUrl = & "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" run services describe $ServiceName `
    --platform=managed `
    --region=$Region `
    --format="value(status.url)" `
    --project=$ProjectId

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " Deployment Complete!" -ForegroundColor Green
Write-Host " Public Cloud Endpoint: $ServiceUrl" -ForegroundColor Green
Write-Host " Health Diagnostic URL: $ServiceUrl/api/v1/health" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
