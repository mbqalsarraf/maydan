# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Residents of Kuwait, families, students, and local hosts/providers. Parents or guardians manage bookings for younger
participants by choosing an age band; children never have their own accounts. Judges at a hackathon are an immediate
audience: they register on the public URL and book a seeded workshop.

## Product Purpose

Maydan | ميدان helps people in Kuwait discover and book local activities, compare everyday service quotes, and organise
their free time into a personalised weekend plan. Success: a visitor reserves a real place with a saved reference, gets
an honest answer about a quote, and leaves with a plan built from real listings.

## Positioning

One local place that joins three everyday jobs: booking a seat at a real session, checking a service quote like for like
(with an explicit "not enough reports" answer instead of a guess), and turning free time into a checked plan that never
reserves anything by itself.

## Operating Context

Used on iPhone Safari and laptops, in Arabic (RTL) or English, in Kuwait time. Pilot listings are in Kuwait only.
Currency display is a preference (KWD, SAR, AED, QAR, BHD, OMR, USD); original prices always apply and no payments are taken.

## Capabilities and Constraints

- Feature 1: discover and register (sessions, capacity, references, My Bookings, cancellation, host participants and attendance).
- Feature 2: service quote comparison (25th–75th percentile with at least five comparable reports; otherwise "Not enough comparable price reports"), provider slots Sun–Thu 09:00–17:00.
- Feature 3: weekend planner (manual, AI via server, "Surprise me" random), validated in app code.
- Stack: Vite + React + TypeScript site, Supabase (Postgres, Auth, Edge Functions). Hosted on Replit.
- Deferred: payments, maps, chat, push, native apps, multi-country.

## Brand Commitments

- Name: Maydan | ميدان. Supplied standalone MAYDAN serif wordmark (`web/public/maydan-logo.webp`), used as supplied, proportions kept, not redesigned.
- Colours: forest green #173F35, warm ivory #F4F0E8, charcoal #232624, restrained sand #B09462.
- Tone: a welcoming, practical Kuwaiti community website. Accessible body type, large touch targets, visible labels and focus. No automatic motion needed.

## Evidence on Hand

All hosts, providers, listings, prices and price reports are fictional demo data and must stay labelled as such.
There are no real photographs, testimonials, customers, partners or statistics; none may be invented.

## Product Principles

1. Honest by default: label sample data, say "not enough evidence", never simulate success.
2. Real records over promises: every confirmation, plan and attendance mark is a saved action.
3. Bilingual as equals: Arabic RTL is a first-class layout, not a translation layer.
4. Families first: guardians book for children without sharing child data.

## Accessibility & Inclusion

Large touch targets (44px+), visible labels and focus states, readable body text on phones, works without motion.
