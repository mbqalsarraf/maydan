import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { kuwaitDayKey, supabase, useApp } from '../lib/app'
import { MIN_REPORTS, compareQuote, percentile, type Report } from '../lib/compare'
import { useLabels } from '../lib/labels'
import { surprisePlan, type Candidate } from '../lib/planner'
import type { Listing } from '../lib/types'
import { fetchListings } from './Explore'

/** Thursday to Saturday of the coming weekend, in Kuwait time (YYYY-MM-DD keys). */
function weekendKeys(now = Date.now()): string[] {
  const keys = Array.from({ length: 8 }, (_, i) => kuwaitDayKey(new Date(now + i * 86400000).toISOString()))
  const dow = (k: string) => new Date(k + 'T12:00:00+03:00').getUTCDay()
  const fri = keys.find(k => dow(k) === 5)!
  const i = keys.indexOf(fri)
  return [keys[i - 1], fri, keys[i + 1]].filter(Boolean)
}

type Row = { listing: Listing; starts_at: string; ends_at: string; left: number; capacity: number; occId: string }
type Ruler = { name: string; reports: Report[]; providers: { name: string; price: number }[]; p25: number; p75: number; min: number; max: number; n: number }

export default function Home() {
  const { L, money, day, time, dateTime, convert, bufferMinutes } = useApp()
  const { title, label, pick } = useLabels()
  const [listings, setListings] = useState<Listing[] | null>(null)
  const [ruler, setRuler] = useState<Ruler | null>(null)
  const [quote, setQuote] = useState(11)
  const [error, setError] = useState(false)
  const weekend = useMemo(() => weekendKeys(), [])

  useEffect(() => {
    fetchListings().then(setListings).catch(() => setError(true))
    ;(async () => {
      const { data: def } = await supabase.from('service_definitions').select('*').eq('slug', 'ac-cleaning').maybeSingle()
      if (!def) return
      const [{ data: reps }, { data: provs }] = await Promise.all([
        supabase.from('price_reports').select('amount,currency,area,includes_parts,includes_callout,observed_on,source_type,verification,is_demo').eq('service_def_id', def.id),
        supabase.from('listings').select('price_amount, host:hosts(name_en,name_ar)').eq('service_def_id', def.id).eq('includes_callout', true).eq('includes_parts', false),
      ])
      const reports = ((reps ?? []) as Report[]).filter(r => r.source_type === 'demo_sample' && r.includes_callout && !r.includes_parts && r.currency === 'KWD')
      if (reports.length < MIN_REPORTS) return
      const sorted = reports.map(r => Number(r.amount)).sort((a, b) => a - b)
      setRuler({
        name: pick(def.name_en, def.name_ar), reports, n: sorted.length,
        p25: percentile(sorted, 0.25), p75: percentile(sorted, 0.75), min: sorted[0], max: sorted[sorted.length - 1],
        providers: ((provs ?? []) as unknown as { price_amount: number; host: { name_en: string; name_ar: string } }[])
          .map(p => ({ name: pick(p.host.name_en, p.host.name_ar), price: Number(p.price_amount) })),
      })
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The weekly sheet: real fixed sessions on the coming Thu–Sat, soonest first.
  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    for (const l of listings ?? []) {
      if (l.type === 'service' || l.is_flexible) continue
      for (const o of l.occurrences ?? []) {
        if (!weekend.includes(kuwaitDayKey(o.starts_at))) continue
        out.push({ listing: l, starts_at: o.starts_at, ends_at: o.ends_at, left: o.capacity - o.booked_count, capacity: o.capacity, occId: o.id })
      }
    }
    return out.sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 6)
  }, [listings, weekend])

  // A sample Friday, drawn by the same rules as "Surprise me" (deterministic so it does not jump on reload).
  const friday = useMemo(() => {
    if (!listings) return []
    const fri = weekend.find(k => new Date(k + 'T12:00:00+03:00').getUTCDay() === 5)!
    const cands: Candidate[] = listings.flatMap(l => (l.occurrences ?? []).map(o => ({
      occurrence_id: o.id, listing_id: l.id, host_id: l.host_id, type: l.type, title_en: l.title_en, title_ar: l.title_ar,
      category: l.category, area: l.area, is_flexible: l.is_flexible, starts_at: o.starts_at, ends_at: o.ends_at,
      duration_minutes: l.duration_minutes, price_amount: Number(l.price_amount), price_currency: l.price_currency,
      min_age: l.min_age, max_age: l.max_age, seats_left: o.capacity - o.booked_count,
    }))).filter(c => !c.is_flexible)
    let s = 7
    const rng = () => (s = (s * 16807) % 2147483647) / 2147483647
    return surprisePlan(cands, {
      interests: [], area: null, band: 'adult', budget: 25, budget_currency: 'KWD',
      windows: [{ start: `${fri}T08:00:00+03:00`, end: `${fri}T22:00:00+03:00` }],
    }, { bufferMinutes, convert, now: Date.now() }, rng, 3)
  }, [listings, weekend, bufferMinutes, convert])

  const range = weekend.length ? `${day(weekend[0] + 'T12:00:00+03:00')} – ${day(weekend[weekend.length - 1] + 'T12:00:00+03:00')}` : ''

  // Quote ruler geometry: one shared scale for every price on it.
  // Fixed scale matching the slider, so the band never moves while the marker does.
  const lo = 3, hi = 16
  const at = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  const verdict = ruler ? compareQuote({ amount: quote, currency: 'KWD', area: null, includes_parts: false, includes_callout: true, includeUnverified: false }, ruler.reports, new Date(), () => null) : null
  const verdictText = verdict && ({
    below: L('Below reported range', 'أقل من النطاق المُبلَّغ عنه'),
    within: L('Within reported range', 'ضمن النطاق المُبلَّغ عنه'),
    above: L('Above reported range', 'أعلى من النطاق المُبلَّغ عنه'),
    insufficient: L('Not enough comparable price reports', 'لا توجد بلاغات أسعار قابلة للمقارنة بما يكفي'),
  })[verdict.status]
  const dayStart = friday.length ? Date.parse(friday[0].starts_at.slice(0, 10) + 'T05:00:00Z') : 0
  const span = 14 * 3600000

  return (
    <div className="home">
      <section className="home-hero" aria-labelledby="home-h1">
        <div className="hero-copy">
          <p className="stamp-strip"><span>{L('This weekend', 'هذا الأسبوع')}</span>{range}</p>
          <h1 id="home-h1">{L('Things to do in Kuwait this weekend, with real places and prices.', 'أنشطة في الكويت هذا الأسبوع، بأماكن وأسعار حقيقية.')}</h1>
          <p className="lead">{L('Reserve a seat at a local workshop, check a service quote like for like, and plan your free time in one place.',
            'احجز مقعدك في ورشة محلية، وقارن عرض سعر خدمة بما يماثله، وخطّط لوقت فراغك في مكان واحد.')}</p>
          <div className="row">
            <Link className="btn primary" to="/explore">{L('Find something this weekend', 'ابحث عن نشاط هذا الأسبوع')}</Link>
            <Link className="btn ghost" to="/services">{L('Check a quote', 'تحقّق من عرض سعر')}</Link>
          </div>
        </div>

        <div className="sheet" aria-label={L('This weekend’s sheet', 'جدول هذا الأسبوع')}>
          <div className="sheet-head" aria-hidden="true">
            <span>{L('Activity', 'النشاط')}</span><span>{L('When', 'الموعد')}</span><span>{L('Left', 'متبقٍ')}</span><span className="num">{L('Price', 'السعر')}</span>
          </div>
          {error && <p className="error sheet-msg">{L('Could not load this weekend’s sessions. Please refresh.', 'تعذّر تحميل جلسات هذا الأسبوع. حدّث الصفحة.')}</p>}
          {!listings && !error && <div className="sheet-skeleton" aria-live="polite"><span className="sr">{L('Loading…', 'جارٍ التحميل…')}</span>{[0, 1, 2, 3, 4].map(i => <i key={i} />)}</div>}
          {listings && rows.length === 0 && <p className="sheet-msg">{L('No sessions are scheduled for this weekend yet.', 'لا توجد جلسات مجدولة لهذا الأسبوع بعد.')} <Link to="/explore">{L('See all activities', 'كل الأنشطة')}</Link></p>}
          <ol className="sheet-rows">
            {rows.map((r, i) => (
              <li key={r.occId} style={{ '--i': i } as React.CSSProperties}>
                <Link className="sheet-row" to={`/listing/${r.listing.id}?occ=${r.occId}`}>
                  <span className="sheet-title"><strong>{title(r.listing)}</strong><small>{label(r.listing.area)} · {label(r.listing.category)}</small></span>
                  <span className="sheet-when">{dateTime(r.starts_at)}</span>
                  <span className="sheet-left">{r.left > 0 ? `${r.left}/${r.capacity}` : L('Full', 'مكتمل')}</span>
                  <span className="tag-price num">{Number(r.listing.price_amount) === 0 ? L('Free', 'مجاناً') : money(Number(r.listing.price_amount), r.listing.price_currency)}</span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="fine-print">{L('Sample listings: every host, price and place is fictional for this pilot. Times are Kuwait time. Maydan takes no payments; you pay the host.',
            'بيانات تجريبية: جميع المنظّمين والأسعار والأماكن خيالية في هذه التجربة. الأوقات بتوقيت الكويت. ميدان لا يحصّل مدفوعات؛ تدفع للمنظّم مباشرة.')}</p>
        </div>
      </section>

      <section className="home-band" aria-labelledby="quote-h2">
        <div className="band-copy">
          <h2 id="quote-h2">{L('Is this quote fair? Compare it like for like.', 'هل هذا السعر معقول؟ قارنه بما يماثله.')}</h2>
          <p>{L(`Maydan only compares reports for the same scope, the same inclusions and the same area, and shows a range only when at least ${MIN_REPORTS} match. Otherwise it says so.`,
            `يقارن ميدان فقط البلاغات لنفس نطاق الخدمة ونفس المشمولات والمنطقة، ويعرض النطاق فقط عند توفر ${MIN_REPORTS} بلاغات مطابقة على الأقل. وإلا فإنه يخبرك بذلك.`)}</p>
          <Link className="btn primary" to="/services">{L('Compare a quote', 'قارن عرض سعر')}</Link>
        </div>
        <div className="ruler-panel">
          {ruler ? (
            <>
              <p className="ruler-title"><strong>{ruler.name}</strong> · {L('one standard split unit, call-out included', 'وحدة سبليت واحدة، شاملة رسوم الزيارة')}</p>
              <label className="ruler-input">{L('Your quote (KWD)', 'عرضك (د.ك)')}
                <input type="range" min={3} max={16} step={0.5} value={quote} onChange={e => setQuote(Number(e.target.value))} />
              </label>
              <div className="ruler" role="img" aria-label={`${money(quote, 'KWD')}: ${verdictText}`}>
                <div className="ruler-band" style={{ insetInlineStart: at(ruler.p25), width: `calc(${at(ruler.p75)} - ${at(ruler.p25)})` }} />
                {ruler.providers.map(p => <span key={p.name} className="ruler-tick" style={{ insetInlineStart: at(p.price) }} title={`${p.name}: ${money(p.price, 'KWD')}`} />)}
                <span className="ruler-marker" style={{ insetInlineStart: at(quote) }}><b>{money(quote, 'KWD')}</b></span>
              </div>
              <div className="ruler-scale num" aria-hidden="true"><span>{lo}</span><span>{hi}</span></div>
              <p className={'ruler-verdict v-' + verdict?.status}>{verdictText}</p>
              <dl className="facts">
                <div><dt>{L('Reported range (25th–75th)', 'النطاق المُبلَّغ عنه (25–75)')}</dt><dd className="num"><bdi>{money(ruler.p25, 'KWD')}</bdi> – <bdi>{money(ruler.p75, 'KWD')}</bdi></dd></div>
                <div><dt>{L('Comparable reports', 'بلاغات مماثلة')}</dt><dd className="num">{ruler.n}</dd></div>
                <div><dt>{L('Provider-listed prices (ticks)', 'أسعار المزوّدين (العلامات)')}</dt><dd className="num">{ruler.providers.map((p, i) => <span key={p.name}>{i > 0 && ' · '}<bdi>{money(p.price, 'KWD')}</bdi></span>)}</dd></div>
              </dl>
              <p><span className="badge-demo">{L('Demo comparison using sample data', 'مقارنة تجريبية باستخدام بيانات عيّنة')}</span></p>
            </>
          ) : <div className="sheet-skeleton"><i /><i /><i /></div>}
        </div>
      </section>

      <section className="home-plan" aria-labelledby="plan-h2">
        <div className="band-copy">
          <h2 id="plan-h2">{L('Turn a free Friday into a plan that fits.', 'حوّل يوم الجمعة إلى خطة تناسبك.')}</h2>
          <p>{L(`Tell Maydan your interests, budget and free hours. It builds a plan from real sessions, keeps ${bufferMinutes} minutes between venues and checks ages and places. Nothing is reserved until you book each item.`,
            `أخبر ميدان باهتماماتك وميزانيتك وساعات فراغك. يبني خطة من جلسات حقيقية، ويترك ${bufferMinutes} دقيقة بين الأماكن ويتحقق من الأعمار والمقاعد. لا يُحجز شيء حتى تحجز كل عنصر.`)}</p>
          <Link className="btn primary" to="/plan">{L('Plan my weekend', 'خطّط لعطلتي')}</Link>
        </div>
        <div className="day-plan">
          <p className="ruler-title"><strong>{friday[0] ? day(friday[0].starts_at) : L('Friday', 'الجمعة')}</strong> · {L('an example from this week’s sheet, budget KWD 25', 'مثال من جدول هذا الأسبوع، بميزانية 25 د.ك')}</p>
          <div className="day-axis" aria-hidden="true">{['08', '12', '16', '20'].map(h => <span key={h} className="num">{h}:00</span>)}</div>
          <div className="day-track" aria-hidden="true">
            {friday.map(c => (
              <span key={c.occurrence_id} style={{ insetInlineStart: `${((Date.parse(c.starts_at) - dayStart) / span) * 100}%`, width: `${((Date.parse(c.ends_at) - Date.parse(c.starts_at)) / span) * 100}%` }} />
            ))}
          </div>
          <ol className="day-list">
            {friday.map(c => (
              <li key={c.occurrence_id}>
                <Link to={`/listing/${c.listing_id}?occ=${c.occurrence_id}`}>
                  <span className="num">{time(c.starts_at)}–{time(c.ends_at)}</span>
                  <strong>{title(c)}</strong>
                  <span className="tag-price num">{c.price_amount === 0 ? L('Free', 'مجاناً') : money(c.price_amount, c.price_currency)}</span>
                </Link>
              </li>
            ))}
          </ol>
          {listings && friday.length === 0 && <p className="sheet-msg">{L('No Friday sessions fit yet.', 'لا توجد جلسات مناسبة يوم الجمعة بعد.')}</p>}
          <p className="fine-print">{L('Random example, not AI. The 30-minute gap between venues is a planning assumption, not a travel estimate.',
            'مثال عشوائي وليس ذكاءً اصطناعياً. فاصل الـ30 دقيقة بين الأماكن افتراض تخطيطي وليس تقديراً لوقت التنقل.')}</p>
        </div>
      </section>

      <section className="home-close" aria-labelledby="close-h2">
        <h2 id="close-h2">{L('Run workshops or classes in Kuwait?', 'تنظّم ورشاً أو دورات في الكويت؟')}</h2>
        <p>{L('Hosts publish sessions, see who is coming, mark attendance and print a QR code for their listing. Host access is given by the Maydan team.',
          'ينشر المنظّمون جلساتهم، ويرون المشاركين، ويسجّلون الحضور، ويطبعون رمز QR لنشاطهم. يمنح فريق ميدان صلاحية المنظّم.')}</p>
        <Link className="btn ghost" to="/signin?next=/host">{L('Sign in as a host', 'سجّل الدخول كمنظّم')}</Link>
      </section>
    </div>
  )
}
