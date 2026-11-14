# Maydan handoff (14 November 2026)

## Live URL

**https://maydan-kw.onrender.com** (Render static site `maydan-kw`, auto-deploys from `main` of the private repo
`github.com/mbqalsarraf/maydan`). Verified after deploy: the page opens without a session, Explore and Services load live
data, no console errors, and the bundle contains no secret keys. The sign-up, booking and host flows were clicked through
on the local build only, not yet on this URL.

## Verified (actually run)

- Type-check and production build pass.
- 21 unit tests pass (quote comparison, currency conversion and formatting, planner rules).
- 34 live backend checks pass against the real project, including:
  - two users racing for the last seat: exactly one succeeds, the other is told it is full;
  - six identical confirm clicks: one reservation, one reference;
  - cancelling twice at once restores capacity exactly once;
  - past sessions, ineligible ages and overlapping bookings for the same participant are refused;
  - account B cannot read, cancel or change account A's reservation, even with the booking reference;
  - a normal user cannot grant themselves host access, edit a listing, list participants or mark attendance;
  - saving a plan reserves nothing; plans are private; a user cannot submit a "verified" price report.
- In a browser (local site, real backend): registration and sign-in; reserving "Family Pottery Morning" with a double
  click on Confirm (one reservation, reference shown); My Bookings after a full reload; quote comparison (within/above
  range with the demo label, and "Not enough comparable price reports" when inclusions change); Surprise plan from real
  sessions; AI unavailable message with fallback; host dashboard participants and attendance; USD display with the
  "illustrative demo rate" label; Arabic right-to-left on a 375 px phone width with no sideways scrolling.

## Not verified

- **Real AI call**: the endpoint is deployed but `ANTHROPIC_API_KEY` is not set, so no successful model call has been made.
  AI mode must be treated as unverified until one succeeds.
- **XE rates**: not implemented. Only `disabled` and `demo` modes exist; the `xe` mode has a data slot but no adapter.
- QR code rendering on a deployed origin (it is deliberately hidden on localhost).
- Booking a provider appointment and cancelling a booking through the screens (both are covered by the backend checks, not clicked through).
- Publishing a listing and adding a session through the host form; saving and restoring a plan through the screen.
- iPhone Safari on a real device; screen readers.

## To finish

1. Click through sign-up, a reservation and the host dashboard (including the QR code) on the live URL.
2. Add `ANTHROPIC_API_KEY` in Supabase → Edge Functions → Secrets, then run one AI plan.
3. Re-run the three check commands in the README against the deployed site.

## Feature 1 submission: discover and register

- **Purpose:** a resident chooses a published session and gets a saved reservation with a unique reference; availability updates for everyone.
- **Click path:** Explore → "Family Pottery Morning" → View and reserve → choose "Fri 20 Nov, 10:00" → Who is taking part → Continue → Confirm reservation → reference appears → View My Bookings.
- **Exact seeded workshop title:** `Family Pottery Morning` (adults-only test: `Sourdough Baking Workshop (Adults)`).
- **Test steps:**
  1. Create an account (Sign in → "New here? Create an account").
  2. Reserve as above; note the reference (format `MYD-XXXX-XXXX`) and that places left drops by one.
  3. Refresh the page, then sign out and sign in again: the booking and reference are still in My Bookings.
  4. Cancel booking → places left returns to the previous number.
  5. Open "Sourdough Baking Workshop (Adults)": only "Adult (18+)" can be selected.
- **Screenshots to capture on the deployed site** (none were saved from this session): (1) Explore with the activity cards,
  (2) the "Your reservation is confirmed" panel with the reference, (3) My Bookings showing the same reference after a refresh.

## 90-second demonstration script

1. (10 s) "Maydan helps people in Kuwait find things to do, check a service quote and plan a weekend." Show Explore; switch to العربية and back.
2. (25 s) Open Family Pottery Morning, pick a session, choose "Child, 6–9" (guardian books, no child details), Confirm. Point at the reference; open My Bookings; refresh.
3. (20 s) Services → AC cleaning → enter 11 KWD → "Above reported range", labelled "Demo comparison using sample data", with sample size and dates. Untick call-out → "Not enough comparable price reports".
4. (25 s) My Plan → tick Arts and Family, budget 20 → "Surprise me" (random, not AI) → Swap one block → Save plan. Say: nothing is reserved until "Book this".
5. (10 s) Switch currency to USD: original KWD price stays first, converted amount is marked illustrative.

## Known limitations

- All listings, hosts, providers, prices and price reports are fictional; the reference range is an MVP rule (5+ reports), not proof of fair value.
- Sign-up does not verify email ownership (pilot choice so judges can register instantly; disclosed on the form). No password reset.
- Exchange rates are static illustrative samples; XE is not connected.
- One saved plan per account. The 30-minute gap between venues is a planning assumption, not a travel estimate.
- Service slots are fixed one-hour appointments, Sunday–Thursday 09:00–17:00, seeded two weeks ahead (`select public.seed_demo();` adds more).
- Hosts can publish in KWD only from the form; no listing photos; no maps, chat, payments or notifications.

## Parallel team tasks (no competing file edits)

- **Builder:** owns `~/maydan` code, deployment and secrets.
- **Teammate 2 (content and customer tests):** read every Arabic string on Explore, Services and My Plan and send corrections as a list; run the Feature 1 test steps on a phone; try to break booking with two phones on the last seat.
- **Teammate 3 (host and pitch):** register, send the email to the builder for host access, then test Host Dashboard (publish a listing, add a session, mark attendance, scan the QR code); rehearse the 90-second script.
