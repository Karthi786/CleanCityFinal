# CleanMadurai — Smart & Clean Madurai Platform

A civic issue management platform for Madurai built with:
- **Frontend**: Vanilla HTML + CSS + JavaScript
- **Backend**: Node.js + Express REST API
- **Database**: Supabase (PostgreSQL)

---

## Project Structure

```
cleanmadurai-app/
├── backend/               # Node.js Express API
│   ├── .env               # ← Fill in your Supabase credentials
│   ├── src/
│   │   ├── config/supabase.js
│   │   ├── middleware/auth.js
│   │   ├── routes/auth.js, issues.js, users.js
│   │   └── index.js
│   └── package.json
├── frontend/              # Static HTML/CSS/JS
│   ├── index.html         # Landing page
│   ├── login.html
│   ├── register.html
│   ├── pending.html
│   ├── citizen-dashboard.html
│   ├── admin-dashboard.html
│   ├── collector-dashboard.html
│   ├── department-dashboard.html
│   ├── css/styles.css
│   └── js/ (api, auth, router, toast modules)
└── supabase-schema.sql    # ← Run this in Supabase SQL Editor first!
```

---

## Setup Instructions

### Step 1: Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In your Supabase dashboard → **SQL Editor** → paste and run `supabase-schema.sql`
3. Go to **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon (public)** key → `SUPABASE_ANON_KEY`
   - **service_role** (secret) key → `SUPABASE_SERVICE_KEY`

### Step 2: Configure Backend

Edit `backend/.env`:
```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
JWT_SECRET=change_this_to_a_secure_random_string
PORT=3000
FRONTEND_URL=http://localhost:5500
```

### Step 3: Install & Run Backend

```bash
cd backend
npm install
npm run dev
# API runs on http://localhost:3000
```

### Step 4: Serve Frontend

Using VS Code **Live Server** extension:
- Right-click `frontend/index.html` → "Open with Live Server"
- Frontend runs on `http://localhost:5500`

Or using npx:
```bash
cd frontend
npx serve . -p 5500
```

---

## User Roles

| Role | Dashboard | Access |
|------|-----------|--------|
| `USER` (Citizen) | `/citizen-dashboard.html` | Report issues, support community |
| `COLLECTOR` | `/collector-dashboard.html` | View all issues, update status |
| `MADURAI_CORPORATION` | `/department-dashboard.html` | Waste/Water/Roads issues |
| `TNEB` | `/department-dashboard.html` | Electricity issues |
| `POLICE` | `/department-dashboard.html` | Law & Order issues |
| `FIRE_STATION` | `/department-dashboard.html` | Fire hazard issues |
| `ADMIN` | `/admin-dashboard.html` | User management, analytics |

> **Note:** All roles except `USER` require admin approval after registration.

---

## API Endpoints

```
POST /api/auth/register       — Register new user
POST /api/auth/login          — Login, get JWT token
GET  /api/auth/me             — Get current user (🔒)
POST /api/auth/logout         — Logout (🔒)

GET  /api/issues              — List all issues (🔒)
POST /api/issues              — Create issue (🔒 USER)
PUT  /api/issues/:id/status   — Update status (🔒 Dept/Collector/Admin)
POST /api/issues/:id/support  — Support an issue (🔒)
DELETE /api/issues/:id        — Delete issue (🔒 Admin)

GET  /api/users               — List all users (🔒 Admin/Collector)
GET  /api/users/pending       — Pending verifications (🔒 Admin)
PUT  /api/users/:id/verify    — Approve/reject user (🔒 Admin)
GET  /api/users/stats         — System stats (🔒 Admin/Collector)
```

---

## Issue Categories & Routing

| Category | Assigned To |
|----------|-------------|
| Waste, Water, Roads | Madurai Corporation |
| Electricity | TNEB |
| Law & Order | Police |
| Fire | Fire Station |
