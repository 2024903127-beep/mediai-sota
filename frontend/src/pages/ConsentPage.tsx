import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ShieldCheck, Lock, Trash2, Eye, ArrowRight, Heart } from 'lucide-react'
import { authApi } from '../lib/api'
import { useAuthStore } from '../store/auth.store'
import { clsx } from 'clsx'

const POINTS = [
  { icon: Lock,         color: 'bg-brand-50 text-brand-600',  title: 'AES-256 encryption',    desc: 'Every health record is encrypted at rest with military-grade AES-256-GCM encryption.' },
  { icon: Eye,          color: 'bg-blue-50 text-blue-600',    title: 'Full data transparency', desc: 'View exactly what we store. Export or delete your data at any time, instantly.' },
  { icon: ShieldCheck,  color: 'bg-purple-50 text-purple-600',title: 'Zero data selling',      desc: 'We never sell, share, or monetise your health information. Ever. Period.' },
  { icon: Trash2,       color: 'bg-red-50 text-red-600',      title: 'Right to deletion',      desc: 'Request full account and data deletion anytime. Processed within 30 days.' },
]

export default function ConsentPage() {
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setUser, user } = useAuthStore()
  const navigate = useNavigate()

  const handleConsent = async () => {
    if (!agreed) return toast.error('Please agree to continue')
    setLoading(true)
    try {
      await authApi.consent()
      if (user) setUser({ ...user, consent_given_at: new Date().toISOString() })
      toast.success('Welcome to MediAI!')
      navigate('/app/dashboard')
    } catch { toast.error('Failed to record consent. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-hero-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-lg animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl mx-auto mb-5 flex items-center justify-center shadow-brand-md"
            style={{ background: 'linear-gradient(135deg,#16a37a,#0ea5e9)' }}>
            <ShieldCheck size={30} className="text-white" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Privacy & Data Consent</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed max-w-sm mx-auto">
            Before storing any health data, we need your informed consent. Please read how we handle your information.
          </p>
        </div>

        {/* Points */}
        <div className="card !p-5 mb-4 space-y-4">
          {POINTS.map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="flex gap-4 stagger-1">
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
                <Icon size={18} />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{title}</p>
                <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Checkbox */}
        <div className={clsx(
          'card !p-4 mb-4 transition-all duration-200',
          agreed ? 'border-brand-300 bg-brand-50/50' : ''
        )}>
          <label className="flex gap-3 cursor-pointer">
            <div className="pt-0.5">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
            </div>
            <p className="text-[13px] text-slate-700 leading-relaxed">
              I have read and understood MediAI's data practices. I give my informed consent for MediAI to store and process my health information as described above, with the right to withdraw consent at any time.
            </p>
          </label>
        </div>

        <button onClick={handleConsent} disabled={!agreed || loading} className="btn-primary w-full text-[15px] py-3 shadow-brand-sm">
          {loading
            ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Recording consent…</span>
            : <span className="flex items-center gap-2"><Heart size={16} />Continue to MediAI <ArrowRight size={16} /></span>
          }
        </button>

        <p className="text-center text-xs text-slate-400 mt-5">
          ⚕️ MediAI is an informational tool, not a certified medical device.
        </p>
      </div>
    </div>
  )
}
