import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { User, Shield, Trash2, Save, Plus, X, LogOut, Camera } from 'lucide-react'
import { userApi, authApi } from '../lib/api'
import { useAuthStore } from '../store/auth.store'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-']

export default function ProfilePage() {
  const { user, logout, setUser } = useAuthStore()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({ queryKey: ['profile'], queryFn: () => userApi.me().then(r => r.data.data) })

  const [form, setForm] = useState({ dob: '', blood_group: '', language_pref: 'en', allergies: [] as string[], conditions: [] as string[], emergency_contact: { name: '', phone: '', relation: '' } })
  const [newAllergy, setNewAllergy] = useState('')
  const [newCondition, setNewCondition] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [tab, setTab] = useState<'health'|'account'>('health')

  useEffect(() => {
    if (data) setForm({
      dob: data.profile?.dob || '',
      blood_group: data.profile?.blood_group || '',
      language_pref: data.user?.language_pref || 'en',
      allergies: data.profile?.allergies || [],
      conditions: data.profile?.conditions || [],
      emergency_contact: data.profile?.emergency_contact || { name: '', phone: '', relation: '' },
    })
  }, [data])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    try {
      await userApi.updateProfile(form)
      qc.invalidateQueries({ queryKey: ['profile'] })
      if (user) setUser({ ...user, language_pref: form.language_pref })
      toast.success('Profile updated!')
    } catch { toast.error('Update failed') }
    finally { setSaving(false) }
  }

  const handleDeleteAccount = async () => {
    if (!confirm('This will delete ALL your health data within 30 days. Are you sure?')) return
    if (!confirm('This is irreversible. Type "confirm" to proceed.') ) return
    setDeleting(true)
    try {
      await authApi.deleteAccount(); logout(); navigate('/login')
      toast.success('Deletion scheduled.')
    } catch { toast.error('Failed') }
    finally { setDeleting(false) }
  }

  const addTag = (field: 'allergies' | 'conditions', val: string, setter: (v: string) => void) => {
    if (!val.trim()) return
    setForm(f => ({ ...f, [field]: [...f[field], val.trim()] }))
    setter('')
  }

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16 w-full" />)}</div>

  const initials = user?.email?.slice(0,2).toUpperCase() ?? 'ME'

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl px-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header flex items-center gap-2.5"><User size={22} className="text-brand-600" />Profile</h1>
          <p className="page-sub">Manage your health profile and account settings.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
          {(['health','account'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx('px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider',
                tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {t === 'health' ? 'Health' : 'Account'}
            </button>
          ))}
        </div>
      </div>

      {/* Avatar card */}
      <div className="card glass !bg-white/70 !p-6 flex items-center gap-5 border-white/50 shadow-lift">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center">
            <span className="text-brand-700 text-xl font-bold">{initials}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-lg truncate">{user?.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="badge-active capitalize">{user?.role}</span>
            {user?.consent_given_at && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Shield size={11} />Consented {new Date(user.consent_given_at).toLocaleDateString('en-IN')}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => { logout(); navigate('/login') }} className="btn-ghost text-red-500 hover:bg-red-50 shrink-0">
          <LogOut size={16} />
        </button>
      </div>

      {/* Mobile Tabs */}
      <div className="md:hidden flex gap-1 bg-slate-100 rounded-xl p-1 w-full">
        {(['health','account'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all capitalize',
              tab === t ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500 hover:text-slate-700')}>
            {t === 'health' ? '🏥 Health info' : '⚙️ Account'}
          </button>
        ))}
      </div>

      {tab === 'health' && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="card glass !bg-white/50 space-y-5 shadow-soft border-white/50">
            <h2 className="section-title">Personal details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Date of birth</label>
                <input type="date" className="input" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
              </div>
              <div>
                <label className="label">Blood group</label>
                <select className="input" value={form.blood_group} onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))}>
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Language preference</label>
                <select className="input" value={form.language_pref} onChange={e => setForm(f => ({ ...f, language_pref: e.target.value }))}>
                  <option value="en">English</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Allergies */}
          <div className="card space-y-3">
            <h2 className="section-title">Known allergies</h2>
            <div className="flex flex-wrap gap-2">
              {form.allergies.map((a, i) => (
                <span key={i} className="flex items-center gap-1.5 text-sm bg-red-50 text-red-700 px-3 py-1 rounded-full border border-red-100 font-medium">
                  {a}
                  <button type="button" onClick={() => setForm(f => ({ ...f, allergies: f.allergies.filter((_, j) => j !== i) }))} className="hover:text-red-900">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="e.g. Penicillin, Sulfa, NSAIDs" value={newAllergy}
                onChange={e => setNewAllergy(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag('allergies', newAllergy, setNewAllergy))} />
              <button type="button" onClick={() => addTag('allergies', newAllergy, setNewAllergy)} className="btn-secondary shrink-0"><Plus size={15} /></button>
            </div>
          </div>

          {/* Conditions */}
          <div className="card space-y-3">
            <h2 className="section-title">Medical conditions</h2>
            <div className="flex flex-wrap gap-2">
              {form.conditions.map((c, i) => (
                <span key={i} className="flex items-center gap-1.5 text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100 font-medium">
                  {c}
                  <button type="button" onClick={() => setForm(f => ({ ...f, conditions: f.conditions.filter((_, j) => j !== i) }))} className="hover:text-blue-900">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="e.g. Type 2 Diabetes, Hypertension" value={newCondition}
                onChange={e => setNewCondition(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag('conditions', newCondition, setNewCondition))} />
              <button type="button" onClick={() => addTag('conditions', newCondition, setNewCondition)} className="btn-secondary shrink-0"><Plus size={15} /></button>
            </div>
          </div>

          {/* Emergency contact */}
          <div className="card space-y-3">
            <h2 className="section-title">Emergency contact</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="label">Name</label>
                <input className="input" placeholder="Full name" value={form.emergency_contact.name}
                  onChange={e => setForm(f => ({ ...f, emergency_contact: { ...f.emergency_contact, name: e.target.value } }))} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" placeholder="+91 98765 43210" value={form.emergency_contact.phone}
                  onChange={e => setForm(f => ({ ...f, emergency_contact: { ...f.emergency_contact, phone: e.target.value } }))} />
              </div>
              <div>
                <label className="label">Relation</label>
                <input className="input" placeholder="e.g. Spouse, Parent" value={form.emergency_contact.relation}
                  onChange={e => setForm(f => ({ ...f, emergency_contact: { ...f.emergency_contact, relation: e.target.value } }))} />
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary shadow-brand-sm">
            {saving ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</span> : <><Save size={15} />Save profile</>}
          </button>
        </form>
      )}

      {tab === 'account' && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <h2 className="section-title">Account info</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Email</span><span className="font-medium text-slate-900">{user?.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Role</span><span className="font-medium text-slate-900 capitalize">{user?.role}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500">Data consent</span>
                <span className={clsx('font-medium', user?.consent_given_at ? 'text-emerald-600' : 'text-amber-600')}>
                  {user?.consent_given_at ? `Given ${new Date(user.consent_given_at).toLocaleDateString('en-IN')}` : 'Not given'}
                </span>
              </div>
            </div>
          </div>

          <div className="card border-red-100 space-y-3">
            <h2 className="section-title text-red-700 flex items-center gap-2"><Trash2 size={16} />Danger zone</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Deleting your account will permanently remove all prescriptions, health records, documents, and chat history within 30 days. This action cannot be undone.
            </p>
            <button onClick={handleDeleteAccount} disabled={deleting} className="btn-danger">
              {deleting ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing…</span> : <><Trash2 size={15} />Delete my account</>}
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-slate-300 pt-2">MediAI Platform · Developed by <span className="text-slate-400 font-medium">Rahul Mishra</span></p>
    </div>
  )
}
