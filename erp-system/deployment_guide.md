# ERP System Deployment Guide

This guide covers deploying the Multi-Store ERP system on AWS.

## Prerequisites
- AWS Account with an active EC2 key pair
- Postgres database hosted on AWS RDS
- Domain Name mapped to your EC2 static IP
- Nginx installed on EC2
- Node.js installed on EC2

## 1. Database Setup (AWS RDS)
1. In the AWS Console, open **RDS** and create a PostgreSQL database.
2. Ensure the Security Group allows inbound connections on port `5432` from your EC2 instance.
3. Keep the DB Endpoint, Username, and Password handy.
4. Run the sql script `backend/schema.sql` on the RDS instance using tools like PgAdmin or DBeaver.

## 2. Backend Deployment (AWS EC2)
1. SSH into your EC2 instance.
2. Clone the repository and navigate to `erp-system/backend`.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create the `.env` file with production credentials:
   ```bash
   PORT=5000
   DB_HOST=<your-rds-endpoint>
   DB_USER=<your-db-username>
   DB_PASSWORD=<your-db-password>
   DB_NAME=erp_db
   DB_PORT=5432
   JWT_SECRET=<your-very-strong-secret-key>
   ```
5. Install PM2 globally to run the Node.js app in the background:
   ```bash
   sudo npm install -g pm2
   ```
6. Start the backend with PM2:
   ```bash
   pm2 start server.js --name "erp-backend"
   pm2 startup
   pm2 save
   ```

## 3. Frontend Deployment
1. Go to `erp-system/frontend` locally on your machine.
2. Ensure `src/services/api.js` points to your production backend (e.g. `https://api.yourdomain.com/api`).
3. Build the frontend:
   ```bash
   npm run build
   ```
4. Upload the contents of the `dist/` folder to your EC2 instance (e.g., using SCP) into `/var/www/erp-frontend`.

## 4. Nginx Configuration
1. Install Nginx on EC2:
   ```bash
   sudo apt update
   sudo apt install nginx
   ```
2. Configure Nginx by editing `/etc/nginx/sites-available/default`:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;

       # Frontend (React)
       location / {
           root /var/www/erp-frontend;
           index index.html index.htm;
           try_files $uri $uri/ /index.html; # crucial for React Router
       }

       # Backend (Node.js API proxy)
       location /api/ {
           proxy_pass http://localhost:5000/api/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
3. Test and restart Nginx:
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## 5. Document Storage (AWS S3)
If you decide to extend the document handling (aadhaar/pan/voter) to upload files instead of just string numbers:
1. Create an S3 Bucket and allow appropriate IAM permissions for the EC2 role.
2. In the backend, utilize `aws-sdk` (v3) to handle MultiPart uploads directly from Express (using `multer` and `multer-s3`).

## 6. Security (SSL/HTTPS)
1. Run Certbot to automatically configure SSL for Nginx.
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```
