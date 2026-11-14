// Focused backend checks against the real project: capacity, idempotency, cancellation, permissions.
// Usage (from web/):  node --env-file=.env tests/backend.test-script.mjs   (needs supabase/tests/fixtures.sql applied)
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes, randomUUID } from 'node:crypto'

const URL = process.env.VITE_SUPABASE_URL, KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const id = s => { const h = createHash('md5').update(s).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}` }
const O1 = id('t-o1'), O2 = id('t-o2'), O3 = id('t-o3'), O4 = id('t-o4'), L1 = id('t-l1'), HOST = id('t-host')
const BREAD = id('l-bread')
let pass = 0, fail = 0
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`) }
const client = () => createClient(URL, KEY, { auth: { persistSession: false } })
async function user(tag) {
  const email = `maydan-test-${tag}-${randomBytes(4).toString('hex')}@example.com`, password = randomBytes(12).toString('base64url')
  const r = await fetch(`${URL}/functions/v1/register`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY },
    body: JSON.stringify({ email, password, display_name: `Test ${tag}` }) })
  const j = await r.json(); if (!j.ok) throw new Error('register failed: ' + JSON.stringify(j))
  const c = client(); const { data, error } = await c.auth.signInWithPassword({ email, password }); if (error) throw error
  return { c, id: data.user.id, email, password }
}
const occ = async (c, o) => (await c.from('occurrences').select('booked_count,capacity').eq('id', o).single()).data
const reserve = (c, o, band = 'adult', key = randomUUID()) => c.rpc('reserve', { p_occurrence: o, p_band: band, p_key: key })

const [A, B, C] = await Promise.all([user('a'), user('b'), user('c')])
const anon = client()

