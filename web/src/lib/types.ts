export const CURRENCIES = ['KWD', 'SAR', 'AED', 'QAR', 'BHD', 'OMR', 'USD'] as const
export type Currency = (typeof CURRENCIES)[number]
export const BANDS = ['adult', 'teen_14_17', 'child_10_13', 'child_6_9', 'child_3_5'] as const
export type Band = (typeof BANDS)[number]
export const BAND_RANGE: Record<Band, [number, number | null]> = {
  adult: [18, null], teen_14_17: [14, 17], child_10_13: [10, 13], child_6_9: [6, 9], child_3_5: [3, 5],
}
export const CATEGORIES = ['arts', 'food', 'sports', 'outdoors', 'learning', 'family', 'home'] as const
export const AREAS = ['Salmiya', 'Hawalli', 'Jabriya', 'Kuwait City', 'Shuwaikh', 'Mishref', 'Fahaheel'] as const

export type Host = {
  id: string; slug: string; kind: 'host' | 'provider'; name_en: string; name_ar: string
  about_en: string; about_ar: string; area: string; is_demo: boolean
}
export type Occurrence = {
  id: string; listing_id: string; starts_at: string; ends_at: string; capacity: number; booked_count: number; status: string
}
export type Listing = {
  id: string; host_id: string; type: 'event' | 'course' | 'workshop' | 'service'
  title_en: string; title_ar: string; description_en: string; description_ar: string
  category: string; area: string; price_amount: number; price_currency: Currency
  min_age: number; max_age: number | null; level: string; is_flexible: boolean; duration_minutes: number
  service_def_id: string | null; inclusions_en: string; inclusions_ar: string; exclusions_en: string; exclusions_ar: string
  includes_parts: boolean; includes_callout: boolean; status: string; is_demo: boolean
  host?: Host; occurrences?: Occurrence[]
}
export type ServiceDef = {
  id: string; slug: string; name_en: string; name_ar: string; scope_en: string; scope_ar: string; unit_en: string; unit_ar: string
}
export type Reservation = {
  id: string; reference: string; occurrence_id: string; participant_band: Band; status: 'confirmed' | 'cancelled'
  price_amount: number; price_currency: Currency; attended_at: string | null; created_at: string; cancelled_at: string | null
  occurrence?: Occurrence & { listing?: Listing }
}

export function bandEligible(band: Band, minAge: number, maxAge: number | null): boolean {
  const [lo, hi] = BAND_RANGE[band]
  return lo >= minAge && (maxAge === null || (hi ?? 999) <= maxAge)
}
/** A session can still be booked: fixed sessions before they start, flexible content until its access window ends. */
export function isUpcoming(o: Occurrence, flexible: boolean, now = Date.now()): boolean {
  if (o.status !== 'scheduled') return false
  return flexible ? Date.parse(o.ends_at) > now : Date.parse(o.starts_at) > now
}
