import { useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { supabase, useApp } from '../lib/app'

export default function SignIn() {
  const { L, session } = useApp()
  const [params] = useSearchParams()
  const next = params.get('next') || '/bookings'
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (session) return <Navigate to={next} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      if (mode === 'up') {
        // Pilot registration: the account is created by a server function without an email round-trip.
        const { data, error: fnErr } = await supabase.functions.invoke('register', { body: { email, password, display_name: name } })
        const code = (data as { error?: string } | null)?.error ?? (fnErr ? 'failed' : '')
        if (code) {
          setError(code === 'email_taken' ? L('An account with this email already exists. Sign in instead.', 'يوجد حساب بهذا البريد. سجّل الدخول.')
            : code === 'rate_limited' ? L('Too many sign-ups from this network. Please try again later.', 'محاولات كثيرة. حاول لاحقاً.')
            : code === 'weak_password' ? L('Please use a password of at least 8 characters.', 'استخدم كلمة مرور من 8 أحرف على الأقل.')
            : code === 'invalid_email' ? L('Please enter a valid email address.', 'أدخل بريداً إلكترونياً صحيحاً.')
            : L('Could not create the account. Please try again.', 'تعذّر إنشاء الحساب. حاول مرة أخرى.'))
          return
        }
      }
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signErr) setError(L('Email or password is not correct.', 'البريد أو كلمة المرور غير صحيحة.'))
    } finally { setBusy(false) }
  }

  return (
    <section className="narrow">
      <h1>{mode === 'in' ? L('Sign in', 'تسجيل الدخول') : L('Create an account', 'إنشاء حساب')}</h1>
      <p className="muted">{L('You can browse without an account. Sign in to reserve a place or save a plan.',
        'يمكنك التصفح بدون حساب. سجّل الدخول لحجز مكان أو حفظ خطة.')}</p>
      <form onSubmit={submit} className="form">
        {mode === 'up' && (
          <label>{L('Your name (shown to hosts you book with)', 'اسمك (يظهر للمنظّمين الذين تحجز لديهم)')}
            <input value={name} onChange={e => setName(e.target.value)} required maxLength={80} autoComplete="name" />
          </label>
        )}
        <label>{L('Email', 'البريد الإلكتروني')}
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" dir="ltr" />
        </label>
        <label>{L('Password (8 characters or more)', 'كلمة المرور (8 أحرف أو أكثر)')}
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'} dir="ltr" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy}>
          {busy ? L('Please wait…', 'يرجى الانتظار…') : mode === 'in' ? L('Sign in', 'تسجيل الدخول') : L('Create account', 'إنشاء الحساب')}
        </button>
      </form>
      <p>
        <button className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError('') }}>
          {mode === 'in' ? L('New here? Create an account', 'جديد هنا؟ أنشئ حساباً') : L('Already have an account? Sign in', 'لديك حساب؟ سجّل الدخول')}
        </button>
      </p>
      {mode === 'up' && <p className="muted small">{L('Pilot note: email addresses are not verified in this demonstration.', 'ملاحظة: لا يتم التحقق من البريد الإلكتروني في هذا العرض التجريبي.')}</p>}
    </section>
  )
}
