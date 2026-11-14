import { HashRouter, NavLink, Route, Routes, Link } from 'react-router-dom'
import { AppProvider, supabase, useApp } from './lib/app'
import { CURRENCIES, type Currency } from './lib/types'
import Explore from './pages/Explore'
import ListingDetail from './pages/ListingDetail'
import Bookings from './pages/Bookings'
import SignIn from './pages/SignIn'
import Services from './pages/Services'
import Plan from './pages/Plan'
import HostDashboard from './pages/HostDashboard'

function Shell() {
  const { L, lang, setLang, currency, setCurrency, session, hostIds, fxMode, fx, dateTime } = useApp()
  return (
    <>
      <a className="skip" href="#main">{L('Skip to content', 'تخطَّ إلى المحتوى')}</a>
      <header className="top">
        <div className="top-row">
          <Link to="/" className="brand" aria-label="Maydan">
            <img src="/maydan-logo.webp" alt="MAYDAN" width="150" height="50" />
          </Link>
          <div className="prefs">
            <label>
              <span className="sr">{L('Display currency', 'عملة العرض')}</span>
              <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} aria-label={L('Display currency', 'عملة العرض')}>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <button className="btn ghost" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} lang={lang === 'ar' ? 'en' : 'ar'}>
              {lang === 'ar' ? 'English' : 'العربية'}
            </button>
            {session
              ? <button className="btn ghost" onClick={() => supabase.auth.signOut()}>{L('Sign out', 'تسجيل الخروج')}</button>
              : <Link className="btn" to="/signin">{L('Sign in', 'تسجيل الدخول')}</Link>}
          </div>
        </div>
        <nav className="nav" aria-label={L('Main', 'الرئيسية')}>
          <NavLink to="/" end>{L('Explore', 'استكشف')}</NavLink>
          <NavLink to="/services">{L('Services', 'الخدمات')}</NavLink>
          <NavLink to="/plan">{L('My Plan', 'خطتي')}</NavLink>
          <NavLink to="/bookings">{L('My Bookings', 'حجوزاتي')}</NavLink>
          {hostIds.length > 0 && <NavLink to="/host">{L('Host Dashboard', 'لوحة المنظّم')}</NavLink>}
        </nav>
      </header>
      <div className="demo-banner" role="note">
        {L('Pilot demonstration: all hosts, providers and prices shown are fictional. No payments are taken.',
           'عرض تجريبي: جميع المنظّمين والمزوّدين والأسعار خيالية. لا تُحصَّل أي مدفوعات.')}
      </div>
      <main id="main" className="page">
        <Routes>
          <Route path="/" element={<Explore />} />
          <Route path="/listing/:id" element={<ListingDetail />} />
          <Route path="/services" element={<Services />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/host" element={<HostDashboard />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="*" element={<p>{L('Page not found.', 'الصفحة غير موجودة.')} <Link to="/">{L('Go to Explore', 'اذهب إلى استكشف')}</Link></p>} />
        </Routes>
      </main>
      <footer className="foot">
        <p>
          <strong>{L('Currency display', 'عرض العملات')}:</strong>{' '}
          {fxMode === 'disabled' || !fx
            ? L('Conversion is off. Prices are shown in their original currency only.', 'التحويل متوقف. تُعرض الأسعار بعملتها الأصلية فقط.')
            : fxMode === 'demo'
              ? L(`Converted amounts use illustrative demo rates (${fx.source}, dated ${dateTime(fx.effective_at)}). They are not live market rates.`,
                  `المبالغ المحوّلة تستخدم أسعار صرف توضيحية (بتاريخ ${dateTime(fx.effective_at)}) وليست أسعار السوق الحية.`)
              : L(`Rates from ${fx.source}, provider timestamp ${dateTime(fx.effective_at)}. ${fx.refresh_policy}`,
                  `الأسعار من ${fx.source}، بتاريخ ${dateTime(fx.effective_at)}.`)}
          {' '}{L('Original prices always apply. Maydan does not process payments or exchange currency.',
                  'السعر الأصلي هو المعتمد دائماً. ميدان لا يعالج المدفوعات ولا يصرف العملات.')}
        </p>
        <p>{L('All times are Kuwait time.', 'جميع الأوقات بتوقيت الكويت.')}</p>
      </footer>
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter><Shell /></HashRouter>
    </AppProvider>
  )
}
