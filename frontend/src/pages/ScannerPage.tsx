import { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import {
  Upload, ScanLine, AlertTriangle, CheckCircle,
  FileText, Camera, X, ChevronDown, ChevronUp,
  Sparkles, Shield, Pill
} from 'lucide-react'
import { scanApi } from '../lib/api'
import { clsx } from 'clsx'

type Mode = 'simple' | 'technical'

const SEV: Record<string, string> = { low: 'badge-low', moderate: 'badge-moderate', high: 'badge-high', critical: 'badge-critical' }

export default function ScannerPage() {
  const [file, setFile]       = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [mode, setMode]       = useState<Mode>('simple')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<any>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [liveScan, setLiveScan] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [])

  const startLiveScan = async () => {
    setLiveScan(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      toast.error('Camera access denied or unavailable.')
      setLiveScan(false)
    }
  }

  const stopLiveScan = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setLiveScan(false)
  }

  const captureLiveScan = () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0)
      canvas.toBlob((blob) => {
        if (blob) {
          const f = new File([blob], 'live-scan.jpg', { type: 'image/jpeg' })
          setFileAndPreview(f)
          stopLiveScan()
        }
      }, 'image/jpeg')
    }
  }

  const setFileAndPreview = (f: File) => {
    setFile(f)
    setResult(null)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(f)
  }

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFileAndPreview(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg','.jpeg','.png','.webp','.heic'], 'application/pdf': ['.pdf'] },
    maxFiles: 1, maxSize: 10 * 1024 * 1024,
    onDropRejected: () => toast.error('File too large or unsupported format'),
  })

  const handleCamera = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFileAndPreview(f)
    e.target.value = ''
  }

  const handleScan = async () => {
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('image', file)
      fd.append('mode', mode)
      const { data } = await scanApi.scanPrescription(fd)
      setResult(data.data)
      toast.success('Scan complete!')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Scan failed — try a clearer image.')
    } finally { setLoading(false) }
  }

  const handleFeedback = async (original: string, corrected: string, scanId?: string) => {
    try {
      await scanApi.submitFeedback({
        scan_id: scanId,
        original_text: original,
        corrected_text: corrected,
        metadata: { source: 'scanner_edit' }
      })
      toast.success('AI learned from your correction!')
    } catch {
      logger.error('Feedback failed silently')
    }
  }

  const saveEdit = (index: number) => {
    if (!result) return
    const original = result.ocr.medicines[index].name
    const newMeds = [...result.ocr.medicines]
    newMeds[index].name = editValue
    setResult({ ...result, ocr: { ...result.ocr, medicines: newMeds } })
    setEditingId(null)
    handleFeedback(original, editValue, result.prescription_id)
  }

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation()
    setFile(null); setPreview(null); setResult(null)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="page-header flex items-center gap-2.5"><ScanLine size={22} />Scan Prescription</h1>
        <p className="page-sub">Upload a photo of your prescription — AI extracts medicines and explains them.</p>
      </div>

      {/* Mode tabs */}
      <div className="card !p-3 flex items-center gap-3">
        <span className="text-xs text-slate-500 font-medium shrink-0">Explain for:</span>
        <div className="flex gap-1.5 flex-1">
          {(['simple','technical'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={clsx('flex-1 py-2 rounded-xl text-xs font-semibold transition-all', mode === m ? 'bg-brand-600 text-white shadow-brand-sm' : 'text-slate-500 hover:bg-slate-50')}>
              {m === 'simple' ? '👤 Patient (simple)' : '🏥 Doctor (technical)'}
            </button>
          ))}
        </div>
      </div>

      {/* Upload area */}
      {!file ? (
        <div className="space-y-3">
          <div {...getRootProps()} className={clsx(
            'drop-zone p-8 text-center cursor-pointer',
            isDragActive && 'active'
          )}>
            <input {...getInputProps()} />
            <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
              <Upload size={28} className="text-brand-600" />
            </div>
            <p className="font-semibold text-slate-700 mb-1">
              {isDragActive ? 'Drop it here!' : 'Drop prescription image here'}
            </p>
            <p className="text-sm text-slate-400 mb-4">or click to browse files</p>
            <p className="text-xs text-slate-300">JPG · PNG · WebP · HEIC · PDF · Max 10MB</p>
          </div>

          {/* Camera capture options */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-400 font-medium">or</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {!liveScan ? (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button onClick={() => cameraRef.current?.click()} className="btn-secondary py-3 text-[14px]">
                <Camera size={17} />Native App
              </button>
              <button onClick={startLiveScan} className="btn-primary py-3 text-[14px]">
                <ScanLine size={17} />Live Scan
              </button>
            </div>
          ) : (
            <div className="mt-4 relative rounded-3xl overflow-hidden bg-slate-900 aspect-[3/4] animate-fade-in shadow-2xl ring-4 ring-white/10">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              
              {/* Scanning Beam */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-400 to-transparent shadow-[0_0_15px_rgba(22,163,122,0.8)] animate-[scan_2s_linear_infinite]"></div>
                <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-brand-400 rounded-tl-lg opacity-40"></div>
                <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-brand-400 rounded-tr-lg opacity-40"></div>
                <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-brand-400 rounded-bl-lg opacity-40"></div>
                <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-brand-400 rounded-br-lg opacity-40"></div>
              </div>

              <div className="absolute inset-0 flex flex-col justify-end p-5 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                <div className="flex gap-3">
                  <button onClick={stopLiveScan} className="flex-1 py-3 rounded-2xl bg-white/10 text-white font-bold backdrop-blur-xl hover:bg-white/20 transition-all border border-white/10 text-xs uppercase tracking-wider">Cancel</button>
                  <button onClick={captureLiveScan} className="flex-[2] py-3 rounded-2xl bg-brand-600 shadow-brand-md text-white font-bold flex items-center justify-center gap-2 hover:bg-brand-700 transition-all text-xs uppercase tracking-wider shadow-lg">
                    <Camera size={15}/> Capture
                  </button>
                </div>
              </div>
            </div>
          )}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment"
            onChange={handleCamera} className="hidden" />
        </div>
      ) : (
        <div className="card !p-4 space-y-4">
          {/* Preview */}
          <div className="relative rounded-xl overflow-hidden bg-slate-50">
            {preview && preview.startsWith('data:image') ? (
              <img src={preview} alt="Prescription preview"
                className="w-full max-h-72 object-contain" />
            ) : (
              <div className="flex items-center justify-center h-24 gap-3">
                <FileText size={24} className="text-slate-400" />
                <p className="text-slate-600 font-medium text-sm">{file.name}</p>
              </div>
            )}
            <button onClick={clearFile}
              className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-soft border border-slate-100 hover:bg-red-50 hover:text-red-500 transition-all">
              <X size={15} />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{file.name}</span>
            <span>{(file.size / 1024).toFixed(0)} KB</span>
          </div>

          <button onClick={handleScan} disabled={loading}
            className="btn-primary w-full py-3 text-[15px] shadow-brand-sm">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scanning… this may take 20-30s
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles size={16} />Scan & Analyse
              </span>
            )}
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="card !p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center animate-pulse">
              <ScanLine size={16} className="text-brand-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">Processing your prescription…</p>
              <p className="text-xs text-slate-400 mt-0.5">OCR extraction → AI analysis → Risk detection</p>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill w-2/3" style={{ animation: 'shimmer 1.5s ease-in-out infinite alternate' }} />
          </div>
          <div className="space-y-2">
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
            <div className="skeleton h-3 w-2/3" />
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-4 animate-slide-up">

          {/* Medicines */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title flex items-center gap-2">
                <Pill size={16} className="text-brand-600" />
                Detected Medicines
                <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-semibold">{result.ocr.medicines.length}</span>
              </h3>
              <div className="flex items-center gap-3">
                {result.ocr.confidence && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg">
                    <div className={clsx('w-2 h-2 rounded-full', result.ocr.confidence > 80 ? 'bg-emerald-500' : result.ocr.confidence > 60 ? 'bg-amber-500' : 'bg-red-500')} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">OCR {result.ocr.confidence.toFixed(0)}%</span>
                  </div>
                )}
              </div>
            </div>

            {result.ocr.medicines.length === 0 ? (
              <div className="empty-state !py-8">
                <p className="text-slate-500 text-sm">No medicines detected. Try a clearer image.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {result.ocr.medicines.map((m: any, i: number) => (
                  <div key={i} className="p-4 rounded-2xl border border-slate-100 bg-white hover:border-brand-200 transition-all group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        {editingId === i ? (
                          <div className="flex items-center gap-2">
                            <input autoFocus className="input !py-1 !px-2 !text-sm" value={editValue} onChange={e => setEditValue(e.target.value)} />
                            <button onClick={() => saveEdit(i)} className="text-brand-600 font-bold text-xs uppercase">Save</button>
                            <button onClick={() => setEditingId(null)} className="text-slate-400 font-bold text-xs uppercase">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 text-sm">{m.name}</p>
                            <button onClick={() => { setEditingId(i); setEditValue(m.name) }} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-brand-600 transition-all">
                              <CheckCircle size={14} />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {m.score && (
                            <span className={clsx(
                              'text-[10px] font-bold px-1.5 py-0.5 rounded-md',
                              m.score > 85 ? 'bg-emerald-50 text-emerald-600' : m.score > 70 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                            )}>
                              {m.score}% Confidence
                            </span>
                          )}
                          {m.composition && <span className="text-xs text-slate-400">· {m.composition}</span>}
                        </div>
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-all">
                        <Pill size={16} />
                      </div>
                    </div>

                    {/* Suggestions Area */}
                    {m.suggestions?.length > 0 && !editingId && (
                      <div className="mt-3 pt-3 border-t border-slate-50 flex flex-wrap gap-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase w-full mb-1">Did you mean?</span>
                        {m.suggestions.map((s: any) => (
                          <button key={s.name} onClick={() => { setEditValue(s.name); saveEdit(i) }}
                            className="px-2 py-1 rounded-lg bg-slate-50 hover:bg-brand-50 text-[11px] text-slate-600 hover:text-brand-700 border border-slate-100 transition-all">
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {result.ocr.doctor_name && (
              <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-50">
                👨‍⚕️ Prescribed by Dr. {result.ocr.doctor_name}
              </p>
            )}
          </div>

          {/* AI Summary */}
          <div className="card">
            <button onClick={() => setSummaryOpen(!summaryOpen)}
              className="flex items-center justify-between w-full mb-0 group">
              <h3 className="section-title flex items-center gap-2">
                <Sparkles size={16} className="text-brand-600" />AI Explanation
              </h3>
              {summaryOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>
            {summaryOpen && (
              <div className="mt-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl p-4">
                {result.ai_summary}
              </div>
            )}
          </div>

          {/* Risk */}
          <div className="card">
            <h3 className="section-title flex items-center gap-2 mb-4">
              <Shield size={16} className="text-brand-600" />Risk Analysis
              <span className={SEV[result.risk.overall_risk]}>{result.risk.overall_risk}</span>
            </h3>

            {result.risk.interactions.length === 0 && result.risk.allergy_warnings.length === 0 ? (
              <div className="alert-success">
                <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                <div>
                  <p className="font-semibold">No interactions detected</p>
                  <p className="text-xs mt-0.5 text-emerald-700">These medicines appear safe to use together based on available data.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {result.risk.interactions.map((ix: any, i: number) => (
                  <div key={i} className="flex gap-3 p-3.5 bg-orange-50 rounded-xl border border-orange-100">
                    <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-orange-900 text-sm">{ix.medicine_a} + {ix.medicine_b}</p>
                        <span className={SEV[ix.severity]}>{ix.severity}</span>
                      </div>
                      <p className="text-xs text-orange-800 leading-relaxed">{ix.description}</p>
                      <p className="text-xs text-orange-500 mt-1">Source: {ix.source}</p>
                    </div>
                  </div>
                ))}
                {result.risk.allergy_warnings?.map((aw: any, i: number) => (
                  <div key={i} className="flex gap-3 p-3.5 bg-red-50 rounded-xl border border-red-100">
                    <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-red-900 text-sm">Allergy warning: {aw.medicine}</p>
                        <span className={SEV[aw.severity]}>{aw.severity}</span>
                      </div>
                      <p className="text-xs text-red-800">{aw.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.risk.duplicate_alerts?.length > 0 && (
              <div className="alert-warning mt-3">
                <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                <p className="text-xs"><strong>Duplicate medicines:</strong> {result.risk.duplicate_alerts.join(', ')}</p>
              </div>
            )}

            <div className="alert-info mt-3">
              <Shield size={15} className="text-blue-500 shrink-0" />
              <p className="text-xs text-blue-800">⚕️ Always consult your doctor or pharmacist before making any changes to your medication.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
