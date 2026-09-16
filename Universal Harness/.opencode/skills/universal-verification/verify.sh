#!/usr/bin/env bash
# Universal verification helper — run from repo root
set -e
echo "=== typecheck (mobile) ==="
(cd mobile && npm run typecheck)
echo "=== lint (mobile) ==="
(cd mobile && npm run lint)
echo "=== tsc (backend) ==="
(cd backend && npx tsc --noEmit)
echo "=== gates PASSED ==="
