#!/bin/bash
# ============================================================
#  Size24 ERP — Full Production Deployment Script
#  Run this on your EC2 Ubuntu server as: bash deploy.sh
# ============================================================

set -e  # Exit on any error

# ── CONFIGURATION ────────────────────────────────────────────
APP_DIR="$HOME/Size24_erp/erp-system/backend"
APP_NAME="size24-erp"
PORT=5000

# ────────────────────────────────────────────────────────────
echo ""
echo "======================================================"
echo "  Size24 ERP — Production Deployment"
echo "======================================================"
echo ""

# ── STEP 1: Install Node.js 20 LTS ──────────────────────────
echo "[1/8] Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "  → Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "  ✓ Node.js $(node -v) already installed"
fi

# ── STEP 2: Install npm dependencies ────────────────────────
echo ""
echo "[2/8] Installing npm dependencies..."
cd "$APP_DIR"
npm install --omit=dev
echo "  ✓ Dependencies installed"

# ── STEP 3: Update .env with CORS_ORIGIN ────────────────────
echo ""
echo "[3/8] Updating .env for production..."
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")
if [ -n "$EC2_IP" ]; then
    # Add CORS_ORIGIN if not already present
    if ! grep -q "^CORS_ORIGIN=" "$APP_DIR/.env"; then
        echo "" >> "$APP_DIR/.env"
        echo "CORS_ORIGIN=http://$EC2_IP,http://localhost:5173,http://localhost:3000" >> "$APP_DIR/.env"
        echo "  ✓ Added CORS_ORIGIN=http://$EC2_IP to .env"
    else
        echo "  ✓ CORS_ORIGIN already set in .env"
    fi
else
    echo "  ⚠ Could not detect EC2 public IP automatically."
    echo "    Add this line to $APP_DIR/.env manually:"
    echo "    CORS_ORIGIN=http://<YOUR_EC2_IP>,http://localhost:5173"
fi

# ── STEP 4: Install and configure PM2 ───────────────────────
echo ""
echo "[4/8] Setting up PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    echo "  ✓ PM2 installed"
else
    echo "  ✓ PM2 $(pm2 -v) already installed"
fi

# Stop existing PM2 process if running
pm2 delete "$APP_NAME" 2>/dev/null || true

# Start fresh
cd "$APP_DIR"
pm2 start server.js \
    --name "$APP_NAME" \
    --restart-delay=3000 \
    --max-restarts=10 \
    --env production

# Save PM2 process list
pm2 save

# Enable PM2 startup
echo ""
echo "  → Configuring PM2 startup on reboot..."
PM2_STARTUP=$(pm2 startup systemd -u "$USER" --hp "$HOME" 2>&1 | grep "sudo")
if [ -n "$PM2_STARTUP" ]; then
    eval "$PM2_STARTUP"
fi
pm2 save
echo "  ✓ PM2 will auto-start on reboot"

# ── STEP 5: Setup UFW Firewall ───────────────────────────────
echo ""
echo "[5/8] Configuring firewall..."
sudo ufw --force enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 5000/tcp  # Direct Node.js (optional)
echo "  ✓ Firewall rules applied"
sudo ufw status

# ── STEP 6: Install and configure NGINX ─────────────────────
echo ""
echo "[6/8] Setting up NGINX reverse proxy..."
sudo apt-get update -qq
sudo apt-get install -y nginx

# Write NGINX config
sudo tee /etc/nginx/sites-available/size24-erp > /dev/null <<NGINX_CONF
server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";

    # Upload size limit (for your multer routes)
    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 90;
    }

    # Serve uploaded files directly via NGINX (faster)
    location /uploads/ {
        alias ${APP_DIR}/uploads/;
        expires 30d;
        add_header Cache-Control "public";
    }
}
NGINX_CONF

# Enable site, disable default
sudo ln -sf /etc/nginx/sites-available/size24-erp /etc/nginx/sites-enabled/size24-erp
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload NGINX
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
echo "  ✓ NGINX configured and running"

# ── STEP 7: Create uploads directory (multer) ───────────────
echo ""
echo "[7/8] Ensuring uploads directory exists..."
mkdir -p "$APP_DIR/uploads"
chmod 755 "$APP_DIR/uploads"
echo "  ✓ uploads/ ready"

# ── STEP 8: Verify everything ────────────────────────────────
echo ""
echo "[8/8] Verifying deployment..."
sleep 3

# Check PM2
echo ""
pm2 status

# Test local connection
echo ""
echo "  Testing localhost:${PORT}..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT}/api/auth 2>/dev/null | grep -qE "^(200|404|401|400)"; then
    echo "  ✓ Backend is responding on port ${PORT}"
else
    echo "  → Backend response (any response = server is alive):"
    curl -s http://localhost:${PORT}/api/auth || true
fi

# Test via NGINX
echo ""
echo "  Testing via NGINX (port 80)..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost/api/auth 2>/dev/null | grep -qE "^(200|404|401|400)"; then
    echo "  ✓ NGINX proxy working on port 80"
else
    echo "  ⚠ NGINX proxy check inconclusive — check: sudo nginx -t"
fi

# ── DONE ─────────────────────────────────────────────────────
echo ""
echo "======================================================"
echo "  DEPLOYMENT COMPLETE!"
echo "======================================================"
if [ -n "$EC2_IP" ]; then
    echo ""
    echo "  Your API is live at:"
    echo "  http://$EC2_IP"
    echo "  http://$EC2_IP/api/auth"
fi
echo ""
echo "  MANAGEMENT COMMANDS:"
echo "  ─────────────────────────────────────────────────"
echo "  pm2 restart $APP_NAME     → Restart backend"
echo "  pm2 logs $APP_NAME        → View live logs"
echo "  pm2 stop $APP_NAME        → Stop backend"
echo "  pm2 monit                 → CPU/RAM dashboard"
echo "  sudo systemctl restart nginx  → Restart NGINX"
echo "  sudo tail -f /var/log/nginx/error.log  → NGINX errors"
echo ""
echo "  NEXT STEP (optional HTTPS):"
echo "  sudo apt install -y certbot python3-certbot-nginx"
echo "  sudo certbot --nginx -d yourdomain.com"
echo "======================================================"
