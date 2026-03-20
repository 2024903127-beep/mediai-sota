import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ScanLine, MessageSquare, AlertTriangle, Bell,
  FileText, FolderLock, Shield, TrendingUp,
  ChevronRight, Activity, Calendar, Pill, Sparkles
} from 'lucide-react'
import { prescriptionApi, riskApi, reminderApi } from '../lib/api'
import { useAuthStore } from '../store/auth.store'
import { clsx } from 'clsx'

const ACTIONS = [
  { to: '/scanner',       icon: ScanLine,      label: 'Scan Rx',           desc: 'Upload & analyse',      color: 'from-brand-500 to-emerald-400' },
  { to: '/chat',          icon: MessageSquare, label: 'Ask AI',             desc: 'Medicine questions',    color: 'from-blue-500 to-cyan-400' },
  { to: '/risk',          icon: AlertTriangle, label: 'Risk Check',         desc: 'Drug interactions',     color: 'from-orange-500 to-amber-400' },
  { to: '/reminders',     icon: Bell,          label: 'Reminders',          desc: 'Medicine schedule',     color: 'from-purple-500 to-violet-400' },
  { to: '/prescriptions', icon: FileText,      label: 'Prescriptions',      desc: 'View history',          color: 'from-teal-500 to-cyan-400' },
  { to: '/locker',        icon: FolderLock,    label: 'Health Locker',      desc: 'Secure documents',      color: 'from-pink-500 to-rose-400' },
]

