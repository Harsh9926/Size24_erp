# SIZE24 ERP System

A full-stack ERP system for retail shop management. Shop owners submit daily sales entries, admins track cash flows, audit logs, and generate reports.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TailwindCSS 4, React Router 7 |
| Backend | Node.js, Express 5, PostgreSQL |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Charts | Recharts |
| PDF | jsPDF + jsPDF-AutoTable |
| Excel | SheetJS (xlsx) |

---

## Project Structure

```
erp-system/
├── backend/
│   ├── config/         # Database connection
│   ├── controllers/    # Request handlers
│   ├── db/             # SQL schema (single source of truth)
│   ├── middleware/     # JWT auth middleware
│   ├── routes/         # Express route definitions
│   ├── scripts/        # Admin utility scripts (not part of the app)
│   ├── uploads/        # User-uploaded photos (gitignored)
│   ├── .env.example    # Required environment variables
│   └── server.js       # App entry point
│
└── frontend/
    ├── public/         # Static assets (logo, favicon)
    ├── src/
    │   ├── components/ # Shared UI components
    │   ├── context/    # React context (AuthContext)
    │   ├── pages/      # Route-level page components
    │   └── services/   # Axios API client
    ├── .env.example    # Required environment variables
    └── index.html
```

---

## Setup

### Prerequisites
- Node.js ≥ 18
- PostgreSQL ≥ 14

### 1. Clone the repository

```bash
git clone <repo-url>
cd erp-system
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env          # Fill in your DB credentials and JWT secret
npm install
node scripts/init_db.js       # Creates DB + applies schema
npm run dev                   # Starts server on port 5000 (with nodemon)
```

### 3. Frontend setup

```bash
cd frontend
cp .env.example .env          # Set VITE_API_URL if needed
npm install
npm run dev                   # Starts Vite dev server on port 5173
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `yourpassword` |
| `DB_NAME` | Database name | `erp_db` |
| `JWT_SECRET` | JWT signing secret (keep long & random) | `...` |
| `CORS_ORIGIN` | Comma-separated allowed frontend URLs | `https://app.vercel.app` |

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL (include `/api`) | `https://api.onrender.com/api` |

---

## Available Scripts

### Backend

```bash
npm start       # Production — node server.js
npm run dev     # Development — nodemon server.js (auto-restart)
```

### Frontend

```bash
npm run dev     # Vite dev server with HMR
npm run build   # Production build → frontend/dist/
npm run preview # Preview production build locally
```

### Admin Utilities (backend/scripts/)

```bash
node scripts/init_db.js        # Initialize database schema
node scripts/list_users.js     # List all users
node scripts/reset_password.js # Reset all passwords to defaults
node scripts/check_pw.js       # Verify passwords for all users
node scripts/test_login.js     # Smoke-test the login endpoint
```

---

## Deployment

### Frontend → Vercel

1. Connect your GitHub repo to Vercel.
2. Set **Root Directory** to `frontend`.
3. Add environment variable: `VITE_API_URL=https://your-backend.onrender.com/api`

### Backend → Render

1. Create a new **Web Service** in Render.
2. Set **Root Directory** to `backend`.
3. **Build command:** `npm install`
4. **Start command:** `npm start`
5. Add all environment variables from `backend/.env.example`.

---

## Default Credentials (development only)

After running `node scripts/reset_password.js`:

| Role | Password |
|------|----------|
| admin | `admin@123` |
| shop_user / manager | `user@123` |

> **Never use these in production. Change all passwords immediately after setup.**
