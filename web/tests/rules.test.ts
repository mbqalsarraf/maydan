import { describe, expect, it } from 'vitest'
import { MIN_REPORTS, compareQuote, percentile, type Report } from '../src/lib/compare'
import { convertWith, formatMoney, type FxSnapshot } from '../src/lib/app'
import { explainInfeasible, repairPlan, surprisePlan, validatePlan, type Candidate, type Prefs } from '../src/lib/planner'

const noFx = () => null
const rep = (amount: number, o: Partial<Report> = {}): Report => ({ amount, currency: 'KWD', area: 'Salmiya', includes_parts: false,
  includes_callout: true, observed_on: '2026-11-01', source_type: 'demo_sample', verification: 'demo', is_demo: true, ...o })
const q = { amount: 8, currency: 'KWD', area: null, includes_parts: false, includes_callout: true, includeUnverified: false }
const today = new Date('2026-11-14')

describe('quote comparison', () => {
  const nine = [6, 7, 7.5, 8, 8, 9, 10, 10, 12].map(a => rep(a))
  it('percentile interpolates', () => { expect(percentile([1, 2, 3, 4], 0.25)).toBe(1.75); expect(percentile([5], 0.75)).toBe(5) })
  it('labels below / within / above against the 25th-75th percentile', () => {
    const r = compareQuote(q, nine, today, noFx)
    expect([r.p25, r.p75, r.n]).toEqual([7.5, 10, 9])
    expect(r.status).toBe('within')
    expect(compareQuote({ ...q, amount: 7 }, nine, today, noFx).status).toBe('below')
    expect(compareQuote({ ...q, amount: 10.5 }, nine, today, noFx).status).toBe('above')
  })
  it('flags synthetic data', () => expect(compareQuote(q, nine, today, noFx).usesDemoData).toBe(true))
  it('rejects incomparable reports (different inclusions) and reports insufficiency', () => {
    const r = compareQuote({ ...q, includes_callout: false }, nine, today, noFx)
    expect(r.status).toBe('insufficient'); expect(r.n).toBe(0); expect(r.excluded.differentInclusions).toBe(9); expect(r.p25).toBeNull()
  })
  it(`needs at least ${MIN_REPORTS} reports`, () => {
    expect(compareQuote(q, nine.slice(0, 4), today, noFx).status).toBe('insufficient')
    expect(compareQuote(q, nine.slice(0, 5), today, noFx).status).not.toBe('insufficient')
  })
  it('area filter narrows the evidence', () => {
    const r = compareQuote({ ...q, area: 'Hawalli' }, nine, today, noFx)
    expect(r.status).toBe('insufficient'); expect(r.excluded.differentArea).toBe(9)
  })
  it('self-reported amounts are excluded unless explicitly included', () => {
    const mixed = [...nine.slice(0, 4), rep(9, { source_type: 'self_reported', verification: 'unverified', is_demo: false })]
    expect(compareQuote(q, mixed, today, noFx).status).toBe('insufficient')
    const inc = compareQuote({ ...q, includeUnverified: true }, mixed, today, noFx)
    expect(inc.n).toBe(5); expect(inc.sources.self_reported).toBe(1)
  })
  it('never fabricates a conversion: other-currency reports are dropped without rates', () => {
    const r = compareQuote({ ...q, currency: 'USD' }, nine, today, noFx)
    expect(r.status).toBe('insufficient'); expect(r.excluded.noConversion).toBe(9)
  })
  it('old reports are excluded', () => expect(compareQuote(q, nine.map(r => ({ ...r, observed_on: '2025-01-01' })), today, noFx).excluded.tooOld).toBe(9))
})

describe('currency', () => {
  const snap: FxSnapshot = { mode: 'demo', source: 's', base: 'USD', rates: { USD: 1, KWD: 0.307, SAR: 3.75 }, effective_at: '', fetched_at: '', refresh_policy: '', note: '' }
  it('amount x target / source at full precision', () => expect(convertWith(snap, 10, 'KWD', 'SAR')).toBeCloseTo((10 * 3.75) / 0.307, 10))
  it('same currency needs no rate; missing rate or snapshot gives null', () => {
    expect(convertWith(null, 5, 'KWD', 'KWD')).toBe(5); expect(convertWith(null, 5, 'KWD', 'USD')).toBeNull(); expect(convertWith(snap, 5, 'KWD', 'AED')).toBeNull()
  })
  it('uses currency-aware decimals', () => { expect(formatMoney(6, 'KWD', 'en')).toContain('6.000'); expect(formatMoney(6, 'USD', 'en')).toContain('6.00') })
})

