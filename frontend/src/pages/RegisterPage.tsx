import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Heart, Eye, EyeOff, ArrowRight, User, Stethoscope } from 'lucide-react'
import { authApi } from '../lib/api'
import { useAuthStore } from '../store/auth.store'
import { clsx } from 'clsx'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '', phone: '', role: 'patient', language_pref: 'en' })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pwStrength, setPwStrength] = useState(0)

  const checkStrength = (pw: string) => {
    let s = 0
    if (pw.length >= 8) s++
    if (/[A-Z]/.test(pw)) s++
    if (/[0-9]/.test(pw)) s++
    if (/[^A-Za-z0-9]/.test(pw)) s++
    setPwStrength(s)
  }

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColor = ['', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-400']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters')
    setLoading(true)
    try {
      const { data } = await authApi.register(form)
      setAuth(data.data.user, data.data.token)
      toast.success('Account created!')
      navigate('/consent')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-hero-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-brand-md"
            style={{ background: 'linear-gradient(135deg,#16a37a,#0ea5e9)' }}>
            <Heart size={21} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-xl leading-none">MediAI</p>
            <p className="text-xs text-slate-400 mt-0.5">by Rahul Mishra</p>
          </div>
        </div>

        <div className="card animate-slide-up !p-6 md:!p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Create account</h2>
          <p className="text-slate-500 text-sm mb-6">Join thousands managing their health smarter.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role selector */}
            <div>
              <label className="label">I am a</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val: 'patient', icon: User,          label: 'Patient',       sub: 'Personal health tracking' },
                  { val: 'doctor',  icon: Stethoscope,   label: 'Doctor',        sub: 'Hospital dashboard access' },
                ].map(({ val, icon: Icon, label, sub }) => (
                  <button key={val} type="button" onClick={() => setForm(f => ({ ...f, role: val }))}
                    className={clsx(
                      'flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 transition-all text-center',
                      form.role === val
                        ? 'border-brand-500 bg-brand-50 shadow-brand-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    )}>
                    <Icon size={20} className={form.role === val ? 'text-brand-600' : 'text-slate-400'} />
                    <span className={clsx('text-sm font-semibold', form.role === val ? 'text-brand-700' : 'text-slate-700')}>{label}</span>
                    <span className="text-xs text-slate-400 leading-tight">{sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Email address</label>
              <input className="input" type="email" placeholder="you@example.com" autoComplete="email"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input className="input pr-11" type={show ? 'text' : 'password'}
                  placeholder="Min 8 characters" autoComplete="new-password"
                  value={form.password} onChange={e => { setForm(f => ({ ...f, password: e.target.value })); checkStrength(e.target.value) }} required />
                <button type="button" tabIndex={-1} onClick={() => setShow(!show)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={clsx('h-1 flex-1 rounded-full transition-all duration-300', i <= pwStrength ? strengthColor[pwStrength] : 'bg-slate-100')} />
                    ))}
                  </div>
                  {pwStrength > 0 && <p className={clsx('text-xs font-medium', pwStrength === 4 ? 'text-emerald-600' : pwStrength === 3 ? 'text-blue-600' : pwStrength === 2 ? 'text-amber-600' : 'text-red-500')}>{strengthLabel[pwStrength]} password</p>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Phone <span className="text-slate-400 font-normal">(optional)</span></label>
                <input className="input" type="tel" placeholder="+91 98765 43210"
                  value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="label">Language</label>
                <select className="input" value={form.language_pref}
                  onChange={e => setForm(f => ({ ...f, language_pref: e.target.value }))}>
                  <option value="en">English</option>
                  <option value="hi">हिन्दी</option>
                </select>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full text-[15px] py-3 shadow-brand-sm mt-2">
              {loading
                ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account…</span>
                : <span className="flex items-center gap-2">Create account <ArrowRight size={16} /></span>
              }
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-600 font-semibold hover:text-brand-700">Sign in →</Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          ⚕️ MediAI is an informational tool, not a medical device.
        </p>
      </div>
    </div>
  )
}
