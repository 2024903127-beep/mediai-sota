import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { FolderLock, Upload, Trash2, ExternalLink, Shield } from 'lucide-react'
import { lockerApi } from '../lib/api'
import { clsx } from 'clsx'

const TYPE_ICONS: Record<string, string> = {
  prescription: '💊', report: '📋', scan: '🔬', certificate: '📜', document: '📄'
}

export default function LockerPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['locker'],
    queryFn: () => lockerApi.list().then(r => r.data.data),
  })

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    const title = prompt('Give this document a name:', file.name.replace(/\.[^.]+$/, ''))
    if (!title?.trim()) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', title.trim())
    fd.append('type', 'document')
    const toastId = toast.loading('Uploading…')
    try {
      await lockerApi.upload(fd)
      qc.invalidateQueries({ queryKey: ['locker'] })
      toast.success('Uploaded!', { id: toastId })
    } catch {
      toast.error('Upload failed', { id: toastId })
    }
  }, [qc])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, maxFiles: 1, maxSize: 10 * 1024 * 1024 })

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document?')) return
    try {
      await lockerApi.delete(id)
      qc.invalidateQueries({ queryKey: ['locker'] })
      toast.success('Deleted')
    } catch { toast.error('Delete failed') }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="page-header flex items-center gap-2.5"><FolderLock size={22} />Health Locker</h1>
        <p className="page-sub">Securely store prescriptions, reports, and health certificates.</p>
      </div>

      <div className="alert-success !bg-emerald-50/50 backdrop-blur-md border-emerald-100/50">
        <Shield size={16} className="text-emerald-500 shrink-0" />
        <p className="text-xs text-emerald-800 font-medium tracking-tight">All files are stored with end-to-end encryption in your personal Cloud storage. Only you can access them.</p>
      </div>

      {/* Upload zone */}
      <div {...getRootProps()} className={clsx('drop-zone glass !bg-white/40 p-10 text-center cursor-pointer border-brand-200/50 shadow-soft transition-all duration-300', isDragActive && 'active ring-4 ring-brand-500/10 scale-[1.01]')}>
        <input {...getInputProps()} />
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center mx-auto mb-5 shadow-inner-sm group-hover:scale-110 transition-transform">
          <Upload size={28} className="text-brand-600" />
        </div>
        <p className="font-bold text-slate-800 mb-1.5 tracking-tight">
          {isDragActive ? 'Drop to upload' : 'Drop any health document here'}
        </p>
        <p className="text-xs text-slate-400 font-medium">or click to browse · Any file type · Max 10MB</p>
      </div>

      {isLoading && <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-16 w-full" />)}</div>}

      {!isLoading && data?.length === 0 && (
        <div className="card empty-state">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <FolderLock size={28} className="text-slate-300" />
          </div>
          <p className="font-semibold text-slate-700 mb-1">Your locker is empty</p>
          <p className="text-slate-400 text-sm">Upload prescriptions, lab reports, or any health documents.</p>
        </div>
      )}

      <div className="space-y-3">
        {data?.map((doc: any, i: number) => (
          <div key={doc.id} className={clsx('card glass !bg-white/60 !p-4 flex items-center gap-4 hover:shadow-lift hover:-translate-y-0.5 transition-all duration-300 border-white/40', `animate-slide-up stagger-${Math.min(i+1,4)}`)}>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white to-slate-50 flex items-center justify-center shrink-0 text-xl shadow-sm border border-slate-100">
              {TYPE_ICONS[doc.type] || '📄'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 text-sm truncate tracking-tight">{doc.title}</p>
              <div className="flex items-center gap-2 mt-1">
                 <span className="badge-active bg-brand-50/50 text-brand-700 !px-1.5 !py-0 capitalize">{doc.type}</span>
                 <span className="text-[10px] text-slate-400 font-medium">
                  {formatSize(doc.size_bytes)} · {new Date(doc.created_at).toLocaleDateString('en-IN')}
                 </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <a href={doc.drive_view_url} target="_blank" rel="noopener noreferrer"
                className="btn-ghost !p-2.5 hover:text-brand-600 hover:bg-brand-50"><ExternalLink size={17} /></a>
              <button onClick={() => handleDelete(doc.id)}
                className="btn-ghost !p-2.5 hover:text-red-500 hover:bg-red-50"><Trash2 size={17} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
