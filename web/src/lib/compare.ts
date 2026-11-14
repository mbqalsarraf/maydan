// Deterministic, transparent quote comparison. Pure functions only (unit-tested).
// MVP product rule: a reference range is shown only with at least MIN_REPORTS comparable reports.
// The range is the 25th-75th percentile of reported amounts. It is illustrative, not proof of fair value.
export const MIN_REPORTS = 5
export const MAX_AGE_DAYS = 365

export type Report = {
  amount: number; currency: string; area: string; includes_parts: boolean; includes_callout: boolean
  observed_on: string; source_type: 'demo_sample' | 'self_reported'; verification: string; is_demo: boolean
}
export type QuoteInput = {
  amount: number; currency: string; area: string | null
  includes_parts: boolean; includes_callout: boolean; includeUnverified: boolean
}
export type Comparison = {
  status: 'insufficient' | 'below' | 'within' | 'above'
  n: number; p25: number | null; p75: number | null; min: number | null; max: number | null
  currency: string; dateFrom: string | null; dateTo: string | null
  sources: { demo_sample: number; self_reported: number }
  usesDemoData: boolean; usesConvertedAmounts: boolean
  excluded: { differentInclusions: number; differentArea: number; unverified: number; noConversion: number; tooOld: number }
}
type Convert = (amount: number, from: string, to: string) => number | null

/** Linear-interpolation percentile (the common "type 7" definition) on a sorted array. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) throw new Error('empty')
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

export function compareQuote(input: QuoteInput, reports: Report[], today: Date, convert: Convert): Comparison {
  const excluded = { differentInclusions: 0, differentArea: 0, unverified: 0, noConversion: 0, tooOld: 0 }
  const kept: { amount: number; r: Report }[] = []
  let converted = false
  for (const r of reports) {
    if (r.includes_parts !== input.includes_parts || r.includes_callout !== input.includes_callout) { excluded.differentInclusions++; continue }
    if (input.area && r.area !== input.area) { excluded.differentArea++; continue }
    if ((today.getTime() - Date.parse(r.observed_on)) / 86400000 > MAX_AGE_DAYS) { excluded.tooOld++; continue }
    if (r.source_type === 'self_reported' && !input.includeUnverified) { excluded.unverified++; continue }
    let amount: number | null = r.amount
    if (r.currency !== input.currency) { amount = convert(r.amount, r.currency, input.currency); converted = true }
    if (amount === null) { excluded.noConversion++; continue }
    kept.push({ amount, r })
  }
  const amounts = kept.map(k => k.amount).sort((a, b) => a - b)
  const dates = kept.map(k => k.r.observed_on).sort()
  const base = {
    n: kept.length, currency: input.currency, excluded,
    dateFrom: dates[0] ?? null, dateTo: dates[dates.length - 1] ?? null,
    sources: {
      demo_sample: kept.filter(k => k.r.source_type === 'demo_sample').length,
      self_reported: kept.filter(k => k.r.source_type === 'self_reported').length,
    },
    usesDemoData: kept.some(k => k.r.is_demo),
    usesConvertedAmounts: converted && kept.some(k => k.r.currency !== input.currency),
    min: amounts[0] ?? null, max: amounts[amounts.length - 1] ?? null,
  }
  if (kept.length < MIN_REPORTS || !(input.amount > 0)) return { ...base, status: 'insufficient', p25: null, p75: null }
  const p25 = percentile(amounts, 0.25), p75 = percentile(amounts, 0.75)
  const status = input.amount < p25 ? 'below' : input.amount > p75 ? 'above' : 'within'
  return { ...base, status, p25, p75 }
}
