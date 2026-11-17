#!/usr/bin/env bash
set -euo pipefail

# Exports a clean self-hosted copy of Sahlify (without private cloud billing/admin modules)
# Usage: ./scripts/export-public.sh [target_dir]

TARGET_DIR="${1:-../sahlify-public}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$TARGET_DIR"

rsync -a --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.env' \
  --exclude='.env.*' \
  --include='.env.example' \
  --exclude='dist/' \
  --exclude='dist-ssr/' \
  --exclude='.nuxt/' \
  --exclude='.output/' \
  --exclude='backend/uploads/*' \
  --exclude='backend/src/modules/billing/' \
  --exclude='backend/src/modules/admin/' \
  --exclude='backend/src/jobs/billingLifecycleJob.js' \
  --exclude='backend/tests/phase9.test.js' \
  --exclude='frontend/frontend/src/views/AdminView.vue' \
  --exclude='frontend/frontend/src/views/BillingView.vue' \
  --exclude='frontend/frontend/src/views/PricingView.vue' \
  --exclude='frontend/frontend/src/composables/useBilling.js' \
  "$ROOT_DIR/" "$TARGET_DIR/"

echo "Exported clean self-hosted codebase to: $TARGET_DIR"
