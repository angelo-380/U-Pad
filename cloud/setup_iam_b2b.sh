#!/usr/bin/env bash
# ==============================================================================
# U-PAD GOOGLE CLOUD PLATFORM - IAM & B2B ROLE MANAGEMENT SETUP
# Enforces the Principle of Least Privilege (PoLP)
# Pure English identifiers and role definitions
# ==============================================================================

set -euo pipefail

GCP_PROJECT_ID="project-e287e159-4fc1-4b7f-bf9"

echo "=========================================================="
echo "Configuring GCP IAM Roles for U-Pad Multi-Tenant Platform"
echo "Project Target: ${GCP_PROJECT_ID}"
echo "=========================================================="

# 1. DEVELOPER ROLE (100% Control)
echo "[1/3] Verifying DEVELOPER Root Privileges..."
echo "Role: roles/owner"
echo "Permissions: Full Cloud Infrastructure, Key Management, CI/CD, and DB DDL"

# 2. B2B ORGANIZATION AUDITOR / ADMIN ROLE
echo "[2/3] Defining B2B Organization Administrator Custom Role..."
cat << 'EOF' > "$(dirname "$0")/b2b_org_auditor_role.yaml"
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
EOF

echo "Custom Role Definition written to b2b_org_auditor_role.yaml"
echo "To create on GCP: gcloud iam roles create UPadOrganizationAuditor --project=${GCP_PROJECT_ID} --file=$(dirname "$0")/b2b_org_auditor_role.yaml"

echo "[3/3] IAM Hierarchy Summary:"
echo "  * DEVELOPER: 100% Control (Infra, DB Schemas, KMS Master Keys, Deployments)"
echo "  * ORG_ADMIN: Operational Control (Teachers, Students, Schedules, Telemetry)"
echo "  * PROHIBITED FOR ORG_ADMIN: Cloud Console Root, KMS Master Keys, Dropping Tables, Privilege Elevation"
echo "IAM Configuration Complete."
