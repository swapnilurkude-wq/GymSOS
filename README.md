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

**Super admin**
- Platform dashboard: MRR, active gyms, member totals, alerts
- Gym management: create gyms, change plans, suspend, issue credentials
- Revenue analytics by plan, revenue trend, plan mix
- Subscription management, platform-wide receipt ledger

**Platform**
- Responsive on mobile, tablet, and laptop
- Dark / light theme
- Code-split bundles (maps, Excel, PDF load on demand)
- 98 automated tests (`npm test`) — including the Supabase data-layer
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

### 5. Deploy the owner-invite Edge Function

The super-admin gym form creates owner logins through a
server-side function (the service role key never reaches the
browser):

```bash
supabase functions deploy invite-gym-owner
```

It verifies the caller's JWT, requires the `super-admin` role,
creates (or updates) the auth user, and links the profile to
the gym — so the whole invite flow works from the app.

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
  functions/    Edge Functions (invite-gym-owner)
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

With `VITE_SUPABASE_*` set, all data (gyms, members, receipts,
templates, preferences, notification reads) lives in Postgres and
every user signs in through Supabase Auth. Demo mode
(localStorage + seeded data) still runs with no environment
variables, but **only in development** (`npm run dev`, `npm test`)
— a production build without Supabase configured shows a
configuration error instead of silently using browser storage.

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
- Passwords are stored by Supabase Auth (SCRAM-hashed) — never in the app.
- The anon key is safe to expose; it is guarded by RLS. The service role key
  never leaves the server.
