// ─── PrescriptionsPage ─────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FileText, Trash2, ExternalLink, Plus, Pill } from 'lucide-react'
import { prescriptionApi } from '../lib/api'
import { Link } from 'react-router-dom'

export default function PrescriptionsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['prescriptions'],
    queryFn: () => prescriptionApi.list().then(r => r.data.data),
  })

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this prescription? This cannot be undone.')) return
    try {
      await prescriptionApi.delete(id)
      qc.invalidateQueries({ queryKey: ['prescriptions'] })
      toast.success('Deleted')
    } catch { toast.error('Delete failed') }
  }

  const handleArchive = async (id: string, status: string) => {
    try {
      await prescriptionApi.updateStatus(id, status === 'active' ? 'archived' : 'active')
      qc.invalidateQueries({ queryKey: ['prescriptions'] })
      toast.success('Updated')
    } catch { toast.error('Update failed') }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-header flex items-center gap-2.5"><FileText size={22} />Prescriptions</h1>
          <p className="page-sub">All your scanned and uploaded prescriptions.</p>
        </div>
        <Link to="/scanner" className="btn-primary shrink-0 shadow-brand-sm"><Plus size={15} />Scan new</Link>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="skeleton h-24 w-full" />)}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <div className="card empty-state">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <FileText size={28} className="text-slate-300" />
          </div>
          <p className="font-semibold text-slate-700 mb-1">No prescriptions yet</p>
          <p className="text-slate-400 text-sm mb-5">Scan your first prescription to get started.</p>
          <Link to="/scanner" className="btn-primary shadow-brand-sm"><Plus size={15} />Scan prescription</Link>
        </div>
      )}

      <div className="space-y-3">
        {data?.map((rx: any) => (
          <div key={rx.id} className="card !p-4 hover:shadow-soft transition-all">
            <div className="flex items-start gap-3">
              {rx.image_url ? (
                <img src={rx.image_url} alt="Rx" className="w-14 h-14 rounded-xl object-cover border border-slate-100 shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                  <FileText size={20} className="text-slate-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-semibold text-slate-900 text-sm">
                    {rx.prescribed_by ? `Dr. ${rx.prescribed_by}` : 'Prescription'}
                  </p>
                  <span className={rx.status === 'active' ? 'badge-active' : 'badge-archived'}>{rx.status}</span>
                </div>
                <p className="text-xs text-slate-400">
                  {rx.prescribed_date || new Date(rx.created_at).toLocaleDateString('en-IN')}
                </p>
                {rx.medicines?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {rx.medicines.slice(0, 4).map((m: any) => (
                      <span key={m.id} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        <Pill size={9} />{m.name}
                      </span>
                    ))}
                    {rx.medicines.length > 4 && (
                      <span className="text-xs text-slate-400">+{rx.medicines.length - 4} more</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {rx.image_url && (
                  <a href={rx.image_url} target="_blank" rel="noopener noreferrer"
                    className="btn-ghost !p-2"><ExternalLink size={15} /></a>
                )}
                <button onClick={() => handleArchive(rx.id, rx.status)}
                  className="btn-ghost !p-2 text-xs">{rx.status === 'active' ? '📦' : '✓'}</button>
                <button onClick={() => handleDelete(rx.id)}
                  className="btn-ghost !p-2 hover:text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
