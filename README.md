# D1 Training — Gym Workout Whiteboard

A TV display board for D1 Training gyms. Shows the daily workout for 4 athlete
tracks (Adult, Devo, Rookie, Prep) on a single dark chalkboard-style screen.
A password-protected admin page lets coaches load workouts via SQL insert scripts.

---

## Stack

- **Frontend**: Pure HTML / CSS / JavaScript (no frameworks)
- **Database**: Supabase (Postgres)
- **Hosting**: Vercel (static site + serverless API routes)

---

## Setup

### 1. Supabase — Create the database

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the Supabase dashboard, open **SQL Editor**.
3. Paste the contents of `schema.sql` and run it.
   This creates the `workouts` table, index, `exec_sql` RPC function, and RLS policy.
4. Note your project's **URL** and keys from **Project Settings → API**:
   - **URL**: `https://your-project-ref.supabase.co`
   - **anon/public key**: used for the TV display (read-only)
   - **service_role key**: used for the admin page (full access) — keep this secret

### 2. Vercel — Deploy the site

1. Push this repo to GitHub (or another Git provider).
2. Go to [vercel.com](https://vercel.com) and import the repository.
3. In **Project Settings → Environment Variables**, add:
   | Name | Value |
   |------|-------|
   | `SUPABASE_URL` | your Supabase project URL |
   | `SUPABASE_ANON_KEY` | your anon/public key |
   | `SUPABASE_SERVICE_KEY` | your service_role key |
4. Deploy. Both `index.html` (TV display) and `admin.html` (admin) will be live.

### 3. Local development

Install the [Vercel CLI](https://vercel.com/docs/cli) and run:

```bash
cp .env.example .env
# Fill in real values in .env
vercel dev
```

`vercel dev` serves the static files and runs the `/api/*.js` serverless functions
locally, so `supabase.js` can fetch credentials from `/api/config` and `/api/admin-config`.

---

## Changing the admin password

Open `admin.js` and change the constant at the top:

```js
const ADMIN_PASSWORD = 'D1Training'; // ← change this
```

Redeploy after changing it.

---

## Loading workouts — SQL script workflow

1. Photograph the Teambuildr app showing the week's workout.
2. Ask Claude to parse the screenshot and generate a SQL insert script using this format:

```sql
insert into workouts
  (track, day_of_week, section, section_order, exercise_label, exercise_name, sets, reps, notes, week_start_date)
values
  ('Adult', 'Monday', 'P', 1, 'A1', 'SL DB RDLs', 3, '10 ea.', null, '2025-01-06'),
  ('Adult', 'Monday', 'P', 2, 'A2', 'Broad Jumps', 3, '15 yds.', null, '2025-01-06'),
  ('Adult', 'Monday', 'S', 1, 'B1', 'BB FSQ', 4, '10', null, '2025-01-06'),
  ('Adult', 'Monday', 'C&C', 1, 'D1', 'Plate Push', 3, '15 yds', null, '2025-01-06');
```

**Rules:**
- `week_start_date` must always be the **Monday** of the week shown in the screenshot.
- `section` must be one of: `P`, `S`, `C&C`
- `reps` is a text field — use values like `"10 ea."`, `"30s"`, `"15 yds"`.
- Motivational text (e.g. "Let's GO!!!!") goes on its own row:
  `exercise_label = ''`, `exercise_name = 'Let\'s GO!!!!'`

3. Open `admin.html`, navigate to the correct week / day / track.
4. Paste the SQL into the textarea at the bottom and click **Execute**.
5. The table will refresh showing the newly loaded rows.

---

## File structure

```
/
├── index.html           ← TV display page
├── admin.html           ← Workout management page
├── style.css            ← Shared styles (chalkboard aesthetic)
├── display.js           ← TV display fetch + render logic
├── admin.js             ← Admin CRUD + SQL execute logic
├── supabase.js          ← Supabase client initialization
├── api/
│   ├── config.js        ← Vercel function: returns anon key
│   └── admin-config.js  ← Vercel function: returns service role key
├── vercel.json          ← Vercel routing config
├── schema.sql           ← Supabase table + RLS + RPC setup
└── .env.example         ← Environment variable template
```

---

## TV display notes

- Optimized for **1080p and 4K** screens in landscape mode.
- Auto-refreshes every **5 minutes**.
- Day pills at the top let coaches preview any day (Mon–Sat).
- Font sizes use `clamp()` to scale cleanly across resolutions.
- Sections are always displayed in order: **P → S → C&C**.

---

## Security notes

- The `/api/admin-config` endpoint returns the service role key to any client.
  This is intentional — the admin page is password-protected at the application
  level. If you need stricter security, add an `Authorization` header check in
  `api/admin-config.js` and send a matching header from `admin.js`.
- The anon key is read-only by default (RLS policy only allows SELECT).
  All writes go through the service role key via the admin page.
