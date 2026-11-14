import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { Price, kuwaitDayKey, supabase, useApp, useErrorText } from '../lib/app'
import { useLabels } from '../lib/labels'
import { BANDS, bandEligible, isUpcoming, type Band, type Listing, type Occurrence, type ServiceDef } from '../lib/types'
import { useSaved } from './Explore'

type Confirmed = { reference: string; occurrence_id: string; participant_band: Band; price_amount: number; price_currency: string }

export default function ListingDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const loc = useLocation()
  const { L, session, dateTime, day, time } = useApp()
  const { label, title, pick, ages, band: bandLabel } = useLabels()
  const errText = useErrorText()
  const [listing, setListing] = useState<Listing | null>(null)
  const [service, setService] = useState<ServiceDef | null>(null)
  const [busyTimes, setBusyTimes] = useState<{ starts_at: string; ends_at: string }[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [occId, setOccId] = useState<string>(params.get('occ') ?? '')
  const [band, setBand] = useState<Band>('adult')
  const [step, setStep] = useState<'choose' | 'review' | 'done'>('choose')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null)
  const [following, setFollowing] = useState(false)
  const idemKey = useRef<string>('')
  const { saved, toggle, canSave } = useSaved()

  const load = useCallback(async () => {
    const { data } = await supabase.from('listings').select('*, host:hosts(*), occurrences(*)').eq('id', id!)
      .gt('occurrences.ends_at', new Date().toISOString()).order('starts_at', { referencedTable: 'occurrences' }).maybeSingle()
    if (!data) { setState('missing'); return }
    const l = data as Listing
    l.occurrences = (l.occurrences ?? []).filter(o => isUpcoming(o, l.is_flexible))
    setListing(l); setState('ready')
    if (l.type === 'service') {
      // A provider cannot be in two places: hide times already booked on any of this provider's services.
      const [{ data: busy }, { data: def }] = await Promise.all([
        supabase.from('occurrences').select('starts_at, ends_at, listing:listings!inner(host_id)')
          .eq('listing.host_id', l.host_id).gt('booked_count', 0).gt('starts_at', new Date().toISOString()),
        supabase.from('service_definitions').select('*').eq('id', l.service_def_id!).maybeSingle(),
      ])
      setBusyTimes(busy ?? []); setService(def as ServiceDef | null)
    }
  }, [id])
  useEffect(() => { setState('loading'); load() }, [load])

  const uid = session?.user.id
  useEffect(() => {
    if (!uid || !listing) { setFollowing(false); return }
    supabase.from('follows').select('host_id').eq('host_id', listing.host_id).then(({ data }) => setFollowing((data ?? []).length > 0))
  }, [uid, listing])

  const eligibleBands = useMemo(() => listing ? BANDS.filter(b => bandEligible(b, listing.min_age, listing.max_age)) : [], [listing])
  useEffect(() => { if (eligibleBands.length && !eligibleBands.includes(band)) setBand(eligibleBands[0]) }, [eligibleBands, band])

  if (state === 'loading') return <p className="muted" aria-live="polite">{L('Loading…', 'جارٍ التحميل…')}</p>
  if (state === 'missing' || !listing) return <p>{L('This listing is not available.', 'هذا النشاط غير متاح.')} <Link to="/">{L('Back to Explore', 'العودة إلى استكشف')}</Link></p>

  const isService = listing.type === 'service'
  const free = (o: Occurrence) => o.booked_count < o.capacity
    && !(isService && busyTimes.some(b => Date.parse(b.starts_at) < Date.parse(o.ends_at) && Date.parse(b.ends_at) > Date.parse(o.starts_at)))
  const occs = listing.occurrences ?? []
  const chosen = occs.find(o => o.id === occId)
  const byDay = new Map<string, Occurrence[]>()
  for (const o of occs) { const k = kuwaitDayKey(o.starts_at); byDay.set(k, [...(byDay.get(k) ?? []), o]) }

  function startReview() {
    idemKey.current = crypto.randomUUID()   // one key per confirmation attempt: repeated clicks return the same booking
    setError(''); setStep('review')
  }
  async function confirm() {
    if (pending || !chosen) return
    setPending(true); setError('')
    const { data, error: e } = await supabase.rpc('reserve', { p_occurrence: chosen.id, p_band: band, p_key: idemKey.current })
    setPending(false)
    await load()                              // always show fresh availability
    if (e) { setError(errText(e)); setStep('choose'); return }
    setConfirmed(data as Confirmed); setStep('done')
  }
  async function toggleFollow() {
    const q = following ? supabase.from('follows').delete().eq('host_id', listing!.host_id) : supabase.from('follows').insert({ host_id: listing!.host_id })
    const { error: e } = await q
    if (!e) setFollowing(!following)
  }

  return (
    <article className="detail">
      <p><Link to={isService ? '/services' : '/'}>← {isService ? L('All services', 'كل الخدمات') : L('All activities', 'كل الأنشطة')}</Link></p>
      <div className="tags">
        <span className="tag">{label(listing.type)}</span><span className="tag">{label(listing.category)}</span>
        {listing.is_flexible && <span className="tag flex">{L('Flexible · online', 'مرن · عبر الإنترنت')}</span>}
        {listing.is_demo && <span className="tag demo">{L('Demo listing · fictional', 'نشاط تجريبي · خيالي')}</span>}
      </div>
      <h1>{title(listing)}</h1>
      {listing.host && (
        <p className="muted">
          {L('By', 'تقديم')} {pick(listing.host.name_en, listing.host.name_ar)} · {label(listing.area)}{' '}
          {canSave && <button className="btn ghost small" aria-pressed={following} onClick={toggleFollow}>
            {following ? L('✓ Following', '✓ تتابعه') : L('+ Follow host', '+ متابعة')}</button>}
        </p>
      )}
      {!isService && <p>{pick(listing.description_en, listing.description_ar)}</p>}
      {isService && service && <p><strong>{L('Exact scope', 'نطاق الخدمة بالضبط')}:</strong> {pick(service.scope_en, service.scope_ar)} ({pick(service.unit_en, service.unit_ar)})</p>}

      <dl className="facts wide">
        <div><dt>{L('Listed price', 'السعر المعلن')}</dt><dd><Price amount={listing.price_amount} currency={listing.price_currency} /></dd></div>
        {!isService && <div><dt>{L('Ages', 'الأعمار')}</dt><dd>{ages(listing.min_age, listing.max_age)}</dd></div>}
        {!isService && <div><dt>{L('Level', 'المستوى')}</dt><dd>{label(listing.level)}</dd></div>}
        <div><dt>{L('Duration', 'المدة')}</dt><dd>{L(`${listing.duration_minutes} minutes`, `${listing.duration_minutes} دقيقة`)}</dd></div>
        {isService && <div><dt>{L('Included', 'يشمل')}</dt><dd>{pick(listing.inclusions_en, listing.inclusions_ar)}</dd></div>}
        {isService && <div><dt>{L('Not included', 'لا يشمل')}</dt><dd>{pick(listing.exclusions_en, listing.exclusions_ar)}</dd></div>}
      </dl>
      {canSave && !isService && (
        <p><button className="btn ghost" aria-pressed={saved.includes(listing.id)} onClick={() => toggle(listing.id)}>
          {saved.includes(listing.id) ? L('★ Saved for my plan', '★ محفوظ لخطتي') : L('☆ Save for my plan', '☆ احفظه لخطتي')}</button></p>
      )}

      {step === 'done' && confirmed ? (
        <section className="panel success" role="status">
          <h2>{L('Your reservation is confirmed', 'تم تأكيد حجزك')}</h2>
          <p>{L('Reference', 'رقم المرجع')}: <strong className="ref" dir="ltr">{confirmed.reference}</strong></p>
          <p>{title(listing)} · {chosen && (listing.is_flexible ? L(`access until ${dateTime(chosen.ends_at)}`, `متاح حتى ${dateTime(chosen.ends_at)}`) : dateTime(chosen.starts_at))} · {bandLabel(confirmed.participant_band)}</p>
          <p>{L('Price to pay the host', 'السعر المستحق للمنظّم')}: <Price amount={confirmed.price_amount} currency={confirmed.price_currency} /></p>
          <div className="row">
            <Link className="btn primary" to="/bookings">{L('View My Bookings', 'عرض حجوزاتي')}</Link>
            <button className="btn ghost" onClick={() => { setStep('choose'); setOccId(''); setConfirmed(null) }}>{L('Done', 'تم')}</button>
          </div>
        </section>
      ) : step === 'review' && chosen ? (
        <section className="panel" aria-labelledby="rev">
          <h2 id="rev">{L('Check and confirm', 'راجع وأكّد')}</h2>
          <dl className="facts wide">
            <div><dt>{isService ? L('Appointment', 'الموعد') : L('Session', 'الجلسة')}</dt>
              <dd>{listing.is_flexible ? L(`Flexible access until ${dateTime(chosen.ends_at)}`, `وصول مرن حتى ${dateTime(chosen.ends_at)}`) : `${dateTime(chosen.starts_at)} – ${time(chosen.ends_at)}`}</dd></div>
            <div><dt>{L('Participant', 'المشارك')}</dt><dd>{bandLabel(band)}</dd></div>
            <div><dt>{L('Original price', 'السعر الأصلي')}</dt><dd><strong><Price amount={listing.price_amount} currency={listing.price_currency} /></strong></dd></div>
          </dl>
          <p className="muted small">{L('No payment is taken by Maydan. You pay the host directly in the original currency.', 'ميدان لا يحصّل أي مبلغ. تدفع للمنظّم مباشرة بالعملة الأصلية.')}</p>
          <div className="row">
            <button className="btn primary" onClick={confirm} disabled={pending}>{pending ? L('Confirming…', 'جارٍ التأكيد…') : L('Confirm reservation', 'تأكيد الحجز')}</button>
            <button className="btn ghost" onClick={() => setStep('choose')} disabled={pending}>{L('Back', 'رجوع')}</button>
          </div>
        </section>
      ) : (
        <section className="panel" aria-labelledby="choose">
          <h2 id="choose">{isService ? L('Choose an appointment', 'اختر موعداً') : L('Choose a session', 'اختر جلسة')}</h2>
          {isService && <p className="muted small">{L('Pilot hours: Sunday to Thursday, 09:00–17:00, one-hour appointments. No urgent or weekend service.', 'ساعات التجربة: الأحد إلى الخميس، 9:00–17:00، مواعيد لمدة ساعة. لا خدمة عاجلة أو في نهاية الأسبوع.')}</p>}
          {error && <p className="error" role="alert">{error}</p>}
          {occs.length === 0 && <p className="empty">{L('No upcoming sessions yet. Follow the host to check back later.', 'لا توجد جلسات قادمة. تابع المنظّم للعودة لاحقاً.')}</p>}
          {isService ? (
            [...byDay.entries()].map(([k, list]) => (
              <fieldset key={k} className="slots">
                <legend>{day(list[0].starts_at)}</legend>
                {list.map(o => (
                  <button key={o.id} className={'slot' + (o.id === occId ? ' on' : '')} disabled={!free(o)} aria-pressed={o.id === occId} onClick={() => setOccId(o.id)}>
                    {time(o.starts_at)}{!free(o) && <span className="sr"> {L('(taken)', '(محجوز)')}</span>}
                  </button>
                ))}
              </fieldset>
            ))
          ) : (
            <ul className="sessions">
              {occs.map(o => {
                const left = o.capacity - o.booked_count
                return (
                  <li key={o.id}>
                    <label className={'session' + (o.id === occId ? ' on' : '')}>
                      <input type="radio" name="occ" checked={o.id === occId} disabled={left <= 0} onChange={() => setOccId(o.id)} />
                      <span>
                        <strong>{listing.is_flexible ? L(`Any time until ${dateTime(o.ends_at)}`, `في أي وقت حتى ${dateTime(o.ends_at)}`) : `${dateTime(o.starts_at)} – ${time(o.ends_at)}`}</strong><br />
                        <span className={left <= 0 ? 'error' : 'muted'}>{left > 0 ? L(`${left} of ${o.capacity} places left`, `${left} من ${o.capacity} مقعداً متاحاً`) : L('Full', 'مكتمل')}</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
          {occs.length > 0 && (
            <>
              {!isService && (
                <label className="field">{L('Who is taking part?', 'من سيشارك؟')}
                  <select value={band} onChange={e => setBand(e.target.value as Band)}>
                    {eligibleBands.map(b => <option key={b} value={b}>{bandLabel(b)}</option>)}
                  </select>
                  <span className="muted small">{L('Parents or guardians book for children by choosing an age band. No child details are collected.', 'يحجز وليّ الأمر للطفل باختيار الفئة العمرية فقط. لا نجمع أي بيانات عن الطفل.')}</span>
                </label>
              )}
              {session
                ? <button className="btn primary" disabled={!chosen || !free(chosen)} onClick={startReview}>{L('Continue', 'متابعة')}</button>
                : <Link className="btn primary" to={`/signin?next=${encodeURIComponent(loc.pathname + (occId ? `?occ=${occId}` : ''))}`}>{L('Sign in to reserve', 'سجّل الدخول للحجز')}</Link>}
            </>
          )}
        </section>
      )}
    </article>
  )
}
