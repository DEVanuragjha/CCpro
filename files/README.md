# ☁️ NimbusVault — Cloud-Based File Storage & Sharing System

A modern, full-stack cloud file storage application built with **vanilla HTML/CSS/JS** and **Supabase** (Auth + Storage + PostgreSQL). Perfect for portfolio, resume, and college submissions.

---

## 📸 Features

| Feature | Status |
|---|---|
| Email / Password Signup & Login | ✅ |
| Session persistence (stays logged in) | ✅ |
| Drag & Drop file upload | ✅ |
| Upload progress bar | ✅ |
| File cards with type icons | ✅ |
| Download files | ✅ |
| Soft-delete (Move to Trash) | ✅ |
| Restore from Trash | ✅ |
| Empty Trash (permanent delete) | ✅ |
| Share files via public link | ✅ |
| Toggle public / private per file | ✅ |
| Copy link button | ✅ |
| Search files | ✅ |
| Grid & List view | ✅ |
| Dark / Light theme toggle | ✅ |
| Storage usage display | ✅ |
| Dashboard statistics | ✅ |
| Fully responsive (mobile + desktop) | ✅ |
| Toast notifications | ✅ |

---

## 🗂️ Project Structure

```
cloud-storage-app/
├── index.html            ← Login / Signup page
├── dashboard.html        ← Main app (protected)
├── style.css             ← Complete dark-theme stylesheet
├── app.js                ← Dashboard logic (upload, download, share…)
├── firebase.js           ← Supabase client + auth helpers
├── supabase-setup.sql    ← Database & storage setup SQL
│
├── pages/
│   └── login.js          ← Auth page logic
│
└── README.md
```

---

## ⚙️ Setup Instructions

### Step 1 — Create a Supabase Project (free)

1. Go to **https://supabase.com** and sign up
2. Click **"New project"**
3. Choose a name, database password, and region
4. Wait ~2 minutes for the project to provision

### Step 2 — Configure the Database

1. In your Supabase project, go to **SQL Editor** → **New Query**
2. Paste the entire contents of `supabase-setup.sql`
3. Click **Run** (green button)

### Step 3 — Create the Storage Bucket

1. Go to **Storage** in the left sidebar
2. Click **"New bucket"**
3. Name: `user-files`
4. After creating, click the bucket → **Settings** → toggle **"Public bucket"** ON
   *(This allows public share links to work)*

### Step 4 — Get Your API Keys

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — a long JWT string

### Step 5 — Paste Config into `firebase.js`

Open `firebase.js` and replace:

```js
export const SUPABASE_URL      = "https://YOUR_PROJECT_ID.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_PUBLIC_KEY";
```

### Step 6 — Run the App

Since the app uses ES Modules (`type="module"`), you **must** serve it via a local server:

**Option A — VS Code (recommended)**
- Install the **Live Server** extension
- Right-click `index.html` → "Open with Live Server"

**Option B — Python**
```bash
cd cloud-storage-app
python -m http.server 8080
# Open http://localhost:8080
```

**Option C — Node.js**
```bash
npx serve cloud-storage-app
```

---

## 🚀 Deployment

### Deploy to Vercel (easiest)

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. From the project folder:
   ```bash
   cd cloud-storage-app
   vercel
   ```

3. Follow the prompts — it auto-detects a static site.
4. Your app will be live at `https://your-app.vercel.app` 🎉

### Deploy to Netlify

1. Go to **https://netlify.com** → **"Add new site"** → **"Deploy manually"**
2. Drag & drop the `cloud-storage-app/` folder into the drop zone
3. Done!

### Deploy to GitHub Pages

1. Push the project to a GitHub repository
2. Go to **Settings** → **Pages** → Source: `main` branch → `/root`
3. Visit the generated URL

---

## 🔐 Security Notes

- Supabase Row Level Security (RLS) ensures users can only access their own files
- Storage policies restrict uploads/downloads to the file owner's folder
- The anon key is safe to expose in frontend code — it only allows what your policies permit
- Never store the `service_role` key in frontend code

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES Modules) |
| Auth | Supabase Auth (email + password) |
| Database | Supabase PostgreSQL (files metadata table) |
| File Storage | Supabase Storage |
| Fonts | Syne + DM Sans (Google Fonts) |
| Hosting | Vercel / Netlify / GitHub Pages |

---

## 📋 Supabase Free Tier Limits

Everything in this project works within Supabase's **free tier**:

| Resource | Free Limit |
|---|---|
| Database | 500 MB |
| Storage | 1 GB |
| Bandwidth | 2 GB / month |
| Auth users | Unlimited |
| API requests | 500K / month |

---

## 🐛 Troubleshooting

| Problem | Solution |
|---|---|
| "Supabase SDK not loaded" | Make sure you have an internet connection (CDN loads at runtime) |
| Files not appearing | Check the SQL was run correctly in Supabase; verify RLS policies |
| Upload fails | Ensure the `user-files` bucket exists and is set to public |
| Login redirects to login page | Email confirmation may be required — check Supabase Auth settings |
| CORS errors | Supabase handles CORS automatically; ensure URL is correct |

To disable email confirmation (for testing):
**Supabase → Authentication → Settings → "Enable email confirmations"** → OFF

---

## 👨‍💻 Author

Built for educational purposes. Feel free to use, modify, and submit for college projects!
