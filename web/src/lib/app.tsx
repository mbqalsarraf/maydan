import { createClient, type Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CURRENCIES, type Currency } from './types'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const supabase = createClient(SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)

export type Lang = 'en' | 'ar'
export type FxMode = 'disabled' | 'demo' | 'xe'
export type FxSnapshot = {
  mode: 'demo' | 'xe'; source: string; base: string; rates: Record<string, number>
  effective_at: string; fetched_at: string; refresh_policy: string; note: string
}
/** amount x targetRate / sourceRate, both from the same snapshot, full precision. Null when not possible. */
export function convertWith(snapshot: FxSnapshot | null, amount: number, from: string, to: string): number | null {
  if (from === to) return amount
  if (!snapshot) return null
  const a = snapshot.rates[from], b = snapshot.rates[to]
  if (!(a > 0) || !(b > 0) || !Number.isFinite(a) || !Number.isFinite(b)) return null
  return (amount * b) / a
}
export function formatMoney(amount: number, currency: string, lang: Lang): string {
  // Intl picks the right precision per currency (3 decimals for KWD/BHD/OMR, 2 for the others).
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-KW-u-nu-latn' : 'en-KW', { style: 'currency', currency, currencyDisplay: 'code' }).format(amount)
}

type Ctx = {
  lang: Lang; setLang: (l: Lang) => void; L: (en: string, ar: string) => string
  currency: Currency; setCurrency: (c: Currency) => void
  session: Session | null; authReady: boolean; hostIds: string[]
  fxMode: FxMode; fx: FxSnapshot | null; bufferMinutes: number
  convert: (amount: number, from: string, to: string) => number | null
  money: (amount: number, currency: string) => string
  dateTime: (iso: string) => string; day: (iso: string) => string; time: (iso: string) => string
}
const AppCtx = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(AppCtx)

const TZ = 'Asia/Kuwait'
// Only harmless display preferences are kept in the browser.
const pref = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const setPref = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } }

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(pref('maydan.lang') === 'ar' ? 'ar' : 'en')
  const [currency, setCurrencyState] = useState<Currency>(
    (CURRENCIES as readonly string[]).includes(pref('maydan.currency') ?? '') ? (pref('maydan.currency') as Currency) : 'KWD')
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [hostIds, setHostIds] = useState<string[]>([])
  const [fxMode, setFxMode] = useState<FxMode>('disabled')
  const [fx, setFx] = useState<FxSnapshot | null>(null)
  const [bufferMinutes, setBuffer] = useState(30)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id
  useEffect(() => {
    if (!uid) { setHostIds([]); return }
    supabase.from('host_members').select('host_id').then(({ data }) => setHostIds((data ?? []).map(r => r.host_id)))
  }, [uid])

  useEffect(() => {
    (async () => {
      const { data: settings } = await supabase.from('app_settings').select('key,value')
      const get = (k: string) => settings?.find(s => s.key === k)?.value
      const mode: FxMode = ['demo', 'xe'].includes(get('fx_mode')) ? get('fx_mode') : 'disabled'
      if (typeof get('venue_buffer_minutes') === 'number') setBuffer(get('venue_buffer_minutes'))
      setFxMode(mode)
      if (mode === 'disabled') return
      const { data } = await supabase.from('fx_snapshots').select('*').eq('mode', mode).order('effective_at', { ascending: false }).limit(1)
      setFx((data?.[0] as FxSnapshot) ?? null)
    })()
  }, [])

  const value = useMemo<Ctx>(() => {
    const loc = lang === 'ar' ? 'ar-KW-u-nu-latn' : 'en-GB'
    const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(loc, { timeZone: TZ, ...o })
    const dt = f({ weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
    const d = f({ weekday: 'long', day: 'numeric', month: 'short' })
    const tm = f({ hour: '2-digit', minute: '2-digit', hour12: false })
    return {
      lang, currency, session, authReady, hostIds, fxMode, fx, bufferMinutes,
      setLang: l => { setLangState(l); setPref('maydan.lang', l) },
      setCurrency: c => { setCurrencyState(c); setPref('maydan.currency', c) },
      L: (en, ar) => (lang === 'ar' ? ar : en),
      convert: (a, from, to) => convertWith(fxMode === 'disabled' ? null : fx, a, from, to),
      money: (a, c) => formatMoney(a, c, lang),
      dateTime: iso => dt.format(new Date(iso)), day: iso => d.format(new Date(iso)), time: iso => tm.format(new Date(iso)),
    }
  }, [lang, currency, session, authReady, hostIds, fxMode, fx, bufferMinutes])

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

/** Original price always shown first; a converted amount is added only when a usable rate exists. */
export function Price({ amount, currency: cur }: { amount: number; currency: string }) {
  const { money, currency, convert, fxMode, L } = useApp()
  if (amount === 0) return <span className="price">{L('Free', 'مجاناً')}</span>
  const conv = cur === currency ? null : convert(amount, cur, currency)
  return (
    <span className="price">
      {money(amount, cur)}
      {conv !== null && (
        <span className="approx"> ≈ {money(conv, currency)}{' '}
          <small>({fxMode === 'demo' ? L('illustrative demo rate', 'سعر صرف توضيحي') : L('converted', 'محوّل')})</small>
        </span>
      )}
    </span>
  )
}

export function kuwaitDayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}
/** Build a UTC instant from a Kuwait local date (YYYY-MM-DD) and time (HH:MM). Kuwait is UTC+3 all year. */
export function kuwaitToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+03:00`).toISOString()
}

const ERRORS: Record<string, [string, string]> = {
  not_authenticated: ['Please sign in first.', 'يرجى تسجيل الدخول أولاً.'],
  sold_out: ['Sorry, this session is now full.', 'عذراً، اكتملت المقاعد في هذه الجلسة.'],
  slot_unavailable: ['This provider is no longer free at that time. Please choose another slot.', 'المزوّد لم يعد متاحاً في هذا الوقت. اختر موعداً آخر.'],
  already_reserved: ['You already have a reservation for this session.', 'لديك حجز مؤكد لهذه الجلسة.'],
  time_conflict: ['This overlaps another confirmed booking for the same participant.', 'يتعارض هذا مع حجز مؤكد آخر لنفس المشارك.'],
  not_eligible: ['The selected participant age is not eligible for this listing.', 'عمر المشارك المحدد غير مؤهل لهذا النشاط.'],
  session_started: ['This session has already started or ended.', 'هذه الجلسة بدأت أو انتهت.'],
  session_cancelled: ['This session was cancelled by the host.', 'ألغى المنظّم هذه الجلسة.'],
  too_late_to_cancel: ['This session has started, so it can no longer be cancelled.', 'بدأت الجلسة ولا يمكن إلغاؤها الآن.'],
  forbidden: ['You do not have access to this.', 'لا تملك صلاحية الوصول.'],
  not_found: ['Not found.', 'غير موجود.'],
}
export function useErrorText() {
  const { L } = useApp()
  return useCallback((e: { message?: string } | null | undefined) => {
    const m = e?.message ?? ''
    const hit = Object.keys(ERRORS).find(k => m.includes(k))
    return hit ? L(...ERRORS[hit]) : L('Something went wrong. Please try again.', 'حدث خطأ. حاول مرة أخرى.') + (m ? ` (${m})` : '')
  }, [L])
}
