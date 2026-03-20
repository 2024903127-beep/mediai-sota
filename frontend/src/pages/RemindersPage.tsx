import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Bell, Plus, Trash2, Clock, Zap, ChevronUp } from 'lucide-react'
import { reminderApi } from '../lib/api'
import { clsx } from 'clsx'

const FREQ: Record<string, string> = {
  once: 'Once', daily: 'Once daily', twice_daily: 'Twice daily',
  thrice_daily: 'Three times daily', weekly: 'Weekly', custom: 'Custom',
}

const FREQ_COLORS: Record<string, string> = {
  once: 'bg-slate-100 text-slate-600', daily: 'bg-brand-50 text-brand-700',
  twice_daily: 'bg-blue-50 text-blue-700', thrice_daily: 'bg-purple-50 text-purple-700',
  weekly: 'bg-amber-50 text-amber-700',
}

export default function RemindersPage() {
  const qc = useQueryClient()
  const { data: reminders, isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => reminderApi.list().then(r => r.data.data),
  })

  const [showForm, setShowForm] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [aiMeds, setAiMeds] = useState('')
  const [form, setForm] = useState({
    medicine_name: '', frequency: 'daily', times: ['08:00'],
    start_date: new Date().toISOString().slice(0, 10), end_date: '', notification_method: 'push',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.medicine_name.trim()) return toast.error('Enter medicine name')
    try {
      await reminderApi.create(form)
      qc.invalidateQueries({ queryKey: ['reminders'] })
      toast.success('Reminder created!')
      setShowForm(false)
      setForm({ medicine_name: '', frequency: 'daily', times: ['08:00'], start_date: new Date().toISOString().slice(0, 10), end_date: '', notification_method: 'push' })
    } catch { toast.error('Failed to create') }
  }

  const handleDelete = async (id: string) => {
    try { await reminderApi.delete(id); qc.invalidateQueries({ queryKey: ['reminders'] }); toast.success('Removed') }
    catch { toast.error('Failed') }
  }

  const handleAIGenerate = async () => {
    const meds = aiMeds.split(',').map(s => s.trim()).filter(Boolean)
    if (!meds.length) return toast.error('Enter at least one medicine name')
    setGenerating(true)
    try {
      const { data } = await reminderApi.generate(meds.map(m => ({ name: m })))
      for (const item of data.data.schedule) {
        await reminderApi.create({ medicine_name: item.medicine, frequency: 'daily', times: item.times, start_date: new Date().toISOString().slice(0, 10), notification_method: 'push' })
      }
      qc.invalidateQueries({ queryKey: ['reminders'] })
      toast.success(`${data.data.schedule.length} reminders created!`)
      setAiMeds('')
    } catch { toast.error('AI generation failed') }
    finally { setGenerating(false) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-header flex items-center gap-2.5"><Bell size={22} />Reminders</h1>
          <p className="page-sub">Never miss a dose.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary shrink-0 shadow-brand-sm">
          <Plus size={15} />Add reminder
        </button>
      </div>

      {/* AI generator */}
      <div className="rounded-2xl p-5 border border-brand-200/60" style={{ background: 'linear-gradient(135deg,rgba(22,163,122,.06),rgba(14,165,233,.06))' }}>
        <div className="flex items-center gap-2 mb-2">
          <Zap size={15} className="text-brand-600" />
          <span className="font-semibold text-slate-900 text-sm">AI Schedule Generator</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">Enter medicine names separated by commas — AI builds an optimal daily schedule.</p>
        <div className="flex gap-2">
          <input className="input flex-1 text-sm" placeholder="e.g. Metformin, Lisinopril, Aspirin"
            value={aiMeds} onChange={e => setAiMeds(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAIGenerate()} />
          <button onClick={handleAIGenerate} disabled={generating} className="btn-primary shrink-0 shadow-brand-sm">
            {generating ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap size={15} />}
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Manual form */}
      {showForm && (
        <div className="card animate-slide-up space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">New reminder</h2>
            <button onClick={() => setShowForm(false)} className="btn-ghost !p-1.5"><ChevronUp size={16} /></button>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Medicine name</label>
                <input className="input" placeholder="e.g. Metformin 500mg" value={form.medicine_name}
                  onChange={e => setForm(f => ({ ...f, medicine_name: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Frequency</label>
                <select className="input" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                  {Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Start date</label>
                <input type="date" className="input" value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">End date <span className="text-slate-400 font-normal">(optional)</span></label>
                <input type="date" className="input" value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Reminder times</label>
              <div className="space-y-2">
                {form.times.map((t, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="time" className="input w-36" value={t}
                      onChange={e => setForm(f => { const ts = [...f.times]; ts[i] = e.target.value; return { ...f, times: ts } })} />
                    {i > 0 && <button type="button" onClick={() => setForm(f => ({ ...f, times: f.times.filter((_, j) => j !== i) }))} className="btn-ghost !p-2 hover:text-red-500"><Trash2 size={14} /></button>}
                  </div>
                ))}
                <button type="button" onClick={() => setForm(f => ({ ...f, times: [...f.times, '12:00'] }))} className="btn-secondary text-xs !py-2"><Plus size={13} />Add time</button>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="btn-primary shadow-brand-sm">Create reminder</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {isLoading && <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-20 w-full" />)}</div>}

      {!isLoading && (!reminders || reminders.length === 0) && (
        <div className="card empty-state">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4"><Bell size={28} className="text-slate-300" /></div>
          <p className="font-semibold text-slate-700 mb-1">No reminders yet</p>
          <p className="text-slate-400 text-sm">Add one manually or use AI to generate a schedule from your medicines.</p>
        </div>
      )}

      <div className="space-y-2.5">
        {reminders?.map((r: any) => (
          <div key={r.id} className="card !p-4 flex items-center gap-4 hover:shadow-soft transition-all">
            <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <Bell size={19} className="text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900">{r.medicine_name}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', FREQ_COLORS[r.frequency] || 'bg-slate-100 text-slate-600')}>
                  {FREQ[r.frequency] || r.frequency}
                </span>
                <div className="flex gap-1 flex-wrap">
                  {r.times?.map((t: string) => (
                    <span key={t} className="flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      <Clock size={10} />{t}
                    </span>
                  ))}
                </div>
              </div>
              {r.end_date && <p className="text-xs text-slate-400 mt-1">Until {new Date(r.end_date).toLocaleDateString('en-IN')}</p>}
            </div>
            <button onClick={() => handleDelete(r.id)}
              className="shrink-0 btn-ghost !p-2 hover:text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
