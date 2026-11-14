import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Price, supabase, useApp } from '../lib/app'
import { useLabels } from '../lib/labels'
import { BANDS, CATEGORIES, bandEligible, isUpcoming, type Band, type Listing } from '../lib/types'

export async function fetchListings(): Promise<Listing[]> {
  const { data, error } = await supabase.from('listings')
    .select('*, host:hosts(*), occurrences(*)')
    .eq('status', 'published')
    .gt('occurrences.ends_at', new Date().toISOString())
    .order('starts_at', { referencedTable: 'occurrences' })
  if (error) throw error
  return (data as Listing[]).map(l => ({ ...l, occurrences: (l.occurrences ?? []).filter(o => isUpcoming(o, l.is_flexible)) }))
}

export function useSaved() {
  const { session } = useApp()
  const [saved, setSaved] = useState<string[]>([])
  const uid = session?.user.id
  useEffect(() => {
    if (!uid) { setSaved([]); return }
    supabase.from('saved_listings').select('listing_id').then(({ data }) => setSaved((data ?? []).map(r => r.listing_id)))
  }, [uid])
  async function toggle(id: string) {
    if (saved.includes(id)) {
      const { error } = await supabase.from('saved_listings').delete().eq('listing_id', id)
      if (!error) setSaved(s => s.filter(x => x !== id))
    } else {
      const { error } = await supabase.from('saved_listings').insert({ listing_id: id })
      if (!error) setSaved(s => [...s, id])
    }
  }
  return { saved, toggle, canSave: !!uid }
}

export default function Explore() {
  const { L, dateTime } = useApp()
  const { label, title, ages, band: bandLabel } = useLabels()
  const [listings, setListings] = useState<Listing[] | null>(null)
  const [error, setError] = useState(false)
  const [area, setArea] = useState('')
  const [category, setCategory] = useState('')
  const [band, setBand] = useState<Band | ''>('')
  const [onlySaved, setOnlySaved] = useState(false)
  const { saved, toggle, canSave } = useSaved()

  useEffect(() => { fetchListings().then(setListings).catch(() => setError(true)) }, [])
  const activities = useMemo(() => (listings ?? []).filter(l => l.type !== 'service'), [listings])
  const areas = useMemo(() => [...new Set(activities.map(l => l.area))].sort(), [activities])
  const shown = activities.filter(l =>
    (!area || l.area === area) && (!category || l.category === category)
    && (!band || bandEligible(band, l.min_age, l.max_age)) && (!onlySaved || saved.includes(l.id)))

  return (
    <section>
      <h1>{L('Explore activities in Kuwait', 'استكشف الأنشطة في الكويت')}</h1>
      <p className="muted">{L('Events, courses and workshops near you. Choose a session and reserve your place.',
        'فعاليات ودورات وورش قريبة منك. اختر جلسة واحجز مكانك.')}</p>
      <div className="filters" role="group" aria-label={L('Filters', 'عوامل التصفية')}>
        <label>{L('Area', 'المنطقة')}
          <select value={area} onChange={e => setArea(e.target.value)}>
            <option value="">{L('All areas', 'كل المناطق')}</option>
            {areas.map(a => <option key={a} value={a}>{label(a)}</option>)}
          </select>
        </label>
        <label>{L('Category', 'الفئة')}
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">{L('All categories', 'كل الفئات')}</option>
            {CATEGORIES.filter(c => c !== 'home').map(c => <option key={c} value={c}>{label(c)}</option>)}
          </select>
        </label>
        <label>{L('Who is taking part?', 'من سيشارك؟')}
          <select value={band} onChange={e => setBand(e.target.value as Band | '')}>
            <option value="">{L('Any age', 'أي عمر')}</option>
            {BANDS.map(b => <option key={b} value={b}>{bandLabel(b)}</option>)}
          </select>
        </label>
        {canSave && (
          <label className="check"><input type="checkbox" checked={onlySaved} onChange={e => setOnlySaved(e.target.checked)} />
            {L('Saved only', 'المحفوظة فقط')}</label>
        )}
      </div>

      {error && <p className="error" role="alert">{L('Could not load activities. Please refresh the page.', 'تعذّر تحميل الأنشطة. حدّث الصفحة.')}</p>}
      {!listings && !error && <p className="muted" aria-live="polite">{L('Loading activities…', 'جارٍ تحميل الأنشطة…')}</p>}
      {listings && shown.length === 0 && <p className="empty">{L('No activities match these filters. Try clearing one.', 'لا توجد أنشطة مطابقة. جرّب إزالة أحد عوامل التصفية.')}</p>}

      <ul className="cards">
        {shown.map(l => {
          const next = l.occurrences?.[0]
          const left = next ? next.capacity - next.booked_count : 0
          return (
            <li key={l.id} className="card">
              <div className="tags">
                <span className="tag">{label(l.type)}</span><span className="tag">{label(l.category)}</span>
                {l.is_flexible && <span className="tag flex">{L('Flexible · online', 'مرن · عبر الإنترنت')}</span>}
                {l.is_demo && <span className="tag demo">{L('Demo', 'تجريبي')}</span>}
              </div>
              <h2><Link to={`/listing/${l.id}`}>{title(l)}</Link></h2>
              <p className="muted">{l.host && (L(l.host.name_en, l.host.name_ar))} · {label(l.area)}</p>
              <dl className="facts">
                <div><dt>{L('Price', 'السعر')}</dt><dd><Price amount={l.price_amount} currency={l.price_currency} /></dd></div>
                <div><dt>{L('Ages', 'الأعمار')}</dt><dd>{ages(l.min_age, l.max_age)}</dd></div>
                <div><dt>{L('Level', 'المستوى')}</dt><dd>{label(l.level)}</dd></div>
                <div><dt>{l.is_flexible ? L('Access until', 'متاح حتى') : L('Next session', 'الجلسة القادمة')}</dt>
                  <dd>{next ? (l.is_flexible ? dateTime(next.ends_at) : dateTime(next.starts_at)) : L('No upcoming sessions', 'لا توجد جلسات قادمة')}</dd></div>
                {next && <div><dt>{L('Places left', 'الأماكن المتبقية')}</dt>
                  <dd>{left > 0 ? L(`${left} of ${next.capacity}`, `${left} من ${next.capacity}`) : L('Full', 'مكتمل')}</dd></div>}
              </dl>
              <div className="row">
                <Link className="btn primary" to={`/listing/${l.id}`}>{L('View and reserve', 'عرض وحجز')}</Link>
                {canSave && (
                  <button className="btn ghost" aria-pressed={saved.includes(l.id)} onClick={() => toggle(l.id)}>
                    {saved.includes(l.id) ? L('★ Saved', '★ محفوظ') : L('☆ Save', '☆ حفظ')}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
