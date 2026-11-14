import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Price, kuwaitDayKey, kuwaitToIso, supabase, useApp } from '../lib/app'
import { useLabels } from '../lib/labels'
import {
  eligibleCandidates, explainInfeasible, itemIssues, repairPlan, surprisePlan, validatePlan,
  type Candidate, type Issue, type Prefs, type Relaxation,
} from '../lib/planner'
import { AREAS, BANDS, CATEGORIES, CURRENCIES, type Band, type Currency } from '../lib/types'
import { fetchListings, useSaved } from './Explore'

type Mode = 'manual' | 'ai' | 'surprise'
type AiNotes = { summary: string; clarification: string; reasons: Record<string, string>; model: string } | null
type Form = { interests: string[]; area: string; band: Band; budget: string; budget_currency: Currency; days: string[]; from: string; to: string; note: string }

const nextDays = () => Array.from({ length: 10 }, (_, i) => kuwaitDayKey(new Date(Date.now() + i * 86400000).toISOString()))
const defaultForm = (): Form => {
  const days = nextDays()
  const weekend = days.slice(1).filter(d => [5, 6].includes(new Date(d + 'T12:00:00+03:00').getUTCDay())).slice(0, 2)
  return { interests: [], area: '', band: 'adult', budget: '', budget_currency: 'KWD', days: weekend, from: '08:00', to: '22:00', note: '' }
}

