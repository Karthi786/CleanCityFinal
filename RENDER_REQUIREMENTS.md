# Render Deployment Requirements & Prerequisites

Before you can successfully host the **MakkalKural (CleanTamilnadu)** backend on [Render.com](https://render.com), you need to gather specific credentials, set up accounts, and prepare environment variables. This guide outlines everything you need to prepare.

## 1. Accounts & Hosting Requirements

Before you begin, ensure you have active accounts for the following services:
- **GitHub**: Your backend code must be pushed to a GitHub repository to easily connect it to Render.
- **Render**: Create an account on Render to host your Node.js backend.
- **Supabase**: You need access to your active Supabase project for the database.
- **OpenRouter**: Account with access to the OpenRouter API for the Ezhil AI features.
- **Google Cloud Console**: A project with the **Google Cloud Vision API** enabled.

---

## 2. Environment Variables (`.env`) Checklist

Render will require you to input environment variables manually under the **Environment** tab of your Web Service. Here is the complete list of variables you need to copy from your local `.env` file:

| Variable Name | Description | Example / Where to find it |
| :--- | :--- | :--- |
| `SUPABASE_URL` | The URL of your Supabase project. | `https://yfhjzuimoemctqzlmjej.supabase.co` |
| `SUPABASE_ANON_KEY` | Public anonymous key for Supabase. | From Supabase Dashboard -> Project Settings -> API |
| `SUPABASE_SERVICE_KEY` | Secret service role key for backend operations. | From Supabase Dashboard -> Project Settings -> API |
| `JWT_SECRET` | Secret string for encrypting user sessions. | e.g., `cleanmadurai_super_secret_jwt_key...` |
| `PORT` | The port Render will use (Render defaults to 10000). | `5001` (Render will automatically assign a port, but you can define it) |
| `FRONTEND_URL` | The URL where your frontend is hosted (e.g., Vercel/Netlify). | `https://your-frontend.vercel.app` (Important for CORS) |
| `OPENROUTER_API_KEY` | API key for Ezhil AI. | `sk-or-v1-...` |

---

## 3. SMTP & Email Configuration (Nodemailer)

To send emails (like OTPs, Registration Success, or Citizen Notifications), you must configure your SMTP details. We are currently using Gmail.

You need these two environment variables:
- `EMAIL_USER`: Your dedicated email address (e.g., `makkalsevi1@gmail.com`)
- `EMAIL_PASS`: **Google App Password** (Do NOT use your actual Gmail password)

### How to get the Google App Password:
1. Go to your Google Account Settings.
2. Navigate to **Security**.
3. Enable **2-Step Verification** (if not already enabled).
4. Search for **App passwords**.
5. Create a new App Password (name it "Render Backend").
6. Copy the generated 16-character password (e.g., `pwyxfxckshnrdhzm`) and use it as your `EMAIL_PASS`.

---

## 4. Google Cloud Vision Credentials

The backend relies on the Google Cloud Vision API for image processing, which requires a credentials JSON file.

### In your local environment:
You are currently using: `GOOGLE_APPLICATION_CREDENTIALS="./google-credentials.json"`

### For Render Deployment:
Render does not allow you to easily upload standalone files like `google-credentials.json` directly from the dashboard.
**Solution:**
Render offers **"Secret Files"**.
1. In your Render Web Service dashboard, go to the **Environment** tab.
2. Scroll down to **Secret Files**.
3. Click **Add Secret File**.
4. Set the filename as `google-credentials.json`.
5. Paste the entire JSON content from your local `google-credentials.json` into the content block.
6. Make sure your environment variable `GOOGLE_APPLICATION_CREDENTIALS` points to this file (e.g., `/etc/secrets/google-credentials.json` or just `./google-credentials.json` depending on how Render mounts it, Render usually mounts it at `/etc/secrets/filename`).

---

## 5. Render Build and Start Commands

Since your Node.js application is located inside the `backend` folder (not the root of the repository), you need to tell Render to navigate into that folder before downloading dependencies and starting the server.

When creating the Web Service on Render, you have two options:

**Option A: Using the Root Directory Setting (Recommended)**
1. **Root Directory**: `backend`
2. **Build Command**: `npm install` *(This downloads everything, including Nodemailer for SMTP)*
3. **Start Command**: `npm start` 

**Option B: Using inline folder navigation**
If you leave the Root Directory field empty, use these commands:
- **Build Command**: `cd backend && npm install`
- **Start Command**: `cd backend && npm start`

## 6. Summary of Action Items Before Deployment
- [ ] Push the latest code to a GitHub repository.
- [ ] Ensure `frontend_url` is updated in your CORS settings to reflect production, not `http://127.0.0.1:3001`.
- [ ] Generate the Gmail App Password for SMTP.
- [ ] Copy the contents of `google-credentials.json` to paste into Render's Secret Files.
- [ ] Have all API Keys (Supabase, OpenRouter) ready to paste into Render's Environment Variables.
