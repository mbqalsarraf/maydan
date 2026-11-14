import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Price, supabase, useApp } from '../lib/app'
import { MIN_REPORTS, compareQuote, type Comparison, type Report } from '../lib/compare'
import { useLabels } from '../lib/labels'
import { AREAS, CURRENCIES, isUpcoming, type Currency, type Listing, type ServiceDef } from '../lib/types'

export default function Services() {
  const { L, session, convert, money, dateTime, fxMode } = useApp()
  const { label, pick } = useLabels()
  const [defs, setDefs] = useState<ServiceDef[] | null>(null)
  const [defId, setDefId] = useState('')
  const [providers, setProviders] = useState<Listing[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [loadError, setLoadError] = useState(false)
  // quote form
  const [amount, setAmount] = useState('')
  const [cur, setCur] = useState<Currency>('KWD')
  const [area, setArea] = useState('')
  const [parts, setParts] = useState(false)
  const [callout, setCallout] = useState(true)
  const [includeUnverified, setIncludeUnverified] = useState(false)
  const [result, setResult] = useState<Comparison | null>(null)
  // paid-amount report form
  const [paid, setPaid] = useState('')
  const [paidMsg, setPaidMsg] = useState('')

  useEffect(() => {
    supabase.from('service_definitions').select('*').order('slug').then(({ data, error }) => {
      if (error) { setLoadError(true); return }
      setDefs(data as ServiceDef[]); setDefId(d => d || data?.[0]?.id || '')
    })
  }, [])

  const loadService = useCallback(async () => {
    if (!defId) return
    const [p, r] = await Promise.all([
      supabase.from('listings').select('*, host:hosts(*), occurrences(*)').eq('service_def_id', defId).eq('status', 'published')
        .gt('occurrences.starts_at', new Date().toISOString()).order('price_amount'),
      supabase.from('price_reports').select('amount,currency,area,includes_parts,includes_callout,observed_on,source_type,verification,is_demo').eq('service_def_id', defId),
    ])
    if (p.error || r.error) { setLoadError(true); return }
    setProviders(p.data as Listing[]); setReports(r.data as Report[])
  }, [defId])
  useEffect(() => { setResult(null); setPaidMsg(''); loadService() }, [loadService])

  const def = defs?.find(d => d.id === defId)
  const quote = Number(amount)
  const input = useMemo(() => ({ amount: quote, currency: cur, area: area || null, includes_parts: parts, includes_callout: callout, includeUnverified }),
    [quote, cur, area, parts, callout, includeUnverified])

  function compare(e: FormEvent) {
    e.preventDefault()
    setResult(compareQuote(input, reports, new Date(), convert))
  }
  // Changing any input clears the previous answer so a stale result is never shown beside new inputs.
  useEffect(() => { setResult(null) }, [input])

  async function submitPaid(e: FormEvent) {
    e.preventDefault()
    setPaidMsg('')
    const { error } = await supabase.from('price_reports').insert({
      service_def_id: defId, amount: Number(paid), currency: cur, area: area || 'Kuwait (unspecified)',
      includes_parts: parts, includes_callout: callout, observed_on: new Date().toISOString().slice(0, 10),
    })
    if (error) { setPaidMsg(L('Could not save your report. Check the amount and try again.', 'تعذّر حفظ البلاغ. تحقق من المبلغ وحاول مجدداً.')); return }
    setPaid(''); setPaidMsg(L('Thank you. Saved as a self-reported, unverified amount.', 'شكراً. حُفظ كمبلغ مُبلَّغ ذاتياً وغير موثّق.'))
    loadService()
  }

  const statusText = (c: Comparison) => ({
    below: L('Below reported range', 'أقل من النطاق المُبلَّغ عنه'),
    within: L('Within reported range', 'ضمن النطاق المُبلَّغ عنه'),
    above: L('Above reported range', 'أعلى من النطاق المُبلَّغ عنه'),
    insufficient: L('Not enough comparable price reports', 'لا توجد بلاغات أسعار قابلة للمقارنة بما يكفي'),
  }[c.status])
  const unverifiedCount = reports.filter(r => r.source_type === 'self_reported').length

  return (
    <section>
      <h1>{L('Compare a service quote', 'قارن عرض سعر خدمة')}</h1>
      <p className="muted">{L('Pick a service with a fixed scope, see what pilot providers list, and check a quote against comparable price reports.',
        'اختر خدمة بنطاق محدد، واطّلع على أسعار المزوّدين، وقارن عرضك ببلاغات أسعار مماثلة.')}</p>
      {loadError && <p className="error" role="alert">{L('Could not load services. Please refresh.', 'تعذّر تحميل الخدمات. حدّث الصفحة.')}</p>}
      {!defs && !loadError && <p className="muted" aria-live="polite">{L('Loading services…', 'جارٍ تحميل الخدمات…')}</p>}

      <div className="tabs" role="group" aria-label={L('Service', 'الخدمة')}>
        {defs?.map(d => (
          <button key={d.id} className="btn" aria-pressed={d.id === defId} onClick={() => setDefId(d.id)}>{pick(d.name_en, d.name_ar)}</button>
        ))}
      </div>
      {def && (
        <p className="panel"><strong>{L('Exact scope', 'النطاق بالضبط')}:</strong> {pick(def.scope_en, def.scope_ar)} <strong>({pick(def.unit_en, def.unit_ar)})</strong></p>
      )}

      <h2>{L('Provider-listed prices', 'أسعار المزوّدين المعلنة')}</h2>
      {def && providers.length === 0 && <p className="empty">{L('No pilot providers list this service yet.', 'لا يوجد مزوّدون لهذه الخدمة بعد.')}</p>}
      <ul className="cards">
        {providers.map(p => {
          const next = (p.occurrences ?? []).filter(o => isUpcoming(o, false) && o.booked_count < o.capacity).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]
          return (
            <li key={p.id} className="card">
              <div className="tags">{p.is_demo && <span className="tag demo">{L('Demo provider · fictional', 'مزوّد تجريبي · خيالي')}</span>}</div>
              <h3>{p.host && pick(p.host.name_en, p.host.name_ar)}</h3>
              <p className="muted">{label(p.area)}</p>
              <dl className="facts">
                <div><dt>{L('Listed price', 'السعر المعلن')}</dt><dd><Price amount={p.price_amount} currency={p.price_currency} /></dd></div>
                <div><dt>{L('Included', 'يشمل')}</dt><dd>{pick(p.inclusions_en, p.inclusions_ar)}</dd></div>
                <div><dt>{L('Not included', 'لا يشمل')}</dt><dd>{pick(p.exclusions_en, p.exclusions_ar)}</dd></div>
                <div><dt>{L('Next free appointment', 'أقرب موعد متاح')}</dt><dd>{next ? dateTime(next.starts_at) : L('None in the next two weeks', 'لا يوجد خلال أسبوعين')}</dd></div>
              </dl>
              <Link className="btn primary" to={`/listing/${p.id}`}>{L('Book an appointment', 'احجز موعداً')}</Link>
            </li>
          )
        })}
      </ul>

      <h2>{L('Check a quote you received', 'تحقق من عرض سعر استلمته')}</h2>
      <form className="panel" onSubmit={compare}>
        <div className="grid2">
          <label>{L('Quote amount', 'مبلغ العرض')}
            <input type="number" inputMode="decimal" min="0.001" step="0.001" required value={amount} onChange={e => setAmount(e.target.value)} dir="ltr" />
          </label>
          <label>{L('Currency', 'العملة')}
            <select value={cur} onChange={e => setCur(e.target.value as Currency)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
          </label>
          <label>{L('Area', 'المنطقة')}
            <select value={area} onChange={e => setArea(e.target.value)}>
              <option value="">{L('All pilot areas in Kuwait', 'كل مناطق التجربة في الكويت')}</option>
              {AREAS.map(a => <option key={a} value={a}>{label(a)}</option>)}
            </select>
          </label>
        </div>
        <label className="check"><input type="checkbox" checked={callout} onChange={e => setCallout(e.target.checked)} />
          {L('Quote includes the call-out / transport fee', 'العرض يشمل رسوم الزيارة / المواصلات')}</label>
        <label className="check"><input type="checkbox" checked={parts} onChange={e => setParts(e.target.checked)} />
          {L('Quote includes parts or materials', 'العرض يشمل القطع أو المواد')}</label>
        <label className="check"><input type="checkbox" checked={includeUnverified} onChange={e => setIncludeUnverified(e.target.checked)} />
          {L(`Also count self-reported, unverified amounts (${unverifiedCount} for this service)`, `احتسب أيضاً المبالغ المُبلَّغة ذاتياً وغير الموثّقة (${unverifiedCount} لهذه الخدمة)`)}</label>
        <button className="btn primary">{L('Compare', 'قارن')}</button>
      </form>

      {result && (
        <section className={'panel ' + (result.status === 'insufficient' ? 'warn' : '')} aria-live="polite">
          <p className="result">{statusText(result)}</p>
          {result.usesDemoData && <p><span className="badge-demo">{L('Demo comparison using sample data', 'مقارنة تجريبية باستخدام بيانات عيّنة')}</span></p>}
          {result.status === 'insufficient' ? (
            <>
              <p>{L(`Only ${result.n} report(s) match this exact scope, inclusions and area. Maydan shows a range only with at least ${MIN_REPORTS}, so no judgement is made about this quote.`,
                    `يوجد ${result.n} بلاغ(ات) فقط تطابق هذا النطاق والمشمولات والمنطقة. يعرض ميدان النطاق عند توفر ${MIN_REPORTS} على الأقل، لذا لا حكم على هذا العرض.`)}</p>
              <p>{L('You can still compare with the provider-listed prices above.', 'ما زال بإمكانك المقارنة مع أسعار المزوّدين المعلنة أعلاه.')}
                {result.excluded.differentArea > 0 && ' ' + L(`Widening the area would add ${result.excluded.differentArea} report(s).`, `توسيع المنطقة يضيف ${result.excluded.differentArea} بلاغ(ات).`)}</p>
            </>
          ) : (
            <p>{L('Your quote', 'عرضك')}: <strong>{money(quote, cur)}</strong> · {L('Reported range (25th–75th percentile)', 'النطاق المُبلَّغ عنه (المئين 25–75)')}:{' '}
              <strong><bdi>{money(result.p25!, cur)}</bdi> – <bdi>{money(result.p75!, cur)}</bdi></strong></p>
          )}
          <dl className="facts wide">
            <div><dt>{L('Comparable reports used', 'البلاغات المستخدمة')}</dt><dd>{result.n}</dd></div>
            {result.n > 0 && <div><dt>{L('Lowest – highest reported', 'الأدنى – الأعلى')}</dt><dd><bdi>{money(result.min!, cur)}</bdi> – <bdi>{money(result.max!, cur)}</bdi></dd></div>}
            {result.n > 0 && <div><dt>{L('Report dates', 'تواريخ البلاغات')}</dt><dd dir="ltr">{result.dateFrom} → {result.dateTo}</dd></div>}
            <div><dt>{L('Source type', 'نوع المصدر')}</dt>
              <dd>{L(`${result.sources.demo_sample} sample (synthetic) · ${result.sources.self_reported} self-reported (unverified)`,
                     `${result.sources.demo_sample} عيّنة (مصطنعة) · ${result.sources.self_reported} مُبلَّغ ذاتياً (غير موثّق)`)}</dd></div>
            <div><dt>{L('Left out: different inclusions', 'مستبعد: مشمولات مختلفة')}</dt><dd>{result.excluded.differentInclusions}</dd></div>
            <div><dt>{L('Left out: other area', 'مستبعد: منطقة أخرى')}</dt><dd>{result.excluded.differentArea}</dd></div>
            <div><dt>{L('Left out: unverified self-reports', 'مستبعد: بلاغات ذاتية غير موثّقة')}</dt><dd>{result.excluded.unverified}</dd></div>
            {result.excluded.noConversion > 0 && <div><dt>{L('Left out: no exchange rate available', 'مستبعد: لا يتوفر سعر صرف')}</dt><dd>{result.excluded.noConversion}</dd></div>}
          </dl>
          {result.usesConvertedAmounts && <p className="small"><strong>{fxMode === 'demo'
            ? L('Report amounts were converted with illustrative demo exchange rates, not live rates.', 'حُوّلت مبالغ البلاغات بأسعار صرف توضيحية وليست حية.')
            : L('Report amounts were converted to your currency.', 'حُوّلت مبالغ البلاغات إلى عملتك.')}</strong></p>}
          <p className="muted small">{L(`How this works: only reports for the same service scope, the same call-out and parts inclusions and the chosen area are compared. The range is the middle half of those reports and needs at least ${MIN_REPORTS}. It is an illustrative reference, not a fair-price guarantee, and a higher price does not mean a provider is dishonest.`,
            `طريقة العمل: نقارن فقط البلاغات لنفس نطاق الخدمة ونفس المشمولات والمنطقة المختارة. النطاق هو النصف الأوسط من تلك البلاغات ويتطلب ${MIN_REPORTS} على الأقل. هو مرجع توضيحي وليس ضماناً لسعر عادل، والسعر الأعلى لا يعني أن المزوّد غير أمين.`)}</p>
        </section>
      )}

      <h2>{L('Paid for this service recently? (optional)', 'دفعت مقابل هذه الخدمة مؤخراً؟ (اختياري)')}</h2>
      {session ? (
        <form className="panel" onSubmit={submitPaid}>
          <p className="muted small">{L('Uses the currency, area and inclusions selected above. Your report is labelled self-reported and unverified, and is left out of comparisons unless a visitor chooses to count it.',
            'يُستخدم ما اخترته أعلاه من عملة ومنطقة ومشمولات. يُوسم بلاغك بأنه ذاتي وغير موثّق، ويُستبعد من المقارنات إلا إذا اختار الزائر احتسابه.')}</p>
          <div className="row">
            <label>{L(`Amount paid (${cur})`, `المبلغ المدفوع (${cur})`)}
              <input type="number" inputMode="decimal" min="0.001" step="0.001" required value={paid} onChange={e => setPaid(e.target.value)} dir="ltr" />
            </label>
            <button className="btn">{L('Submit unverified report', 'أرسل بلاغاً غير موثّق')}</button>
          </div>
          {paidMsg && <p role="status">{paidMsg}</p>}
        </form>
      ) : <p className="muted">{L('Sign in to share an amount you paid.', 'سجّل الدخول لمشاركة مبلغ دفعته.')} <Link to="/signin?next=/services">{L('Sign in', 'تسجيل الدخول')}</Link></p>}
    </section>
  )
}
