import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Building2, Users, AlertTriangle, CheckCircle, RefreshCw, ChevronRight } from 'lucide-react'
import { hospitalApi } from '../lib/api'
import { clsx } from 'clsx'

const SEV: Record<string, string> = { low: 'badge-low', moderate: 'badge-moderate', high: 'badge-high', critical: 'badge-critical' }
const RISK_COLOR: Record<string, string> = { low: 'text-emerald-600', medium: 'text-amber-600', high: 'text-red-600' }

export default function HospitalPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: patients, isLoading: pL } = useQuery({ queryKey: ['h-patients'], queryFn: () => hospitalApi.patients().then(r => r.data.data) })
  const { data: alerts,   isLoading: aL } = useQuery({ queryKey: ['h-alerts'],   queryFn: () => hospitalApi.alerts().then(r => r.data.data) })
  const { data: summary,  isLoading: sL } = useQuery({ queryKey: ['h-summary', selectedId], queryFn: () => selectedId ? hospitalApi.patientSummary(selectedId).then(r => r.data.data) : null, enabled: !!selectedId })

  const acknowledge = async (id: string) => {
    try { await hospitalApi.acknowledgeAlert(id); qc.invalidateQueries({ queryKey: ['h-alerts'] }); toast.success('Alert acknowledged') }
    catch { toast.error('Failed') }
  }

  const unacked = alerts?.filter((a: any) => !a.doctor_acknowledged) || []

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-header flex items-center gap-2.5"><Building2 size={22} />Hospital Dashboard</h1>
          <p className="page-sub">Patient overview and AI-assisted risk monitoring.</p>
        </div>
        <button onClick={() => { qc.invalidateQueries({ queryKey: ['h-patients'] }); qc.invalidateQueries({ queryKey: ['h-alerts'] }) }}
          className="btn-secondary shrink-0"><RefreshCw size={15} />Refresh</button>
      </div>

      {/* Disclaimer */}
      <div className="alert-warning">
        <AlertTriangle size={16} className="text-amber-500 shrink-0" />
        <p className="text-xs text-amber-800">
          <strong>Clinical note:</strong> AI suggestions are for informational support only. All clinical decisions must be made by qualified healthcare professionals.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Patients',         value: patients?.length || 0,  color: 'bg-brand-50', text: 'text-brand-600', icon: Users },
          { label: 'Active alerts',    value: unacked.length,         color: 'bg-red-50',   text: 'text-red-600',   icon: AlertTriangle },
          { label: 'Resolved',         value: (alerts?.length || 0) - unacked.length, color: 'bg-emerald-50', text: 'text-emerald-600', icon: CheckCircle },
        ].map(({ label, value, color, text, icon: Icon }) => (
          <div key={label} className="card !p-4 text-center">
            <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2', color)}>
              <Icon size={18} className={text} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Alerts panel */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="section-title flex-1">Risk alerts</h2>
            {unacked.length > 0 && <span className="badge-critical">{unacked.length} new</span>}
          </div>
          {aL && <div className="space-y-2">{[1,2].map(i => <div key={i} className="skeleton h-16 w-full" />)}</div>}
          {!aL && alerts?.length === 0 && (
            <div className="empty-state !py-8">
              <CheckCircle size={28} className="text-emerald-400 mb-2" />
              <p className="text-sm text-slate-400">No active alerts</p>
            </div>
          )}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {alerts?.map((alert: any) => (
              <div key={alert.id} className={clsx('p-3.5 rounded-xl border transition-all',
                alert.doctor_acknowledged ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-orange-50 border-orange-100')}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={SEV[alert.severity]}>{alert.severity}</span>
                      <span className="text-xs text-slate-500 truncate">{alert['users']?.email}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{alert.medicine_a_name} + {alert.medicine_b_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{alert.description}</p>
                  </div>
                  {!alert.doctor_acknowledged && (
                    <button onClick={() => acknowledge(alert.id)} className="btn-secondary !py-1 !px-2 !text-xs shrink-0">
                      <CheckCircle size={12} />Ack
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Patients panel */}
        <div className="card space-y-3">
          <h2 className="section-title">Patients</h2>
          {pL && <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-14 w-full" />)}</div>}
          {!pL && patients?.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No patients linked to your hospital.</p>
          )}
          <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
            {patients?.map((p: any) => (
              <button key={p.user_id} onClick={() => setSelectedId(p.user_id === selectedId ? null : p.user_id)}
                className={clsx('w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-center gap-3',
                  p.user_id === selectedId ? 'border-brand-400 bg-brand-50' : 'border-transparent bg-slate-50 hover:border-slate-200')}>
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center border border-slate-100 shrink-0">
                  <span className="text-xs font-bold text-slate-600">{p.users?.email?.[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{p.users?.email}</p>
                  <p className="text-xs text-slate-400">{p.prescriptions?.filter((r: any) => r.status === 'active').length || 0} active Rx</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.blood_group && <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-semibold">{p.blood_group}</span>}
                  <ChevronRight size={14} className="text-slate-300" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Patient summary */}
      {selectedId && (
        <div className="card animate-slide-up">
          <h2 className="section-title mb-4">Patient summary</h2>
          {sL && <div className="skeleton h-32 w-full" />}
          {summary && !sL && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Active medicines',    value: summary.active_medicines },
                  { label: 'Critical interactions', value: summary.critical_interactions },
                  { label: 'Risk score',           value: `${summary.risk_score}/100` },
                  { label: 'Risk level',           value: summary.risk_level },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">{label}</p>
                    <p className={clsx('text-lg font-bold',
                      label === 'Risk level' ? (RISK_COLOR[value as string] || 'text-slate-900') : 'text-slate-900')}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">
                ⚕️ AI-generated summary for clinical reference only. Always review original records before making decisions.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
