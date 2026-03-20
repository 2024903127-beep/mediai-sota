import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Heart, Eye, EyeOff, ArrowRight, Shield, Zap, Lock } from 'lucide-react'
import { authApi } from '../lib/api'
import { useAuthStore } from '../store/auth.store'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '' })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authApi.login(form)
      setAuth(data.data.user, data.data.token)
      toast.success('Welcome back!')
      navigate(data.data.user.consent_given_at ? '/dashboard' : '/consent')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid credentials')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-hero-gradient flex">
      {/* Left panel - desktop only */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] bg-brand-600 p-12">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Heart size={20} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-white font-bold text-xl">MediAI</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Your AI-powered<br />health assistant
          </h1>
          <p className="text-brand-100 text-lg leading-relaxed">
            Scan prescriptions, detect drug interactions, and understand your medications — safely.
          </p>
        </div>

        <div className="space-y-4">
          {[
            { icon: Zap,    text: 'OCR-powered prescription scanning' },
            { icon: Shield, text: 'Drug interaction detection' },
            { icon: Lock,   text: 'AES-256 encrypted health data' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-brand-100">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                <Icon size={15} className="text-white" />
              </div>
              <span className="text-sm font-medium">{text}</span>
            </div>
          ))}
          <p className="text-brand-200 text-xs pt-4 border-t border-white/10">
            Developed by <span className="text-white font-semibold">Rahul Mishra</span>
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-5">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-brand-md"
              style={{ background: 'linear-gradient(135deg,#16a37a,#0ea5e9)' }}>
              <Heart size={21} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-xl leading-none">MediAI</p>
              <p className="text-xs text-slate-400 mt-0.5">by Rahul Mishra</p>
            </div>
          </div>

          <div className="animate-slide-up">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Sign in</h2>
            <p className="text-slate-500 text-sm mb-7">Welcome back — your health data is waiting.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <input className="input" type="email" placeholder="you@example.com"
                  autoComplete="email" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input className="input pr-11" type={show ? 'text' : 'password'}
                    placeholder="Enter your password" autoComplete="current-password"
                    value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                  <button type="button" tabIndex={-1} onClick={() => setShow(!show)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5">
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full text-[15px] py-3 mt-2 shadow-brand-sm">
                {loading
                  ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in…</span>
                  : <span className="flex items-center gap-2">Sign in <ArrowRight size={16} /></span>
                }
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                No account?{' '}
                <Link to="/register" className="text-brand-600 font-semibold hover:text-brand-700 transition-colors">
                  Create one free →
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-8">
            ⚕️ MediAI assists — it does not replace your doctor.
          </p>
        </div>
      </div>
    </div>
  )
}