export default function Plan() {
  const { L, session, convert, money, dateTime, time, day, bufferMinutes, fxMode, lang } = useApp()
  const { label, title, band: bandLabel } = useLabels()
  const { saved } = useSaved()
  const [all, setAll] = useState<Candidate[] | null>(null)
  const [form, setForm] = useState<Form>(defaultForm)
  const [mode, setMode] = useState<Mode>('manual')
  const [items, setItems] = useState<Candidate[]>([])
  const [ai, setAi] = useState<AiNotes>(null)
  const [message, setMessage] = useState('')
  const [relax, setRelax] = useState<Relaxation[]>([])
  const [busy, setBusy] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [stale, setStale] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [pickListing, setPickListing] = useState('')
  const uid = session?.user.id

  const loadCandidates = useCallback(async () => {
    const listings = await fetchListings()
    const out: Candidate[] = listings.flatMap(l => (l.occurrences ?? []).map(o => ({
      occurrence_id: o.id, listing_id: l.id, host_id: l.host_id, type: l.type, title_en: l.title_en, title_ar: l.title_ar,
      category: l.category, area: l.area, is_flexible: l.is_flexible, starts_at: o.starts_at, ends_at: o.ends_at,
      duration_minutes: l.duration_minutes, price_amount: Number(l.price_amount), price_currency: l.price_currency,
      min_age: l.min_age, max_age: l.max_age, seats_left: o.capacity - o.booked_count,
    })))
    setAll(out)
    return out
  }, [])
  useEffect(() => { loadCandidates().catch(() => setMessage(L('Could not load the catalogue. Please refresh.', 'تعذّر تحميل الأنشطة. حدّث الصفحة.'))) }, [loadCandidates]) // eslint-disable-line

  // Restore the saved plan after refresh or sign-in.
  useEffect(() => {
    if (!uid || !all || loaded) return
    (async () => {
      const { data: plan } = await supabase.from('plans').select('*, plan_items(*)').maybeSingle()
      setLoaded(true)
      if (!plan) return
      if (plan.prefs?.form) setForm({ ...defaultForm(), ...plan.prefs.form })
      setMode(plan.mode); setAi(plan.ai_notes ?? null)
      const ids: string[] = (plan.plan_items ?? []).sort((a: { position: number }, b: { position: number }) => a.position - b.position).map((i: { occurrence_id: string }) => i.occurrence_id)
      const found = ids.map(id => all.find(c => c.occurrence_id === id)).filter((c): c is Candidate => !!c)
      setItems(found); setStale(ids.length - found.length); setSaveState('saved')
    })()
  }, [uid, all, loaded])

  const prefs: Prefs = useMemo(() => ({
    interests: form.interests, area: form.area || null, band: form.band,
    budget: form.budget === '' ? null : Number(form.budget), budget_currency: form.budget_currency,
    windows: form.days.filter(() => form.to > form.from).map(d => ({ start: kuwaitToIso(d, form.from), end: kuwaitToIso(d, form.to) })),
  }), [form])
  const opts = useMemo(() => ({ bufferMinutes, convert, now: Date.now() }), [bufferMinutes, convert])
  const validation = useMemo(() => validatePlan(items, prefs, opts), [items, prefs, opts])
  const sorted = useMemo(() => [...items].sort((a, b) => Number(a.is_flexible) - Number(b.is_flexible) || a.starts_at.localeCompare(b.starts_at)), [items])
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setForm(f => ({ ...f, [k]: v })); setSaveState('idle') }
  const change = (next: Candidate[]) => { setItems(next); setSaveState('idle'); setStale(0) }

  function explain(pool: Candidate[]) {
    const r = explainInfeasible(pool, prefs, opts)
    setRelax(r)
    setMessage(prefs.windows.length === 0
      ? L('Choose at least one day and a valid time range.', 'اختر يوماً واحداً على الأقل ووقتاً صحيحاً.')
      : L('No plan fits all of your choices.', 'لا توجد خطة تناسب كل اختياراتك.'))
  }

  async function runSurprise() {
    setBusy(true); setMessage(''); setRelax([]); setAi(null)
    const pool = await loadCandidates()
    const plan = surprisePlan(pool, prefs, { ...opts, now: Date.now() })
    setBusy(false); setMode('surprise')
    if (plan.length === 0) { explain(pool); return }
    change(plan)
  }

  async function runAi() {
    if (!session) { setMessage(L('Sign in to use the AI planner. Manual and Surprise modes work without an account.', 'سجّل الدخول لاستخدام المخطِّط الذكي. الوضع اليدوي ووضع المفاجأة يعملان بدون حساب.')); return }
    setBusy(true); setMessage(''); setRelax([])
    const pool = await loadCandidates()
    const { data, error } = await supabase.functions.invoke('plan-ai', {
      body: { ...prefs, note: form.note, lang, buffer_minutes: bufferMinutes },
    })
    setBusy(false)
    const code: string = error ? 'ai_failed' : data?.error ?? ''
    if (code) {
      if (code === 'no_candidates' || code === 'no_time_windows') { explain(pool); return }
      setMessage(({
        ai_not_configured: L('The AI planner is not configured on this site yet.', 'المخطِّط الذكي غير مفعّل في هذا الموقع بعد.'),
        rate_limited: L('You have used the AI planner several times. Please wait a few minutes.', 'استخدمت المخطِّط الذكي عدة مرات. انتظر بضع دقائق.'),
        ai_timeout: L('The AI planner took too long to answer.', 'تأخر المخطِّط الذكي في الرد.'),
        not_authenticated: L('Please sign in again.', 'يرجى تسجيل الدخول مجدداً.'),
      } as Record<string, string>)[code] ?? L('The AI planner is unavailable right now.', 'المخطِّط الذكي غير متاح حالياً.'))
      setMessage(m => m + ' ' + L('You can use “Surprise me” or build the plan manually below.', 'يمكنك استخدام «فاجئني» أو بناء الخطة يدوياً أدناه.'))
      return
    }
    // The model only proposes IDs. Everything else is recalculated here; anything that breaks a rule is dropped.
    const proposed = (data.items as { occurrence_id: string; reason: string }[])
      .map(i => pool.find(c => c.occurrence_id === i.occurrence_id)).filter((c): c is Candidate => !!c)
    const { kept, dropped } = repairPlan(proposed, prefs, { ...opts, now: Date.now() })
    const reasons = Object.fromEntries((data.items as { occurrence_id: string; reason: string }[]).map(i => [i.occurrence_id, i.reason]))
    setMode('ai'); setAi({ summary: data.summary, clarification: data.clarification, reasons, model: data.model })
    change(kept)
    const removed = dropped.length + (data.rejected_unknown_ids ?? 0)
    if (kept.length === 0) explain(pool)
    else if (removed > 0) setMessage(L(`${removed} AI suggestion(s) were removed because they broke a rule (time, budget, eligibility or availability).`, `أُزيل ${removed} اقتراح(ات) لمخالفتها أحد الشروط (الوقت أو الميزانية أو الأهلية أو التوفر).`))
  }

  function swap(c: Candidate) {
    if (!all) return
    const rest = items.filter(i => i.occurrence_id !== c.occurrence_id)
    const used = new Set(items.map(i => i.listing_id))
    const pool = eligibleCandidates(all, prefs, Date.now()).filter(x => !used.has(x.listing_id) || (x.listing_id === c.listing_id && x.occurrence_id !== c.occurrence_id))
    const start = Math.floor(Math.random() * Math.max(pool.length, 1))
    for (let i = 0; i < pool.length; i++) {
      const alt = pool[(start + i) % pool.length]
      if (validatePlan([...rest, alt], prefs, opts).ok) { change([...rest, alt]); setMessage(''); return }
    }
    setMessage(L('No other option fits in place of that item.', 'لا يوجد خيار آخر مناسب بدلاً من هذا العنصر.'))
  }

  async function save() {
    setSaveState('saving')
    const { error } = await supabase.rpc('save_plan', {
      p_title: '', p_mode: mode, p_prefs: { form }, p_items: sorted.map(i => ({ occurrence_id: i.occurrence_id })), p_ai_notes: mode === 'ai' ? ai : null,
    })
    setSaveState(error ? 'error' : 'saved')
  }

  const issueText = (i: Issue) => {
    const c = items.find(x => x.occurrence_id === i.occurrence_id), o = items.find(x => x.occurrence_id === i.other_id)
    const n = c ? `“${title(c)}”` : ''
    return ({
      not_eligible: L(`${n} is not open to the selected participant age.`, `${n} غير متاح لعمر المشارك المحدد.`),
      full: L(`${n} is now full.`, `${n} اكتمل.`),
      started: L(`${n} has already started.`, `${n} بدأ بالفعل.`),
      outside_time: L(`${n} is outside your available days or hours.`, `${n} خارج أيامك أو ساعاتك المتاحة.`),
      overlap: L(`${n} overlaps “${o ? title(o) : ''}”.`, `${n} يتعارض مع «${o ? title(o) : ''}».`),
      buffer: L(`Less than ${bufferMinutes} minutes between “${o ? title(o) : ''}” and ${n} (planning buffer between venues).`, `أقل من ${bufferMinutes} دقيقة بين «${o ? title(o) : ''}» و${n} (هامش التخطيط بين الأماكن).`),
      over_budget: L('The total is over your budget.', 'الإجمالي يتجاوز ميزانيتك.'),
      fx_unavailable: L('Prices are in a different currency from your budget and no exchange rate is available. Choose listings in your budget currency or remove the budget.', 'الأسعار بعملة مختلفة عن ميزانيتك ولا يتوفر سعر صرف. اختر أنشطة بعملة ميزانيتك أو احذف الميزانية.'),
      duplicate: L(`${n} is in the plan twice.`, `${n} مكرر في الخطة.`),
    } as Record<string, string>)[i.code]
  }
  const relaxText: Record<Relaxation, string> = {
    interests: L('choose more interests (or none)', 'اختر اهتمامات أكثر (أو بدون)'), area: L('allow any area', 'اسمح بأي منطقة'),
    budget: L('raise or remove the budget', 'ارفع الميزانية أو احذفها'), time: L('add more days or longer hours', 'أضف أياماً أو ساعات أكثر'),
    age: L('plan for a different participant age', 'خطّط لعمر مشارك مختلف'),
  }

  // manual mode: add from saved listings (or the whole catalogue)
  const listingChoices = useMemo(() => {
    const m = new Map<string, Candidate>()
    for (const c of all ?? []) if (!m.has(c.listing_id)) m.set(c.listing_id, c)
    return [...m.values()].sort((a, b) => Number(saved.includes(b.listing_id)) - Number(saved.includes(a.listing_id)) || a.title_en.localeCompare(b.title_en))
  }, [all, saved])
  const sessionChoices = (all ?? []).filter(c => c.listing_id === pickListing && itemIssues(c, prefs, Date.now()).filter(x => x !== 'outside_time').length === 0).slice(0, 40)

  return (
    <section>
      <h1>{L('Plan your weekend', 'خطّط لعطلتك')}</h1>
      <p className="muted">{L('Tell us what you like and when you are free. A plan is only a list: nothing is reserved until you book each item.',
        'أخبرنا بما تحب ومتى تكون متفرغاً. الخطة مجرد قائمة: لا يُحجز شيء حتى تحجز كل عنصر بنفسك.')}</p>

      <form className="panel" onSubmit={e => e.preventDefault()}>
        <fieldset className="slots"><legend>{L('Interests', 'الاهتمامات')}</legend>
          {CATEGORIES.map(c => (
            <label key={c} className="check"><input type="checkbox" checked={form.interests.includes(c)}
              onChange={e => set('interests', e.target.checked ? [...form.interests, c] : form.interests.filter(x => x !== c))} />{label(c)}</label>
          ))}
        </fieldset>
        <div className="grid2">
          <label>{L('Area', 'المنطقة')}
            <select value={form.area} onChange={e => set('area', e.target.value)}>
              <option value="">{L('Any area', 'أي منطقة')}</option>{AREAS.map(a => <option key={a} value={a}>{label(a)}</option>)}
            </select></label>
          <label>{L('Who is the plan for?', 'لمن الخطة؟')}
            <select value={form.band} onChange={e => set('band', e.target.value as Band)}>{BANDS.map(b => <option key={b} value={b}>{bandLabel(b)}</option>)}</select></label>
          <label>{L('Budget (optional)', 'الميزانية (اختياري)')}
            <input type="number" inputMode="decimal" min="0" step="0.001" value={form.budget} onChange={e => set('budget', e.target.value)} dir="ltr" /></label>
          <label>{L('Budget currency', 'عملة الميزانية')}
            <select value={form.budget_currency} onChange={e => set('budget_currency', e.target.value as Currency)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></label>
        </div>
        <fieldset className="slots"><legend>{L('Days you are free', 'الأيام المتاحة')}</legend>
          {nextDays().map(d => (
            <label key={d} className="check"><input type="checkbox" checked={form.days.includes(d)}
              onChange={e => set('days', e.target.checked ? [...form.days, d].sort() : form.days.filter(x => x !== d))} />{day(d + 'T12:00:00+03:00')}</label>
          ))}
        </fieldset>
        <div className="grid2">
          <label>{L('From (Kuwait time)', 'من (توقيت الكويت)')}<input type="time" value={form.from} onChange={e => set('from', e.target.value)} /></label>
          <label>{L('Until', 'حتى')}<input type="time" value={form.to} onChange={e => set('to', e.target.value)} /></label>
          <label>{L('Anything else? (optional, for the AI planner)', 'أي ملاحظة؟ (اختياري، للمخطِّط الذكي)')}
            <input value={form.note} maxLength={300} onChange={e => set('note', e.target.value)} /></label>
        </div>
        <div className="row">
          <button className="btn primary" disabled={busy || !all} onClick={runAi}>{busy ? L('Working…', 'جارٍ العمل…') : L('Suggest with AI', 'اقترح بالذكاء الاصطناعي')}</button>
          <button className="btn" disabled={busy || !all} onClick={runSurprise}>{L('Surprise me (random, not AI)', 'فاجئني (عشوائي، بدون ذكاء اصطناعي)')}</button>
        </div>
      </form>

      {message && (
        <div className="panel warn" role="status">
          <p><strong>{message}</strong></p>
          {relax.length > 0 && <p>{L('It would work if you:', 'ستنجح الخطة إذا:')} {relax.map(r => relaxText[r]).join(L(' · or ', ' · أو '))}.</p>}
        </div>
      )}

      <h2>{L('Your plan', 'خطتك')} {items.length > 0 && <span className="tag">{mode === 'ai' ? L('AI suggestion, checked by Maydan rules', 'اقتراح ذكي، مُراجَع وفق قواعد ميدان') : mode === 'surprise' ? L('Random selection (not AI)', 'اختيار عشوائي (ليس ذكاءً اصطناعياً)') : L('Built manually', 'بُنيت يدوياً')}</span>}</h2>
      {mode === 'ai' && ai && items.length > 0 && (
        <p>{ai.summary} {ai.clarification && <em>{ai.clarification}</em>} <span className="muted small">({L('model', 'النموذج')}: {ai.model})</span></p>
      )}
      {stale > 0 && <p className="error">{L(`${stale} saved item(s) are no longer available and were removed.`, `${stale} عنصر(عناصر) محفوظة لم تعد متاحة وأُزيلت.`)}</p>}
      {items.length === 0 && <p className="empty">{L('Your plan is empty. Use a button above, or add items manually below.', 'خطتك فارغة. استخدم أحد الأزرار أعلاه أو أضف عناصر يدوياً أدناه.')}</p>}
      <ul className="cards">
        {sorted.map(c => (
          <li key={c.occurrence_id} className={'card block' + (c.is_flexible ? ' flexible' : '')}>
            <div className="tags">
              <span className={'tag' + (c.is_flexible ? ' flex' : '')}>{c.is_flexible ? L('Flexible · any time', 'مرن · في أي وقت') : L('Fixed time', 'وقت ثابت')}</span>
              <span className="tag">{label(c.category)}</span>
            </div>
            <h3>{title(c)}</h3>
            <p>{c.is_flexible ? L(`Online, any time until ${dateTime(c.ends_at)} (about ${c.duration_minutes} min)`, `عبر الإنترنت، في أي وقت حتى ${dateTime(c.ends_at)} (نحو ${c.duration_minutes} دقيقة)`) : `${dateTime(c.starts_at)} – ${time(c.ends_at)} · ${label(c.area)}`}</p>
            <p><Price amount={c.price_amount} currency={c.price_currency} /> · {L(`${c.seats_left} places left`, `${c.seats_left} مقاعد متاحة`)}</p>
            {mode === 'ai' && ai?.reasons[c.occurrence_id] && <p className="muted small">{L('Why', 'السبب')}: {ai.reasons[c.occurrence_id]}</p>}
            <div className="row">
              <Link className="btn primary small" to={`/listing/${c.listing_id}?occ=${c.occurrence_id}`}>{L('Book this', 'احجز هذا')}</Link>
              <button className="btn ghost small" onClick={() => swap(c)}>{L('Swap', 'بدّل')}</button>
              <button className="btn ghost small" onClick={() => change(items.filter(i => i.occurrence_id !== c.occurrence_id))}>{L('Remove', 'أزل')}</button>
            </div>
          </li>
        ))}
      </ul>

      {items.length > 0 && (
        <div className="panel">
          <p><strong>{L('Total of listed prices', 'إجمالي الأسعار المعلنة')}:</strong>{' '}
            {Object.entries(validation.totalsByCurrency).map(([cur, amt]) => money(amt, cur)).join(' + ') || money(0, form.budget_currency)}
            {validation.total !== null && Object.keys(validation.totalsByCurrency).some(c => c !== form.budget_currency) &&
              <> ≈ {money(validation.total, form.budget_currency)} <small>({fxMode === 'demo' ? L('illustrative demo rate', 'سعر صرف توضيحي') : L('converted', 'محوّل')})</small></>}
            {prefs.budget !== null && <> · {L('Budget', 'الميزانية')}: {money(prefs.budget, form.budget_currency)}</>}
          </p>
          {validation.issues.length > 0
            ? <ul className="error">{validation.issues.map((i, k) => <li key={k}>{issueText(i)}</li>)}</ul>
            : <p className="muted">{L(`Checked: ages, places, your free time, no overlaps, ${bufferMinutes}-minute buffer between venues (a planning assumption, not a travel estimate)${prefs.budget !== null ? ', budget' : ''}.`,
                `تم التحقق: الأعمار، المقاعد، وقتك المتاح، عدم التعارض، هامش ${bufferMinutes} دقيقة بين الأماكن (افتراض تخطيطي وليس تقديراً للتنقل)${prefs.budget !== null ? '، الميزانية' : ''}.`)}</p>}
          <p className="muted small">{L('Nothing is reserved yet. Use “Book this” on each item; availability is checked again when you confirm.', 'لم يُحجز شيء بعد. استخدم «احجز هذا» لكل عنصر؛ يُعاد التحقق من التوفر عند التأكيد.')}</p>
          <div className="row">
            {session
              ? <button className="btn primary" onClick={save} disabled={saveState === 'saving' || saveState === 'saved'}>
                  {saveState === 'saved' ? L('✓ Plan saved', '✓ حُفظت الخطة') : saveState === 'saving' ? L('Saving…', 'جارٍ الحفظ…') : L('Save plan', 'احفظ الخطة')}</button>
              : <Link className="btn" to="/signin?next=/plan">{L('Sign in to save this plan', 'سجّل الدخول لحفظ الخطة')}</Link>}
            {saveState === 'error' && <span className="error" role="alert">{L('Could not save. Try again.', 'تعذّر الحفظ. حاول مجدداً.')}</span>}
          </div>
        </div>
      )}

      <h2>{L('Add items manually', 'أضف عناصر يدوياً')}</h2>
      <div className="panel">
        <div className="grid2">
          <label>{L('Activity or service (saved items first)', 'النشاط أو الخدمة (المحفوظة أولاً)')}
            <select value={pickListing} onChange={e => setPickListing(e.target.value)}>
              <option value="">{L('Choose…', 'اختر…')}</option>
              {listingChoices.map(c => <option key={c.listing_id} value={c.listing_id}>{saved.includes(c.listing_id) ? '★ ' : ''}{title(c)} · {label(c.area)}</option>)}
            </select></label>
        </div>
        {pickListing && sessionChoices.length === 0 && <p className="empty">{L('No bookable session for the selected participant.', 'لا توجد جلسة متاحة للمشارك المحدد.')}</p>}
        <div className="slots">
          {sessionChoices.map(c => (
            <button key={c.occurrence_id} className="slot" style={{ padding: '4px 10px' }} disabled={items.some(i => i.occurrence_id === c.occurrence_id)}
              onClick={() => { setMode('manual'); setAi(null); setMessage(''); change([...items.filter(i => i.listing_id !== c.listing_id), c]) }}>
              + {c.is_flexible ? L('Flexible access', 'وصول مرن') : dateTime(c.starts_at)}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
