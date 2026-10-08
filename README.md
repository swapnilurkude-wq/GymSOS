# GymSOS — Gym Management SaaS

A dashboard for gym owners (members, payments, receipts, reports) and a
platform super-admin (gyms, plans, revenue analytics, subscriptions).

## Features

**Gym owner**
- Member management: add/edit/delete, Excel import/export, receipt numbers
- Payment collection with cash/online split, balances, and follow-ups
- Receipts: print or download PDF, per-gym receipt template
- Dashboard KPIs, revenue trend, plan mix, renewal and payment alerts
- Plan-gated features (trial / starter / growth / pro)
- **Self-signup with a 10-day free trial** — public signup
  page, automatic account + gym creation, trial countdown on
  the dashboard, upgrade screen after expiry

**Super admin**
- Platform dashboard: MRR, active gyms, member totals, alerts
- Gym management: create gyms, change plans, suspend, issue credentials
- Revenue analytics by plan, revenue trend, plan mix
- Subscription management, platform-wide receipt ledger
- **Trial overview** — signup counts, active / expiring /
  expired trials, and a full Trial Signups table (gym, owner,
  mobile, email, signup + trial dates, status)

**Platform**
- Responsive on mobile, tablet, and laptop
- Dark / light theme
- Code-split bundles (maps, Excel, PDF load on demand)
- 116 automated tests (`npm test`) — including the Supabase data-layer
  paths, exercised against an in-memory client
  (`src/test/supabase-mock.ts`)

## Tech stack

