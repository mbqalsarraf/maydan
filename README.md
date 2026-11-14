# Maydan | ميدان

Pilot website for Kuwait: discover and book local activities, compare everyday service quotes, and build a weekend plan.
**Everything in the catalogue is fictional demo data** and is labelled as such. No payments are processed.

| Part | Where | Tech |
|---|---|---|
| Website (Arabic/English, RTL, mobile) | `web/` | Vite, React 19, TypeScript, supabase-js; hosted on Replit (static `web/dist`) |
| Database, auth, row-level security, atomic booking | `supabase/migrations/` | Supabase Postgres + Auth |
| Sign-up endpoint, AI planner endpoint | `supabase/functions/` | Supabase Edge Functions (Deno) |

Supabase project: `maydan` (ref `awkgbpkihfyothhxuaki`, region ap-south-1, free plan).

## Design

`PRODUCT.md` holds product truth; `.impeccable/surfaces/` holds the home page's design direction (the co-op weekly sheet).
Type: self-hosted Urbanist (Latin) and Readex Pro (Arabic). Colours are the pinned brand colours.

## Run locally

```bash
cd web
cp .env.example .env      # fill in the project URL and the publishable key (both are public values)
npm install
npm run dev
```

## Database: migrations and seed

1. Apply `supabase/migrations/0001_schema.sql`, then `0002_seed_demo.sql` (SQL editor or `supabase db push`).
2. Seed or top up demo data at any time (idempotent; adds upcoming sessions for the next 3 weeks):
   `select public.seed_demo();`
3. Deploy the functions in `supabase/functions/` (`register`, `plan-ai`), both with JWT verification off (they check callers themselves).

## Secrets

Names are in `.env.example`. Set them in **Supabase Dashboard → Edge Functions → Secrets**. The browser bundle only ever
contains the project URL and the publishable key.

- `ANTHROPIC_API_KEY`: required for "Suggest with AI". Without it the planner shows a clear "not configured" message and
  the manual and Surprise modes keep working.

## Giving someone host access (secure)

Host access cannot be self-assigned (no client write access to `host_members`). An administrator runs, in the SQL editor,
after the person has registered on the site:

```sql
insert into public.host_members (host_id, user_id)
select h.id, u.id from public.hosts h, auth.users u
where h.slug = 'dar-alteen' and u.email = 'person@example.com';
```

Host slugs: `dar-alteen`, `khubz-kitchen`, `mishref-youth`, `shatti-volunteers`, `qalam-arts`, `adasa-learning`.
The person then sees **Host Dashboard** after signing in again.

## Checks

```bash
cd web
npm run build                                        # type-check + production build
npx vitest run                                       # 21 rule tests: comparison, currency, planner
node --env-file=.env tests/backend.test-script.mjs   # 34 live checks; apply supabase/tests/fixtures.sql first, cleanup.sql after
```

## Key rules (where to look)

- Booking: `public.reserve()` and `public.cancel_reservation()` in `0001_schema.sql`. Capacity, duplicate prevention,
  provider slot uniqueness, idempotency and cancellation are enforced inside one database transaction.
- Quote comparison: `web/src/lib/compare.ts`. 25th–75th percentile, only with at least 5 comparable reports.
- Planner: `web/src/lib/planner.ts`. Every plan (manual, AI or random) is validated here; planning reserves nothing.
- Currency: `fx_snapshots` + `app_settings.fx_mode` (`disabled` | `demo` | `xe`), read by `web/src/lib/app.tsx`.
  To switch conversion off: `update public.app_settings set value = '"disabled"' where key = 'fx_mode';`

See [docs/HANDOFF.md](docs/HANDOFF.md) for what is verified, the Feature 1 submission, the demo script and known limitations.
