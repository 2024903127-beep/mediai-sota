import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, CheckCircle, Plus, X, Shield, Activity } from 'lucide-react'
import { riskApi } from '../lib/api'
import { clsx } from 'clsx'

const SEV: Record<string, string> = { low: 'badge-low', moderate: 'badge-moderate', high: 'badge-high', critical: 'badge-critical' }
const SEV_BG: Record<string, string> = {
  low: 'bg-emerald-50 border-emerald-100', moderate: 'bg-amber-50 border-amber-100',
  high: 'bg-orange-50 border-orange-100', critical: 'bg-red-50 border-red-100',
}

export default function RiskPage() {
  const [medicines, setMedicines] = useState(['', ''])
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<any>(null)

  const { data: report } = useQuery({
    queryKey: ['risk-report'],
    queryFn: () => riskApi.myReport().then(r => r.data.data),
  })

  const analyse = async () => {
    const meds = medicines.filter(Boolean)
    if (meds.length < 2) return toast.error('Enter at least 2 medicines to check')
    setLoading(true)
    try {
      const { data } = await riskApi.analyse(meds)
      setResult(data.data)
    } catch { toast.error('Analysis failed. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header flex items-center gap-2.5"><AlertTriangle size={22} />Risk Check</h1>
        <p className="page-sub">Detect drug-drug interactions and allergy conflicts before they cause harm.</p>
      </div>

      {/* Checker */}
      <div className="card glass !bg-white/60 space-y-5 shadow-soft border-white/50">
        <h2 className="section-title">Enter your medicines</h2>
        <div className="space-y-2.5">
          {medicines.map((m, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-slate-500">{i + 1}</span>
              </div>
              <input className="input flex-1" placeholder={`Medicine name (e.g. Metformin)`} value={m}
                onChange={e => { const c = [...medicines]; c[i] = e.target.value; setMedicines(c) }}
                onKeyDown={e => e.key === 'Enter' && i === medicines.length - 1 && setMedicines([...medicines, ''])} />
              {medicines.length > 2 && (
                <button onClick={() => setMedicines(medicines.filter((_, j) => j !== i))}
                  className="p-2 text-slate-300 hover:text-red-400 transition-colors">
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setMedicines([...medicines, ''])} className="btn-secondary">
            <Plus size={15} />Add medicine
          </button>
          <button onClick={analyse} disabled={loading || medicines.filter(Boolean).length < 2}
            className="btn-primary shadow-brand-sm">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analysing…
              </span>
            ) : (
              <span className="flex items-center gap-2"><Shield size={15} />Check interactions</span>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="card glass !bg-white/80 space-y-5 animate-slide-up shadow-lift border-white/60">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <Activity size={18} className="text-slate-600" />
            <span className="font-semibold text-slate-900">Overall risk level:</span>
            <span className={SEV[result.overall_risk]}>{result.overall_risk}</span>
          </div>

          {result.interactions.length === 0 && result.allergy_warnings?.length === 0 ? (
            <div className="alert-success">
              <CheckCircle size={18} className="text-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold">No interactions detected</p>
                <p className="text-xs mt-0.5 text-emerald-700">These medicines appear safe to use together based on available data.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {result.interactions.map((ix: any, i: number) => (
                <div key={i} className={clsx('p-4 rounded-xl border', SEV_BG[ix.severity])}>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <AlertTriangle size={15} className="text-orange-500" />
                    <span className="font-semibold text-slate-900 text-sm">{ix.medicine_a} ↔ {ix.medicine_b}</span>
                    <span className={SEV[ix.severity]}>{ix.severity}</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{ix.description}</p>
                  <p className="text-xs text-slate-400 mt-2">Source: {ix.source}</p>
                </div>
              ))}
              {result.allergy_warnings?.map((aw: any, i: number) => (
                <div key={i} className="p-4 rounded-xl border bg-red-50 border-red-100">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <AlertTriangle size={15} className="text-red-500" />
                    <span className="font-semibold text-red-900 text-sm">Allergy: {aw.medicine}</span>
                    <span className={SEV[aw.severity]}>{aw.severity}</span>
                  </div>
                  <p className="text-sm text-red-700">{aw.description}</p>
                </div>
              ))}
            </div>
          )}

          {result.duplicate_alerts?.length > 0 && (
            <div className="alert-warning">
              <AlertTriangle size={16} className="text-amber-500 shrink-0" />
              <p className="text-xs"><strong>Duplicate medicines detected:</strong> {result.duplicate_alerts.join(', ')}</p>
            </div>
          )}

          <div className="alert-info">
            <Shield size={15} className="text-blue-500 shrink-0" />
            <p className="text-xs text-blue-800">⚕️ Always consult your doctor or pharmacist before making any changes to your medication.</p>
          </div>
        </div>
      )}

      {/* Past alerts */}
      {report?.interactions?.length > 0 && (
        <div>
          <h2 className="section-title mb-3">Past interaction alerts</h2>
          <div className="space-y-2">
            {report.interactions.slice(0, 8).map((ix: any) => (
              <div key={ix.id} className="card !p-3.5 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{ix.medicine_a_name} + {ix.medicine_b_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(ix.detected_at).toLocaleDateString('en-IN')}</p>
                </div>
                <span className={SEV[ix.severity]}>{ix.severity}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