React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · Radix UI · Recharts ·
jsPDF · SheetJS · Vitest · **Supabase** (Postgres + Auth + RLS) · **Vercel**

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm test           # run the test suite
npm run build      # type-check + production build
npm run lint       # oxlint
```

**Demo mode (development only):** with no environment variables
set, `npm run dev` and `npm test` run entirely client-side using
`localStorage` and seed demo data automatically. Production builds
require `VITE_SUPABASE_*` — see the migration plan below.

| Role        | Email              | Password    |
| ----------- | ------------------ | ----------- |
| Super admin | admin@gymsos.demo  | DemoAdmin@123 |
| Gym owner   | owner@ironpulse.com | Owner@123   |

## Deploying for production

### 1. Create the Supabase project

1. [supabase.com](https://supabase.com) → **New project** (set a database password)
2. **SQL Editor** → run the migrations **in order**:
   - `supabase/migrations/0001_init.sql` (tables, RLS, triggers)
   - `supabase/migrations/0002_profile_email_and_counters.sql` (profile email sync, atomic receipt counters)
   - `supabase/migrations/0003_trial_access.sql` (trial gate, signup RPC, owner-mobile uniqueness)
   - `supabase/migrations/0004_member_gender_undisclosed.sql` (fourth gender option: "Prefer not to say")
3. **SQL Editor** → run `supabase/seed.sql` (demo gyms, members, template, counters)

### 2. Create the login accounts

Supabase dashboard → **Authentication → Users → Add user**:

- `admin@gymsos.demo` — password `DemoAdmin@123` — **Auto-confirm** ✔
- `owner@ironpulse.com` — password `Owner@123` — **Auto-confirm** ✔

Then run `supabase/link-demo-profiles.sql`, which upgrades those
rows to their demo roles and gym assignments (the RLS policies
read role and gym from the profiles table).

### 3. Copy the API keys

Supabase dashboard → **Project Settings → API** → copy **Project URL** and
**anon / public key**.

### 4. Deploy to Vercel

Push the repo to GitHub, then import it in [vercel.com](https://vercel.com).
Add environment variables:

| Variable               | Value                |
| ---------------------- | -------------------- |
| `VITE_SUPABASE_URL`    | Project URL          |
| `VITE_SUPABASE_ANON_KEY` | anon / public key  |

Or deploy from the CLI:

```bash
npm i -g vercel
vercel --prod
```

The SPA is configured in `vercel.json` (Vite framework, client-side routing
rewrites).

### 5. Deploy the Edge Functions

Two server-side functions (the service role key never
reaches the browser):

```bash
supabase functions deploy invite-gym-owner
supabase functions deploy gym-owner-signup
```

- **invite-gym-owner** — the super-admin gym form creates
  owner logins through it. It verifies the caller's JWT,
  requires the `super-admin` role, creates (or updates) the
  auth user, and links the profile to the gym.
- **gym-owner-signup** — the public signup page
  (`/signup`) creates a new gym owner's account, their gym
  and a 10-day free trial entirely server-side. It is
  called with the anon key (Supabase verifies it as the
  "anon" role), validates every field, rejects duplicate
  emails and mobiles, and computes the trial end from SQL
  `now()` — never from the browser. The auth trigger
  assigns the `gym-owner` role, so a public signup can
  never become a super-admin.

### 6. Preview (staging) deployments

Once the repo is Git-connected, Vercel builds a **preview
deployment for every pull request**, automatically, with the
same environment variables as production. Ship changes through
PRs and verify them on the preview URL before they reach
production — that is your staging environment.

## Architecture

```
src/
  components/   UI primitives (Radix + Tailwind) and feature components
  context/      Auth + theme providers
  hooks/        React data hooks (one per entity)
  lib/          Data layer — every read/write goes through here
  pages/        Routes (gym-owner/*, super-admin/*, auth/*)
  test/         Test helpers + in-memory Supabase client
  types/        Shared TypeScript types (single source of truth)
supabase/
  migrations/   Schema with row-level security
  functions/    Edge Functions (invite-gym-owner, gym-owner-signup)
  seed.sql      Demo data
  link-demo-profiles.sql  Attaches demo auth users to profiles
.github/workflows/
  db-backup.yml Nightly pg_dump → 30-day artifact retention
```

## Migration plan to production data

| Phase | Scope | Status |
| ----- | ----- | ------ |
| 1 | Supabase schema + RLS + seed, Vercel pipeline, deploy docs | ✅ done |
| 2 | Auth via Supabase Auth (`profiles` table); `src/lib/*` data modules dual-mode (Supabase when `VITE_SUPABASE_*` is set, localStorage otherwise); async hooks with loading states | ✅ done |
| 3 | Owner-invite Edge Function, nightly pg_dump backups, Vercel preview (staging) deployments | ✅ done |
| 4 | Cutover: localStorage is development-only — production builds require `VITE_SUPABASE_*` and refuse to start unconfigured; server-side backups replace the in-app export | ✅ done |
| 5 | Gym Owner self-signup with a 10-day free trial: public `/signup` page, `gym-owner-signup` Edge Function, DB-level trial gate (`0003`), trial banner + upgrade screen, super-admin trial overview | ✅ done |

With `VITE_SUPABASE_*` set, all data (gyms, members, receipts,
templates, preferences, notification reads) lives in Postgres and
every user signs in through Supabase Auth. Demo mode
(localStorage + seeded data) still runs with no environment
variables, but **only in development** (`npm run dev`, `npm test`)
— a production build without Supabase configured shows a
configuration error instead of silently using browser storage.

**How the 10-day trial works:** a signup creates a gym with
`plan = 'trial'` and `subscription_end_date = now() + 10 days`
(computed in Postgres). While the trial is live the owner gets the
full dashboard plus a countdown banner. When the end date passes:
- the RLS policies (via `gym_access_ok()`) block the gym's
  members / payments / receipts at the **database** level — no
  frontend-only check, and the date can't be moved by changing
  device settings;
- the app shows an upgrade screen (₹499/month, WhatsApp /
  contact admin) instead of the dashboard;
- all data stays intact. The Super Admin activates the gym from
  **Subscriptions → Renew / Change Plan** and access is restored
  immediately.

## Backups

- **Nightly:** `.github/workflows/db-backup.yml` runs `pg_dump`
  at 02:00 UTC and keeps 30 days of restorable archives as
  GitHub Actions artifacts. Requires a `SUPABASE_DB_URL`
  repository secret — the **direct** connection string from
  Supabase dashboard → Project Settings → Database
  (not the pooler URL).
- **Point-in-time recovery:** Supabase Pro plans add 7-day
  restore-to-a-timestamp from the dashboard — use it as the
  primary safety net, with the nightly dumps as exports.
- **Restore:** download the artifact and run
  `pg_restore --clean --if-exists --db-url "$SUPABASE_DB_URL" backup.dump`.

## Security notes

- Every table has row-level security; gym owners can only touch their own
  gym's rows, super-admins the whole platform (see `0001_init.sql`).
- Passwords are stored by Supabase Auth (SCRAM-hashed) — never in the app,
  and never visible to the super admin (the signup and invite flows
  hand the password to Supabase Auth once, over HTTPS).
- The anon key is safe to expose; it is guarded by RLS. The service role key
  never leaves the server.
- Trial expiry is enforced by RLS (`gym_access_ok()` in
  `0003_trial_access.sql`) against the Postgres clock — a gym owner
  cannot extend a trial from the browser, and an expired trial
  loses access to members, payments and receipts at the database
  level. Paid plans are unaffected.
- A public signup always receives the `gym-owner` role — it is
  assigned by the `handle_new_user()` trigger server-side, and the
  signup form has no role field.
