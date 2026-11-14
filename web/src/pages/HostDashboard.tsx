import QRCode from 'qrcode'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { kuwaitToIso, supabase, useApp, useErrorText } from '../lib/app'
import { useLabels } from '../lib/labels'
import { AREAS, CATEGORIES, type Host, type Listing } from '../lib/types'

type Participant = {
  reservation_id: string; reference: string; occurrence_id: string; starts_at: string
  participant_band: string; status: string; attended_at: string | null; display_name: string
}
// QR codes must point at the deployed site, never at a developer machine.
function publicListingUrl(id: string): string | null {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined
  const origin = configured || window.location.origin
  if (/localhost|127\.0\.0\.1|\[::1\]/.test(origin)) return null
  return `${origin.replace(/\/$/, '')}/#/listing/${id}`
}

export default function HostDashboard() {
  const { L, session, authReady, hostIds, dateTime } = useApp()
  const { title, label, pick } = useLabels()
  const errText = useErrorText()
  const [hosts, setHosts] = useState<Host[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [open, setOpen] = useState('')
  const [people, setPeople] = useState<Participant[] | null>(null)
  const [qr, setQr] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    if (hostIds.length === 0) return
    const [h, l] = await Promise.all([
      supabase.from('hosts').select('*').in('id', hostIds),
      supabase.from('listings').select('*, occurrences(*)').in('host_id', hostIds).order('created_at', { ascending: false }),
    ])
    setHosts((h.data ?? []) as Host[]); setListings((l.data ?? []) as Listing[])
  }, [hostIds])
  useEffect(() => { load() }, [load])

  async function openListing(id: string) {
    setOpen(id); setPeople(null); setQr(''); setError('')
    const { data, error: e } = await supabase.rpc('host_participants', { p_listing: id })
    if (e) setError(errText(e)); else setPeople(data as Participant[])
    const url = publicListingUrl(id)
    if (url) setQr(await QRCode.toDataURL(url, { margin: 1, width: 360 }))
  }
  async function attend(p: Participant, attended: boolean) {
    const { error: e } = await supabase.rpc('set_attendance', { p_reservation: p.reservation_id, p_attended: attended })
    if (e) { setError(errText(e)); return }
    openListing(open)
  }
  async function createListing(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setNotice('')
    const f = new FormData(e.currentTarget), v = (k: string) => String(f.get(k) ?? '').trim()
    const maxAge = v('max_age')
    const { error: err } = await supabase.from('listings').insert({
      host_id: v('host_id'), type: v('type'), title_en: v('title_en'), title_ar: v('title_ar'),
      description_en: v('description_en'), description_ar: v('description_ar'), category: v('category'), area: v('area'),
      price_amount: Number(v('price')), price_currency: 'KWD', min_age: Number(v('min_age') || 0), max_age: maxAge ? Number(maxAge) : null,
      level: v('level'), duration_minutes: Number(v('duration')), status: 'published',
    })
    if (err) { setError(L('Could not publish the listing. Check the fields and try again.', 'تعذّر نشر النشاط. راجع الحقول وحاول مجدداً.') + ` (${err.message})`); return }
    e.currentTarget.reset(); setNotice(L('Listing published. Add a session below so people can reserve.', 'نُشر النشاط. أضف جلسة أدناه ليتمكن الناس من الحجز.')); load()
  }
  async function addSession(e: FormEvent<HTMLFormElement>, l: Listing) {
    e.preventDefault(); setError('')
    const f = new FormData(e.currentTarget)
    const start = kuwaitToIso(String(f.get('date')), String(f.get('time')))
    const end = new Date(Date.parse(start) + l.duration_minutes * 60000).toISOString()
    const { error: err } = await supabase.from('occurrences').insert({ listing_id: l.id, starts_at: start, ends_at: end, capacity: Number(f.get('capacity')) })
    if (err) { setError(L('Could not add the session. It must be in the future and not duplicate an existing start time.', 'تعذّرت إضافة الجلسة. يجب أن تكون في المستقبل وألا تكرر وقت بدء موجوداً.')); return }
    e.currentTarget.reset(); load()
  }

  if (!authReady) return null
  if (!session) return <section className="narrow"><h1>{L('Host Dashboard', 'لوحة المنظّم')}</h1><Link className="btn primary" to="/signin?next=/host">{L('Sign in', 'تسجيل الدخول')}</Link></section>
  if (hostIds.length === 0) return (
    <section className="narrow">
      <h1>{L('Host Dashboard', 'لوحة المنظّم')}</h1>
      <p className="empty">{L('Your account is not linked to a host. Host access is granted by the Maydan team only; it cannot be self-assigned.', 'حسابك غير مرتبط بمنظّم. يمنح فريق ميدان صلاحية المنظّم فقط ولا يمكن منحها ذاتياً.')}</p>
    </section>
  )
  const current = listings.find(l => l.id === open)
  return (
    <section>
      <h1>{L('Host Dashboard', 'لوحة المنظّم')}</h1>
      <p className="muted">{hosts.map(h => pick(h.name_en, h.name_ar)).join(' · ')}</p>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}

      <h2>{L('Your listings', 'أنشطتك')}</h2>
      {listings.length === 0 && <p className="empty">{L('No listings yet. Publish one below.', 'لا توجد أنشطة بعد. انشر نشاطاً أدناه.')}</p>}
      <ul className="cards">
        {listings.map(l => {
          const future = (l.occurrences ?? []).filter(o => Date.parse(o.ends_at) > Date.now()).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
          return (
            <li key={l.id} className="card">
              <h3>{title(l)}</h3>
              <p className="muted">{label(l.type)} · {label(l.area)} · {L(`${future.length} upcoming session(s)`, `${future.length} جلسة قادمة`)}</p>
              <ul className="small">{future.slice(0, 4).map(o => <li key={o.id}>{dateTime(o.starts_at)} · {o.booked_count}/{o.capacity}</li>)}</ul>
              {l.type !== 'service' && (
                <form className="row" onSubmit={e => addSession(e, l)}>
                  <label>{L('Date', 'التاريخ')}<input type="date" name="date" required /></label>
                  <label>{L('Start (Kuwait)', 'البدء (الكويت)')}<input type="time" name="time" required /></label>
                  <label>{L('Places', 'المقاعد')}<input type="number" name="capacity" min="1" max="500" defaultValue={10} required style={{ width: 90 }} /></label>
                  <button className="btn small">{L('Add session', 'أضف جلسة')}</button>
                </form>
              )}
              <div className="row">
                <button className="btn primary" onClick={() => openListing(l.id)}>{L('Participants and QR code', 'المشاركون ورمز QR')}</button>
                <Link className="btn ghost" to={`/listing/${l.id}`}>{L('Public page', 'الصفحة العامة')}</Link>
              </div>
            </li>
          )
        })}
      </ul>

      {current && (
        <section className="panel" aria-live="polite">
          <h2>{title(current)}</h2>
          {qr
            ? <p><img className="qr" src={qr} alt={L('QR code linking to the public listing page', 'رمز QR يؤدي إلى صفحة النشاط العامة')} /><br /><span className="small" dir="ltr">{publicListingUrl(current.id)}</span></p>
            : <p className="muted small">{L('The QR code is shown on the deployed site only (it never points to a local address).', 'يظهر رمز QR على الموقع المنشور فقط (لا يشير أبداً إلى عنوان محلي).')}</p>}
          <h3>{L('Participants', 'المشاركون')}</h3>
          {!people && <p className="muted">{L('Loading…', 'جارٍ التحميل…')}</p>}
          {people && people.length === 0 && <p className="empty">{L('No reservations yet.', 'لا توجد حجوزات بعد.')}</p>}
          {people && people.length > 0 && (
            <div className="scroll"><table>
              <thead><tr><th>{L('Session', 'الجلسة')}</th><th>{L('Name', 'الاسم')}</th><th>{L('Participant', 'المشارك')}</th><th>{L('Reference', 'المرجع')}</th><th>{L('Status', 'الحالة')}</th><th>{L('Attendance', 'الحضور')}</th></tr></thead>
              <tbody>{people.map(p => (
                <tr key={p.reservation_id}>
                  <td>{dateTime(p.starts_at)}</td><td>{p.display_name || '—'}</td><td>{label(p.participant_band)}</td>
                  <td><span className="ref small" dir="ltr">{p.reference}</span></td>
                  <td>{p.status === 'confirmed' ? L('Confirmed', 'مؤكد') : L('Cancelled', 'ملغى')}</td>
                  <td>{p.status === 'confirmed' && (
                    <button className="btn small" aria-pressed={!!p.attended_at} onClick={() => attend(p, !p.attended_at)}>
                      {p.attended_at ? L('✓ Attended (undo)', '✓ حضر (تراجع)') : L('Mark attended', 'سجّل الحضور')}</button>)}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </section>
      )}

      <h2>{L('Publish a new listing', 'انشر نشاطاً جديداً')}</h2>
      <form className="panel form" onSubmit={createListing}>
        <div className="grid2">
          <label>{L('Host', 'المنظّم')}<select name="host_id">{hosts.map(h => <option key={h.id} value={h.id}>{pick(h.name_en, h.name_ar)}</option>)}</select></label>
          <label>{L('Type', 'النوع')}<select name="type">{['event', 'course', 'workshop'].map(t => <option key={t} value={t}>{label(t)}</option>)}</select></label>
          <label>{L('Title (English)', 'العنوان (بالإنجليزية)')}<input name="title_en" required minLength={3} maxLength={120} dir="ltr" /></label>
          <label>{L('Title (Arabic)', 'العنوان (بالعربية)')}<input name="title_ar" required minLength={3} maxLength={120} dir="rtl" /></label>
          <label>{L('Description (English)', 'الوصف (بالإنجليزية)')}<textarea name="description_en" maxLength={2000} rows={2} dir="ltr" /></label>
          <label>{L('Description (Arabic)', 'الوصف (بالعربية)')}<textarea name="description_ar" maxLength={2000} rows={2} dir="rtl" /></label>
          <label>{L('Category', 'الفئة')}<select name="category">{CATEGORIES.filter(c => c !== 'home').map(c => <option key={c} value={c}>{label(c)}</option>)}</select></label>
          <label>{L('Area', 'المنطقة')}<select name="area">{AREAS.map(a => <option key={a} value={a}>{label(a)}</option>)}</select></label>
          <label>{L('Price (KWD, 0 for free)', 'السعر (د.ك، 0 للمجاني)')}<input name="price" type="number" min="0" step="0.001" required defaultValue={0} dir="ltr" /></label>
          <label>{L('Duration (minutes)', 'المدة (بالدقائق)')}<input name="duration" type="number" min="15" max="600" required defaultValue={60} /></label>
          <label>{L('Minimum age', 'أدنى عمر')}<input name="min_age" type="number" min="0" max="99" defaultValue={3} /></label>
          <label>{L('Maximum age (blank for none)', 'أقصى عمر (اتركه فارغاً إن لم يوجد)')}<input name="max_age" type="number" min="0" max="99" /></label>
          <label>{L('Level', 'المستوى')}<select name="level">{['all', 'beginner', 'intermediate', 'advanced'].map(x => <option key={x} value={x}>{label(x)}</option>)}</select></label>
        </div>
        <button className="btn primary">{L('Publish listing', 'انشر النشاط')}</button>
      </form>
    </section>
  )
}
