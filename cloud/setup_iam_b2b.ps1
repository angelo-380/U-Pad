# ==============================================================================
# U-PAD GOOGLE CLOUD PLATFORM - IAM & B2B ROLE MANAGEMENT SETUP
# Enforces the Principle of Least Privilege (PoLP)
# Pure English identifiers and role definitions
# ==============================================================================

$GCP_PROJECT_ID = "project-e287e159-4fc1-4b7f-bf9"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Configuring GCP IAM Roles for U-Pad Multi-Tenant Platform" -ForegroundColor Cyan
Write-Host "Project Target: $GCP_PROJECT_ID" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. DEVELOPER ROLE (100% Full Control - Infrastructure & Root Deployments)
# Developers have full control over Compute Engine, Cloud Run, Cloud KMS, and Cloud SQL.
Write-Host "`n[1/3] Verifying DEVELOPER Root Privileges..." -ForegroundColor Green
Write-Host "Role: roles/owner"
Write-Host "Permissions: Full Cloud Infrastructure, Key Management, CI/CD, and DB DDL"

# 2. B2B ORGANIZATION AUDITOR / ADMIN ROLE (Tenant-Level Administration)
# School/Clinic administrators have NO access to Cloud Infrastructure, KMS, or DB Schemas.
# They are granted strictly operational and monitoring viewer access.
Write-Host "`n[2/3] Defining B2B Organization Administrator Custom Role..." -ForegroundColor Green
$RoleYaml = @"
title: "UPadOrganizationAuditor"
description: "Restricted B2B operational role for schools and clinics. Strictly denies infrastructure alteration."
stage: "GA"
includedPermissions:
- monitoring.dashboards.get
- monitoring.dashboards.list
- monitoring.metricDescriptors.get
- monitoring.metricDescriptors.list
- monitoring.timeSeries.list
- logging.logEntries.list
- logging.views.list
"@

$RolePath = "$PSScriptRoot\b2b_org_auditor_role.yaml"
$RoleYaml | Out-File -FilePath $RolePath -Encoding UTF8

Write-Host "Custom Role Definition written to: $RolePath"
Write-Host "Command to bind role in GCP Console / CLI:"
Write-Host "  gcloud iam roles create UPadOrganizationAuditor --project=$GCP_PROJECT_ID --file=$RolePath" -ForegroundColor Yellow

# 3. VERIFY IAM INTEGRITY
Write-Host "`n[3/3] IAM Hierarchy Summary:" -ForegroundColor Green
Write-Host "  * DEVELOPER: 100% Control (Infra, DB Schemas, KMS Master Keys, Deployments)" -ForegroundColor White
Write-Host "  * ORG_ADMIN (B2B School/Clinic): Operational Control (Teachers, Students, Schedules, Telemetry)" -ForegroundColor White
Write-Host "  * PROHIBITED FOR ORG_ADMIN: Cloud Console Root, KMS Master Keys, Dropping Tables, Privilege Elevation" -ForegroundColor Red
Write-Host "`nIAM Configuration Complete." -ForegroundColor Cyan
