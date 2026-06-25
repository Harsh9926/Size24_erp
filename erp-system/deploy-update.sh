#!/bin/bash
# ============================================================
#  Size24 ERP — Incremental Update Script
#  Run on EC2: bash deploy-update.sh
# ============================================================
set -e

APP_DIR="$HOME/Size24_erp/erp-system/backend"
APP_NAME="size24-erp"
FRONTEND_DIR="/var/www/erp-frontend"

echo ""
echo "======================================================"
echo "  Size24 ERP — Updating Backend + Frontend"
echo "======================================================"

# ── Pull latest code ────────────────────────────────────────
echo ""
echo "[1/4] Pulling latest code from git..."
cd "$HOME/Size24_erp"
git pull origin main
echo "  ✓ Code updated"

# ── Run DB migration ────────────────────────────────────────
echo ""
echo "[2/4] Running DB migration (payment_in fields)..."
cd "$APP_DIR"
node -e "
const db = require('./config/db');
const fs = require('fs');
const sql = fs.readFileSync('./db/migrate_payment_in_entry.sql', 'utf8');
db.pool.query(sql)
  .then(() => { console.log('  ✓ Migration applied'); process.exit(0); })
  .catch(e => { console.error('  ✗ Migration error:', e.message); process.exit(1); });
"

# Also run admin_bank_ledger migration in case it wasn't applied
node -e "
const db = require('./config/db');
const fs = require('fs');
const sql = fs.readFileSync('./db/migrate_admin_bank_ledger.sql', 'utf8');
db.pool.query(sql)
  .then(() => { console.log('  ✓ Bank ledger migration applied'); process.exit(0); })
  .catch(e => { console.error('  ! Bank ledger migration (may already exist):', e.message); process.exit(0); });
"

# ── Restart backend with PM2 ────────────────────────────────
echo ""
echo "[3/4] Restarting backend..."
cd "$APP_DIR"
npm install --omit=dev --quiet
pm2 restart "$APP_NAME" || pm2 start server.js --name "$APP_NAME"
pm2 save
echo "  ✓ Backend restarted"

# ── Deploy frontend build ────────────────────────────────────
echo ""
echo "[4/4] Deploying frontend..."
if [ -d "$FRONTEND_DIR" ]; then
    sudo cp -r "$HOME/Size24_erp/erp-system/frontend/dist/." "$FRONTEND_DIR/"
    echo "  ✓ Frontend deployed to $FRONTEND_DIR"
else
    echo "  ⚠ $FRONTEND_DIR not found — skipping frontend deploy"
    echo "    Copy erp-system/frontend/dist/ to your web root manually"
fi

# ── Verify ──────────────────────────────────────────────────
echo ""
sleep 2
echo "  Testing backend..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health 2>/dev/null || echo "000")
echo "  /api/health → HTTP $STATUS"

curl -s http://localhost:5000/api/payment-in/admins -H "Authorization: Bearer test" 2>/dev/null | head -c 100 || true
echo ""

echo ""
echo "======================================================"
echo "  UPDATE COMPLETE!"
echo "  pm2 logs $APP_NAME   → check for errors"
echo "======================================================"
