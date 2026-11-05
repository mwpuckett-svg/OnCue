# Run of Show

A live event run-of-show builder: multiple shows, customizable crew positions,
cascading cue timing, per-position notes, live "on-air" tracking, and real
email login — no more Claude-artifact honor system.

## What changed from the Claude artifact version

- **Real login.** Email + 6-digit code (Supabase Auth), not an honor-system
  picker. Someone can no longer just claim to be Stage Manager.
- **Real database.** Postgres via Supabase, with Row Level Security enforcing
  who can read/write what — admins can edit the schedule, everyone else is
  read-only except for their own position's notes.
- **Real-time sync.** Supabase subscriptions push changes instantly instead of
  polling every 7 seconds.
- Everything else — cascading times, hard-time locks, live tracking, invites,
  custom positions, CSV export — works the same as before.

## One-time setup

### 1. Create a Supabase project
Go to [supabase.com](https://supabase.com), create a free project, and wait
for it to finish provisioning (~2 minutes).

### 2. Run the schema
In your Supabase dashboard: **SQL Editor** → paste the entire contents of
`supabase/schema.sql` → **Run**. This creates all the tables, the
project-creation function, and the security policies.

### 3. Turn on email OTP sign-in
**Authentication → Providers → Email**: make sure Email is enabled. Under
**Authentication → Settings**, "Confirm email" can stay on — the 6-digit code
flow (`signInWithOtp`) works either way. No extra config needed for OTP itself.

### 4. Get your API keys
**Project Settings → API**: copy the **Project URL** and the **anon public**
key.

### 5. Configure the app
```bash
cp .env.example .env
```
Paste your URL and anon key into `.env`.

### 6. Install and run locally
```bash
npm install
npm run dev
```
Open the URL it prints (usually `http://localhost:5173`).

### 7. Deploy
Push this repo to GitHub, then import it on [vercel.com](https://vercel.com)
(or Netlify). Add the same two environment variables
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the host's project
settings — `.env` itself is gitignored and won't be deployed automatically.

## Project structure

```
supabase/schema.sql       — full DB schema + RLS policies (run once in Supabase)
src/lib/                  — Supabase client, design tokens, pure schedule math
src/hooks/                — data layer: auth, project list, project data + realtime
src/components/           — CueRow, DayTabs, NotesPanel, InvitePanel, etc.
src/pages/                — LoginPage, ProjectsPage, ShowPage
src/App.jsx                — top-level routing between the three pages above
```

## Local verification already done

This scaffold was built and checked before handoff:
- `npm run build` — production build succeeds cleanly
- `npm run lint` — ESLint with `eslint-plugin-react-hooks` passes with no errors
- The SQL schema was structurally checked (balanced delimiters, every policy
  targets a table that's actually created) — it has **not** been run against a
  live Postgres instance yet, since this sandbox can't reach Supabase. You'll
  be the first real test of it — if something in the SQL Editor errors, paste
  it back here and I'll fix it.


## Try the design without touching real data

With the dev server running (`npm run dev`), open `http://localhost:5173/demo.html`. It loads sample data
(the SC Vizio schedule) with no Supabase connection, so you can edit cues, add notes, switch the
"View as" position at the bottom left, and flip between the desk and booth themes. Nothing is saved.
The live cue follows your computer's clock, so it only highlights while the clock is inside the sample day.

Add `?page=projects` for the shows list or `?page=login` for the sign-in screen.


## Install as a desktop app

OnCue is an installable web app (PWA). Once it is served over HTTPS (your Vercel site) or from localhost:

- **Chrome or Edge:** click the install icon at the right end of the address bar, or open the browser menu and choose Install OnCue.
- **Safari on Mac (Sonoma or later):** File, then Add to Dock.

To try it locally before deploying: `npm run build`, then `npm run preview`, and open the address it prints (usually `http://localhost:4173`).
The app shell is cached, but show data always comes live from Supabase, so you need a connection.

## Desktop app (Mac and Windows)

`desktop/` is a small Electron wrapper around the hosted app. It opens OnCue in its own window with its own icon, keeps the screen awake while you call a show, and shows a "Can't reach OnCue" screen with automatic retry if the internet drops. Because it loads the live site, every Vercel deploy reaches the desktop app with no new download.

The installers are built for free on GitHub's cloud machines, so you don't need a Mac and a PC:

1. Push this project to GitHub (including `.github/workflows/desktop.yml`).
2. On GitHub, open the repo's **Actions** tab, choose **Desktop apps**, click **Run workflow**.
3. After about 10 minutes, open the finished run and download **OnCue-macos-latest** (a `.dmg`) and **OnCue-windows-latest** (an `.exe`) from the Artifacts list.

To publish them as a Release with permanent download links, push a tag instead: `git tag desktop-v1.0.0 && git push origin desktop-v1.0.0`.

The app points at `https://on-cue-chi.vercel.app/`. To change it, edit `desktop/config.json`.

To try it on your own machine: `cd desktop && npm install && npm start`.

The installers aren't code-signed (signing costs money: $99 a year for Apple, a paid certificate for Windows), so each OS warns the first time:

- **Mac:** open the `.dmg`, drag OnCue to Applications, then right-click the app and choose **Open**, then **Open** again.
- **Windows:** run the `.exe`. If a blue "Windows protected your PC" box appears, click **More info**, then **Run anyway**.
