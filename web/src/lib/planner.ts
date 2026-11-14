// Weekend planner rules. Pure functions (unit-tested). The AI and "Surprise me" modes only PROPOSE
// occurrence IDs; every plan is validated here before it is shown or saved. Planning reserves nothing.
import { bandEligible, type Band } from './types'

export type Candidate = {
  occurrence_id: string; listing_id: string; host_id: string; type: string
  title_en: string; title_ar: string; category: string; area: string
  is_flexible: boolean; starts_at: string; ends_at: string; duration_minutes: number
  price_amount: number; price_currency: string; min_age: number; max_age: number | null; seats_left: number
}
export type Window = { start: string; end: string }
export type Prefs = {
  interests: string[]; area: string | null; band: Band
  budget: number | null; budget_currency: string; windows: Window[]
}
export type IssueCode = 'not_eligible' | 'full' | 'started' | 'outside_time' | 'overlap' | 'buffer' | 'over_budget'
  | 'fx_unavailable' | 'duplicate'
export type Issue = { code: IssueCode; occurrence_id?: string; other_id?: string }
export type Convert = (amount: number, from: string, to: string) => number | null
export type Opts = { bufferMinutes: number; convert: Convert; now: number }
export type Validation = { ok: boolean; issues: Issue[]; total: number | null; totalsByCurrency: Record<string, number> }

const t = (iso: string) => Date.parse(iso)

/** Hard rules for one item on its own (age, seats, not started, inside the user's free time). */
export function itemIssues(c: Candidate, prefs: Prefs, now: number): IssueCode[] {
  const out: IssueCode[] = []
  if (!bandEligible(prefs.band, c.min_age, c.max_age)) out.push('not_eligible')
  if (c.seats_left <= 0) out.push('full')
  if (c.is_flexible ? t(c.ends_at) <= now : t(c.starts_at) <= now) out.push('started')
  const inWindow = prefs.windows.some(w => c.is_flexible
    ? t(c.starts_at) < t(w.end) && t(c.ends_at) > t(w.start)          // access window touches free time
    : t(c.starts_at) >= t(w.start) && t(c.ends_at) <= t(w.end))       // fixed session fits entirely
  if (!inWindow) out.push('outside_time')
  return out
}
/** Soft preference filter used for AI / Surprise candidates (not enforced on manual additions). */
export function matchesPreferences(c: Candidate, prefs: Prefs): boolean {
  if (prefs.interests.length ? !prefs.interests.includes(c.category) : c.type === 'service') return false
  if (prefs.area && c.area !== prefs.area && c.area !== 'Online') return false
  return true
}
export function eligibleCandidates(all: Candidate[], prefs: Prefs, now: number): Candidate[] {
  return all.filter(c => matchesPreferences(c, prefs) && itemIssues(c, prefs, now).length === 0)
}

export function validatePlan(items: Candidate[], prefs: Prefs, opts: Opts): Validation {
  const issues: Issue[] = []
  const seen = new Set<string>()
  for (const c of items) {
    if (seen.has(c.listing_id)) issues.push({ code: 'duplicate', occurrence_id: c.occurrence_id })
    seen.add(c.listing_id)
    for (const code of itemIssues(c, prefs, opts.now)) issues.push({ code, occurrence_id: c.occurrence_id })
  }
  // Fixed sessions keep their published times; they may not overlap, and different venues need the buffer.
  const fixed = items.filter(c => !c.is_flexible).sort((a, b) => t(a.starts_at) - t(b.starts_at))
  for (let i = 1; i < fixed.length; i++) {
    const a = fixed[i - 1], b = fixed[i]
    const gap = (t(b.starts_at) - t(a.ends_at)) / 60000
    if (gap < 0) issues.push({ code: 'overlap', occurrence_id: b.occurrence_id, other_id: a.occurrence_id })
    else if (a.host_id !== b.host_id && gap < opts.bufferMinutes) issues.push({ code: 'buffer', occurrence_id: b.occurrence_id, other_id: a.occurrence_id })
  }
  const totalsByCurrency: Record<string, number> = {}
  for (const c of items) totalsByCurrency[c.price_currency] = (totalsByCurrency[c.price_currency] ?? 0) + c.price_amount
  let total: number | null = 0
  for (const [cur, amt] of Object.entries(totalsByCurrency)) {
    const v = amt === 0 ? 0 : cur === prefs.budget_currency ? amt : opts.convert(amt, cur, prefs.budget_currency)
    if (v === null) { total = null; break }
    total += v
  }
  if (prefs.budget !== null) {
    if (total === null) issues.push({ code: 'fx_unavailable' })
    else if (total > prefs.budget + 1e-9) issues.push({ code: 'over_budget' })
  }
  return { ok: issues.length === 0, issues, total, totalsByCurrency }
}

/** Keep items in order, dropping any that would make the plan invalid. Used to repair AI proposals. */
export function repairPlan(items: Candidate[], prefs: Prefs, opts: Opts): { kept: Candidate[]; dropped: Candidate[] } {
  const kept: Candidate[] = [], dropped: Candidate[] = []
  for (const c of items) (validatePlan([...kept, c], prefs, opts).ok ? kept : dropped).push(c)
  return { kept, dropped }
}

/** Non-AI random selection constrained by schedule, budget, eligibility and capacity. */
export function surprisePlan(all: Candidate[], prefs: Prefs, opts: Opts, rng: () => number = Math.random, max = 4): Candidate[] {
  const pool = eligibleCandidates(all, prefs, opts.now)
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
  const plan: Candidate[] = []
  for (const c of pool) {
    if (plan.length >= max) break
    if (validatePlan([...plan, c], prefs, opts).ok) plan.push(c)
  }
  return plan.sort((a, b) => Number(a.is_flexible) - Number(b.is_flexible) || t(a.starts_at) - t(b.starts_at))
}

export type Relaxation = 'interests' | 'area' | 'budget' | 'time' | 'age'
/** When nothing fits, report which single constraint, if relaxed, would allow at least one item. */
export function explainInfeasible(all: Candidate[], prefs: Prefs, opts: Opts): Relaxation[] {
  const far: Window[] = [{ start: new Date(opts.now).toISOString(), end: new Date(opts.now + 365 * 86400000).toISOString() }]
  const tries: [Relaxation, Prefs][] = [
    ['interests', { ...prefs, interests: [] }], ['area', { ...prefs, area: null }], ['budget', { ...prefs, budget: null }],
    ['time', { ...prefs, windows: far }], ['age', { ...prefs, band: 'adult' }],
  ]
  return tries.filter(([, p]) => surprisePlan(all, p, opts, () => 0.5, 1).length > 0).map(([k]) => k)
}