// 1. last seat: two users, one seat
{
  const [ra, rb] = await Promise.all([reserve(A.c, O1), reserve(B.c, O1)])
  const wins = [ra, rb].filter(r => !r.error), losses = [ra, rb].filter(r => r.error)
  check('last seat: exactly one of two concurrent users succeeds', wins.length === 1 && losses.length === 1, JSON.stringify([ra.error, rb.error]))
  check('last seat: loser is told the session is full', losses[0]?.error.message.includes('sold_out'), losses[0]?.error?.message)
  check('last seat: booked_count equals capacity (1)', (await occ(anon, O1)).booked_count === 1)
  check('reference has the MYD-XXXX-XXXX format', /^MYD-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(wins[0].data.reference), wins[0].data?.reference)
  // cancellation restores capacity exactly once, even when requested twice at once
  const winner = ra.error ? B : A, rid = wins[0].data.id
  const [c1, c2] = await Promise.all([winner.c.rpc('cancel_reservation', { p_id: rid }), winner.c.rpc('cancel_reservation', { p_id: rid })])
  check('double cancel: both calls return without error', !c1.error && !c2.error, JSON.stringify([c1.error, c2.error]))
  check('double cancel: capacity restored exactly once (0 booked)', (await occ(anon, O1)).booked_count === 0)
  const again = await reserve(B.c === winner.c ? A.c : B.c, O1)
  check('freed seat can be booked by the other user', !again.error, again.error?.message)
}
// 2. repeated confirm clicks
{
  const key = randomUUID()
  const rs = await Promise.all(Array.from({ length: 6 }, () => reserve(C.c, O2, 'adult', key)))
  const refs = new Set(rs.filter(r => !r.error).map(r => r.data.reference))
  check('6 identical confirm clicks: all succeed with ONE reference', rs.every(r => !r.error) && refs.size === 1, JSON.stringify(rs.map(r => r.error?.message)))
  const rs2 = await Promise.all(Array.from({ length: 4 }, () => reserve(C.c, O2)))
  check('new attempts for the same session are refused (already_reserved)', rs2.every(r => r.error?.message.includes('already_reserved')))
  check('booked_count is 1 after 10 requests', (await occ(anon, O2)).booked_count === 1)
  const { data: mine } = await C.c.from('reservations').select('id').eq('occurrence_id', O2)
  check('exactly one reservation row exists', mine.length === 1)
  const overlap = await reserve(C.c, O3)
  check('overlapping session for the same participant is refused', overlap.error?.message.includes('time_conflict'), overlap.error?.message)
  const child = await reserve(C.c, O3, 'child_6_9')
  check('a different participant (child band) may attend the overlapping session', !child.error, child.error?.message)
}
// 3. eligibility and past sessions
{
  const past = await reserve(A.c, O4)
  check('past session is rejected', past.error?.message.includes('session_started'), past.error?.message)
  const { data: bread } = await anon.from('occurrences').select('id').eq('listing_id', BREAD).gt('starts_at', new Date().toISOString()).limit(1)
  const kid = await reserve(A.c, bread[0].id, 'child_6_9')
  check('adults-only workshop rejects a child age band', kid.error?.message.includes('not_eligible'), kid.error?.message)
  const anonTry = await reserve(anon, O2)
  check('signed-out visitor cannot reserve', !!anonTry.error)
}
// 4. privacy and permissions (direct requests)
{
  const { data: cRes } = await C.c.from('reservations').select('id,reference').eq('occurrence_id', O2).single()
  const peek = await B.c.from('reservations').select('*').eq('id', cRes.id)
  check('B cannot read C\'s reservation by id', (peek.data ?? []).length === 0)
  const byRef = await B.c.from('reservations').select('*').eq('reference', cRes.reference)
  check('knowing a booking reference does not grant access', (byRef.data ?? []).length === 0)
  const anonPeek = await anon.from('reservations').select('*')
  check('signed-out visitor cannot read reservations', !!anonPeek.error || (anonPeek.data ?? []).length === 0)
  const steal = await B.c.rpc('cancel_reservation', { p_id: cRes.id })
  check('B cannot cancel C\'s reservation', steal.error?.message.includes('not_found'), steal.error?.message)
  const upd = await B.c.from('reservations').update({ status: 'cancelled' }).eq('id', cRes.id).select()
  check('direct UPDATE on reservations is denied', !!upd.error || (upd.data ?? []).length === 0)
  const ins = await B.c.from('reservations').insert({ reference: 'X', occurrence_id: O2, participant_band: 'adult', price_amount: 0, price_currency: 'KWD', idempotency_key: randomUUID(), user_id: B.id })
  check('direct INSERT on reservations is denied', !!ins.error)
  const cnt = await B.c.from('occurrences').update({ booked_count: 0 }).eq('id', O2).select()
  check('direct change of booked_count is denied', !!cnt.error || (cnt.data ?? []).length === 0)
  const role = await B.c.from('host_members').insert({ host_id: HOST, user_id: B.id })
  check('a normal user cannot give themselves host access', !!role.error, 'insert succeeded')
  const edit = await B.c.from('listings').update({ title_en: 'Hacked title' }).eq('id', L1).select()
  check('a normal user cannot edit a host\'s listing', !!edit.error || (edit.data ?? []).length === 0)
  const create = await B.c.from('listings').insert({ host_id: HOST, type: 'event', title_en: 'Fake', title_ar: 'زائف', category: 'arts', area: 'Salmiya', price_amount: 1, duration_minutes: 60 })
  check('a normal user cannot publish a listing for a host', !!create.error)
  const parts = await B.c.rpc('host_participants', { p_listing: L1 })
  check('a normal user cannot list participants', parts.error?.message.includes('forbidden'), parts.error?.message)
  const att = await B.c.rpc('set_attendance', { p_reservation: cRes.id, p_attended: true })
  check('a normal user cannot mark attendance', att.error?.message.includes('forbidden'), att.error?.message)
  const pub = await anon.from('occurrences').select('*').eq('id', O2).single()
  check('public availability exposes counts only, no participant data', !('user_id' in pub.data) && Object.keys(pub.data).sort().join() === 'booked_count,capacity,ends_at,id,listing_id,starts_at,status')
  const prof = await B.c.from('profiles').select('*')
  check('a user can read only their own profile', prof.data.length === 1 && prof.data[0].id === B.id)
}
// 5. plans are private and reserve nothing
{
  const before = (await occ(anon, O1)).booked_count
  const sp = await A.c.rpc('save_plan', { p_title: 't', p_mode: 'manual', p_prefs: {}, p_items: [{ occurrence_id: O1 }, { occurrence_id: O2 }] })
  check('plan saves', !sp.error, sp.error?.message)
  check('saving a plan reserves nothing', (await occ(anon, O1)).booked_count === before)
  const mine = await A.c.from('plan_items').select('*'); const theirs = await B.c.from('plan_items').select('*')
  check('owner reads plan items; another user reads none', mine.data.length === 2 && theirs.data.length === 0)
  const rep = await B.c.from('price_reports').insert({ service_def_id: id('s-ac'), amount: 9, currency: 'KWD', area: 'Salmiya', includes_parts: false, includes_callout: true, observed_on: new Date().toISOString().slice(0, 10), verification: 'verified' })
  check('a user cannot submit a price report marked verified', !!rep.error)
}
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