describe('planner', () => {
  const now = Date.parse('2026-11-14T06:00:00Z')
  const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 20, h, m)).toISOString()
  const cand = (id: string, s: string, e: string, o: Partial<Candidate> = {}): Candidate => ({ occurrence_id: id, listing_id: 'L' + id, host_id: 'H' + id, type: 'event',
    title_en: id, title_ar: id, category: 'arts', area: 'Salmiya', is_flexible: false, starts_at: s, ends_at: e, duration_minutes: 60,
    price_amount: 5, price_currency: 'KWD', min_age: 3, max_age: null, seats_left: 3, ...o })
  const prefs: Prefs = { interests: [], area: null, band: 'adult', budget: null, budget_currency: 'KWD', windows: [{ start: at(5), end: at(19) }] }
  const opts = { bufferMinutes: 30, convert: noFx, now }
  const A = cand('a', at(7), at(8)), B = cand('b', at(7, 30), at(8, 30)), C = cand('c', at(8, 10), at(9)), D = cand('d', at(9), at(10))
  const codes = (items: Candidate[], p = prefs) => validatePlan(items, p, opts).issues.map(i => i.code)

  it('accepts a valid plan and totals it', () => { const v = validatePlan([A, D], prefs, opts); expect(v.ok).toBe(true); expect(v.total).toBe(10) })
  it('detects overlap and the venue buffer', () => { expect(codes([A, B])).toContain('overlap'); expect(codes([A, C])).toContain('buffer') })
  it('no buffer needed at the same host', () => expect(codes([A, { ...C, host_id: A.host_id }])).toEqual([]))
  it('enforces budget, eligibility, capacity, time window and past sessions', () => {
    expect(codes([A, D], { ...prefs, budget: 9 })).toContain('over_budget')
    expect(codes([{ ...A, min_age: 18 }], { ...prefs, band: 'child_6_9' })).toContain('not_eligible')
    expect(codes([{ ...A, seats_left: 0 }])).toContain('full')
    expect(codes([A], { ...prefs, windows: [{ start: at(12), end: at(19) }] })).toContain('outside_time')
    expect(codes([cand('p', '2026-11-13T07:00:00Z', '2026-11-13T08:00:00Z')])).toContain('started')
  })
  it('mixed-currency budget without rates is reported, not guessed', () => expect(codes([{ ...A, price_currency: 'USD' }], { ...prefs, budget: 100 })).toContain('fx_unavailable'))
  it('flexible content does not conflict with fixed events', () => expect(codes([A, cand('f', at(0), at(23), { is_flexible: true })])).toEqual([]))
  it('repair keeps valid items and drops rule-breakers', () => {
    const r = repairPlan([A, B, D], prefs, opts); expect(r.kept.map(c => c.occurrence_id)).toEqual(['a', 'd']); expect(r.dropped).toHaveLength(1)
  })
  it('surprise plans are always valid and use only real candidates', () => {
    for (let seed = 0; seed < 50; seed++) {
      let s = seed + 1; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647
      const plan = surprisePlan([A, B, C, D], { ...prefs, budget: 10 }, opts, rng)
      expect(plan.length).toBeGreaterThan(0); expect(validatePlan(plan, { ...prefs, budget: 10 }, opts).ok).toBe(true)
      expect(plan.every(p => [A, B, C, D].includes(p))).toBe(true)
    }
  })
  it('explains which constraint to relax when nothing fits', () => {
    expect(surprisePlan([A], { ...prefs, budget: 1 }, opts)).toEqual([])
    expect(explainInfeasible([A], { ...prefs, budget: 1 }, opts)).toEqual(['budget'])
    expect(explainInfeasible([A], { ...prefs, interests: ['food'] }, opts)).toEqual(['interests'])
  })
})
