import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Price, supabase, useApp, useErrorText } from '../lib/app'
import { useLabels } from '../lib/labels'
import type { Reservation } from '../lib/types'

export default function Bookings() {
  const { L, session, authReady, dateTime, time } = useApp()
  const { title, band, label, pick } = useLabels()
  const errText = useErrorText()
  const [rows, setRows] = useState<Reservation[] | null>(null)
  const [error, setError] = useState('')
  const [asking, setAsking] = useState('')
  const [busy, setBusy] = useState('')
  const uid = session?.user.id

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('reservations')
      .select('*, occurrence:occurrences(*, listing:listings(*, host:hosts(*)))').order('created_at', { ascending: false })
    if (e) setError(errText(e)); else setRows(data as Reservation[])
  }, [errText])
  useEffect(() => { if (uid) load(); else setRows(null) }, [uid, load])

  async function cancel(id: string) {
    setBusy(id); setError('')
    const { error: e } = await supabase.rpc('cancel_reservation', { p_id: id })
    setBusy(''); setAsking('')
    if (e) setError(errText(e))
    await load()
  }

  if (!authReady) return null
  if (!session) return (
    <section className="narrow">
      <h1>{L('My Bookings', 'حجوزاتي')}</h1>
      <p>{L('Sign in to see your reservations.', 'سجّل الدخول لعرض حجوزاتك.')}</p>
      <Link className="btn primary" to="/signin?next=/bookings">{L('Sign in', 'تسجيل الدخول')}</Link>
    </section>
  )
  return (
    <section>
      <h1>{L('My Bookings', 'حجوزاتي')}</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {!rows && !error && <p className="muted" aria-live="polite">{L('Loading your bookings…', 'جارٍ تحميل حجوزاتك…')}</p>}
      {rows && rows.length === 0 && (
        <p className="empty">{L('You have no bookings yet.', 'لا توجد حجوزات بعد.')} <Link to="/">{L('Explore activities', 'استكشف الأنشطة')}</Link></p>
      )}
      <ul className="cards">
        {rows?.map(r => {
          const o = r.occurrence, l = o?.listing
          if (!o || !l) return null
          const started = l.is_flexible ? Date.parse(o.ends_at) <= Date.now() : Date.parse(o.starts_at) <= Date.now()
          return (
            <li key={r.id} className={'card' + (r.status === 'cancelled' ? ' faded' : '')}>
              <div className="tags">
                <span className={'tag ' + (r.status === 'confirmed' ? 'ok' : 'off')}>
                  {r.status === 'confirmed' ? L('Confirmed', 'مؤكد') : L('Cancelled', 'ملغى')}</span>
                {r.attended_at && <span className="tag ok">{L('Attended', 'حضر')}</span>}
                <span className="tag">{label(l.type)}</span>
              </div>
              <h2><Link to={`/listing/${l.id}`}>{title(l)}</Link></h2>
              <p className="muted">{l.host && pick(l.host.name_en, l.host.name_ar)} · {label(l.area)}</p>
              <dl className="facts">
                <div><dt>{L('Reference', 'رقم المرجع')}</dt><dd><strong className="ref" dir="ltr">{r.reference}</strong></dd></div>
                <div><dt>{L('When', 'الموعد')}</dt><dd>{l.is_flexible ? L(`Flexible, until ${dateTime(o.ends_at)}`, `مرن، حتى ${dateTime(o.ends_at)}`) : `${dateTime(o.starts_at)} – ${time(o.ends_at)}`}</dd></div>
                <div><dt>{L('Participant', 'المشارك')}</dt><dd>{band(r.participant_band)}</dd></div>
                <div><dt>{L('Price', 'السعر')}</dt><dd><Price amount={r.price_amount} currency={r.price_currency} /></dd></div>
              </dl>
              {r.status === 'confirmed' && !started && (
                asking === r.id ? (
                  <div className="row" role="group" aria-label={L('Confirm cancellation', 'تأكيد الإلغاء')}>
                    <span>{L('Cancel this booking? Your place is released.', 'إلغاء هذا الحجز؟ سيُتاح مكانك لغيرك.')}</span>
                    <button className="btn danger" disabled={busy === r.id} onClick={() => cancel(r.id)}>{busy === r.id ? L('Cancelling…', 'جارٍ الإلغاء…') : L('Yes, cancel', 'نعم، ألغِ')}</button>
                    <button className="btn ghost" onClick={() => setAsking('')}>{L('Keep booking', 'أبقِ الحجز')}</button>
                  </div>
                ) : <button className="btn ghost" onClick={() => setAsking(r.id)}>{L('Cancel booking', 'إلغاء الحجز')}</button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
