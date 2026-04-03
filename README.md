# expnspltr — Setup & Deployment Guide

Split expenses. No drama.

---

## Prerequisites

- Node.js 18+ installed (https://nodejs.org)
- A free Supabase account (https://supabase.com)
- A free Netlify account (https://netlify.com)
- Git installed

---

## STEP 1 — Supabase Setup

### 1a. Create Project
1. Go to https://supabase.com → Sign in → New Project
2. Give it a name (e.g. "expnspltr"), set a strong DB password, choose a region
3. Wait ~2 minutes for it to provision

### 1b. Run the Database Schema
1. In your Supabase project → left sidebar → **SQL Editor**
2. Click **New Query**
3. Open `supabase_schema.sql` from this zip
4. Paste the entire contents into the editor
5. Click **Run** (green button)
6. You should see "Success. No rows returned"

### 1c. Disable Email Confirmation (IMPORTANT)
This lets users log in immediately without confirming their email.

1. Supabase → left sidebar → **Authentication** → **Providers**
2. Click **Email**
3. Turn OFF **"Confirm email"**
4. Click **Save**

### 1d. Get Your API Keys
1. Supabase → left sidebar → **Project Settings** → **API**
2. Copy:
   - **Project URL** → looks like `https://abcdefgh.supabase.co`
   - **anon public** key → long string starting with `eyJ...`

---

## STEP 2 — Configure the App

1. Unzip the downloaded file
2. Open the folder in VS Code or any editor
3. Copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```
4. Edit `.env` and fill in your values:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

## STEP 3 — Create the Admin Account

The admin is created manually in Supabase so you can set `is_admin = true`.

### 3a. Create user in Supabase
1. Supabase → **Authentication** → **Users** → **Add User** → **Create New User**
2. Enter your email and a password
3. Click **Create User**

### 3b. Set as admin
1. Supabase → **Table Editor** → **profiles** table
2. Find your row (it was auto-created by the trigger)
3. Click the row → edit `is_admin` → set to `true` → Save

> If the profiles row doesn't appear yet, wait 10 seconds and refresh.

---

## STEP 4 — Run Locally (optional, to test before deploy)

```bash
cd expnspltr
npm install
npm run dev
```

Open http://localhost:5173 — log in with your admin credentials.

---

## STEP 5 — Deploy to Netlify

### Option A: Via GitHub (Recommended — auto-deploys on push)

1. Push the project to a GitHub repo:
   ```bash
   cd expnspltr
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/expnspltr.git
   git push -u origin main
   ```

2. Go to https://netlify.com → **Add new site** → **Import an existing project**
3. Connect GitHub → select your repo
4. Build settings (should auto-detect from netlify.toml):
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
5. Click **Show advanced** → **New variable** → add both:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
6. Click **Deploy site**
7. Wait ~1 minute → your site is live!

### Option B: Drag and Drop

1. Build locally first:
   ```bash
   npm install
   npm run build
   ```
2. Go to https://netlify.com → drag the `dist` folder onto the deploy zone
3. Go to Site settings → Environment variables → add the two VITE_ variables
4. Trigger a redeploy

---

## STEP 6 — Using the App

### As Admin:
1. Log in → you land on the **Admin Dashboard**
2. **Create a Trip**: Click "+ New Trip" → fill name + optional description
3. **Add Users**: Click "+ Add User" → fill name, email, password → share these creds with the person
4. **Add members to trip**: Click a trip → Members tab → "+ Add Member" → select users
5. **Add expenses**: Expenses tab → "+ Add Expense" → fill description, amount, who paid, split among whom
6. **Settle up**: Click "⚡ Settle Up" button → see who owes whom → click "Mark as Settled"

### As a Regular User:
1. Log in with the credentials the admin gave you
2. You see only trips you've been added to
3. View expenses, see your balance, and the settlement breakdown

---

## How Settlement Works

The algorithm calculates the **minimum number of transactions** to settle all debts:

1. Computes each person's net balance (total paid − total owed)
2. People with a positive balance are owed money (creditors)
3. People with a negative balance owe money (debtors)
4. Greedily matches the largest debtor to the largest creditor until all balanced

Example:
- 3 people: Alice, Bob, Carol on a ₹900 trip
- Alice paid ₹600, Bob paid ₹300, Carol paid ₹0
- Equal split = ₹300 each
- Net: Alice +₹300, Bob ₹0, Carol -₹300
- Settlement: **Carol pays Alice ₹300** (1 transaction, done)

---

## File Structure

```
expnspltr/
├── .env.example              ← Copy to .env and fill in your keys
├── netlify.toml              ← Netlify build config
├── package.json
├── vite.config.js
├── index.html
├── supabase_schema.sql       ← Run this in Supabase SQL Editor
└── src/
    ├── main.jsx              ← Entry point
    ├── App.jsx               ← Routes + auth guards
    ├── index.css             ← All styles
    ├── context/
    │   └── AuthContext.jsx   ← Auth state management
    ├── lib/
    │   ├── supabase.js       ← Supabase client init
    │   └── settlement.js     ← Settlement algorithm
    └── pages/
        ├── LoginPage.jsx
        ├── AdminLayout.jsx
        ├── Dashboard.jsx         ← Admin: trips list + create users
        ├── TripDetail.jsx        ← Admin: expenses, members, settle
        ├── UserTrips.jsx         ← User: their trips list
        └── UserTripDetail.jsx    ← User: trip view + settlement
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Invalid email or password" | Make sure you disabled email confirmation in Supabase Auth settings |
| User created but can't log in | Check Supabase Auth → Users — confirm the user exists |
| Admin sees blank dashboard | Check that `is_admin = true` in profiles table |
| Build fails on Netlify | Make sure both VITE_ env vars are set in Netlify site settings |
| "relation does not exist" SQL error | Re-run the full supabase_schema.sql from scratch |
| Profile not found after login | The trigger may have failed — manually insert into profiles table |

---

## Supabase Free Tier Limits

The free tier is generous enough for personal use:
- 500 MB database storage
- 5 GB bandwidth/month
- 50,000 monthly active users
- Unlimited API calls