function StatCard({ label, value, icon: Icon, sub, accent }: { label: string; value: string | number; icon: any; sub?: string; accent: string }) {
  return (
    <div className="card glass !bg-white/60 flex items-start gap-4 hover:shadow-lift transition-all duration-300">
      <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-lg', accent)}>
        <Icon size={19} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-slate-900 leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[10px] text-brand-600 font-semibold mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { data: rxData }       = useQuery({ queryKey: ['prescriptions'],  queryFn: () => prescriptionApi.list().then(r => r.data.data) })
  const { data: riskData }     = useQuery({ queryKey: ['risk-report'],    queryFn: () => riskApi.myReport().then(r => r.data.data) })
  const { data: reminderData } = useQuery({ queryKey: ['reminders'],      queryFn: () => reminderApi.list().then(r => r.data.data) })

  const activeRx    = Array.isArray(rxData) ? rxData.filter((r: any) => r.status === 'active').length : 0
  const criticalRisk = Array.isArray(riskData?.interactions) ? riskData.interactions.filter((i: any) => ['critical','high'].includes(i.severity)).length : 0
  const todayRems   = Array.isArray(reminderData) ? reminderData.length : 0

  const hour = new Date().getHours()
  const greeting = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.email?.split('@')[0] ?? 'there'

  const recentRx = rxData?.slice(0, 3) ?? []

  return (
    <div className="space-y-7 animate-fade-in">
      {/* Greeting hero */}
      <div className="rounded-3xl overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg,#16a37a 0%,#0ea5e9 100%)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%,white 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative px-5 py-6 md:px-8 md:py-8">
          <p className="text-brand-100 text-sm font-medium mb-1">{greeting} 👋</p>
          <h1 className="text-white text-2xl font-bold capitalize mb-1">{firstName}</h1>
          <p className="text-brand-100 text-sm">Here's your health overview for today.</p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Link to="/scanner" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-brand-700 text-sm font-semibold rounded-xl hover:bg-brand-50 transition-all shadow-soft active:scale-95">
              <ScanLine size={15} />Scan prescription
            </Link>
            <Link to="/chat" className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 text-white text-sm font-semibold rounded-xl hover:bg-white/30 transition-all active:scale-95">
              <MessageSquare size={15} />Ask AI
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active Rx"      value={activeRx}    icon={Pill}          sub="prescriptions"  accent="bg-gradient-to-br from-brand-500 to-emerald-400" />
        <StatCard label="Risk Alerts"    value={criticalRisk} icon={AlertTriangle} sub={criticalRisk > 0 ? 'needs attention' : 'all clear'} accent={clsx(criticalRisk > 0 ? 'bg-gradient-to-br from-red-500 to-orange-400' : 'bg-gradient-to-br from-emerald-500 to-teal-400')} />
        <StatCard label="Reminders"      value={todayRems}   icon={Bell}          sub="active today"   accent="bg-gradient-to-br from-purple-500 to-violet-400" />
        <StatCard label="Health Status"  value={criticalRisk > 0 ? 'Review' : 'Good'} icon={Activity} sub="overall"  accent={clsx(criticalRisk > 0 ? 'bg-gradient-to-br from-amber-500 to-orange-400' : 'bg-gradient-to-br from-brand-500 to-blue-400')} />
      </div>

      {/* Daily Tip - NEW SOTA Component */}
      <div className="glass-premium !bg-brand-50/50 rounded-3xl p-5 border-brand-100 flex items-center gap-5 group hover-glow transition-all animate-float">
        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-soft group-hover:scale-110 transition-transform">
          <Sparkles className="text-brand-500 animate-pulse-soft" size={24} />
        </div>
        <div>
          <p className="text-[10px] text-brand-600 font-bold uppercase tracking-widest mb-1">Daily Health Tip</p>
          <p className="text-sm text-slate-700 font-medium leading-relaxed">
            "Remember to drink at least 8 glasses of water today. Staying hydrated improves medicine absorption and cognitive function."
          </p>
        </div>
      </div>

      {/* Safety notice */}
      {criticalRisk > 0 && (
        <div className="alert-danger animate-slide-up">
          <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-800">{criticalRisk} high-severity interaction{criticalRisk > 1 ? 's' : ''} detected</p>
            <p className="text-red-700 text-xs mt-0.5">Please consult your doctor before continuing these medications.</p>
          </div>
          <Link to="/risk" className="shrink-0 btn-danger !py-1.5 !text-xs">View →</Link>
        </div>
      )}

      {/* Disclaimer */}
      <div className="alert-info">
        <Shield size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-blue-800 text-xs leading-relaxed">
          <strong>Important:</strong> MediAI provides general health information only. Always consult your doctor or pharmacist before making any changes to your medication.
        </p>
      </div>

      {/* Quick actions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title flex items-center gap-2"><TrendingUp size={16} />Quick actions</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ACTIONS.map(({ to, icon: Icon, label, desc, color }, i) => (
            <Link key={to} to={to}
              className={clsx('card glass !bg-white/40 group cursor-pointer hover:shadow-lift hover:-translate-y-1 transition-all duration-300 !p-4 border-white/50', `animate-slide-up stagger-${Math.min(i+1,4)}`)}>
              <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br shadow-md group-hover:scale-110 group-hover:rotate-3 transition-all duration-300', color)}>
                <Icon size={20} className="text-white" />
              </div>
              <p className="font-bold text-slate-900 text-[14px] leading-tight group-hover:text-brand-700 transition-colors">{label}</p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">{desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent prescriptions */}
      {recentRx.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title flex items-center gap-2"><Calendar size={16} />Recent prescriptions</h2>
            <Link to="/prescriptions" className="text-xs text-brand-600 font-semibold hover:text-brand-700 flex items-center gap-1">
              View all <ChevronRight size={13} />
            </Link>
          </div>
          <div className="space-y-2">
            {recentRx.map((rx: any) => (
              <div key={rx.id} className="card !p-4 flex items-center gap-4 hover:shadow-soft transition-all">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">{rx.prescribed_by ? `Dr. ${rx.prescribed_by}` : 'Prescription'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {rx.prescribed_date || new Date(rx.created_at).toLocaleDateString('en-IN')}
                    {rx.medicines?.length ? ` · ${rx.medicines.length} medicine${rx.medicines.length > 1 ? 's' : ''}` : ''}
                  </p>
                </div>
                <span className={rx.status === 'active' ? 'badge-active' : 'badge-archived'}>{rx.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer credit */}
      <div className="pt-4 text-center">
        <p className="text-xs text-slate-300 font-medium">MediAI Platform · Developed by <span className="text-slate-400">Rahul Mishra</span></p>
      </div>
    </div>
  )
}
