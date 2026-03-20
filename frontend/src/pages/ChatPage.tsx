import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Send, Mic, MicOff, Plus, MessageSquare,
  AlertTriangle, Trash2, ChevronLeft, Sparkles
} from 'lucide-react'
import { aiApi } from '../lib/api'
import { clsx } from 'clsx'

type Mode = 'simple' | 'technical'
interface Msg { role: 'user' | 'assistant'; content: string; is_emergency?: boolean }

const SUGGESTIONS = [
  'What is Paracetamol used for?',
  'Can I take ibuprofen with antibiotics?',
  'Common side effects of Metformin?',
  'Is it safe to take aspirin daily?',
]

export default function ChatPage() {
  const [messages, setMessages]   = useState<Msg[]>([])
  const [input, setInput]         = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [mode, setMode]           = useState<Mode>('simple')
  const [loading, setLoading]     = useState(false)
  const [listening, setListening] = useState(false)
  const [showSessions, setShowSessions] = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const recognRef  = useRef<any>(null)
  const qc = useQueryClient()

  const { data: sessions } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => aiApi.sessions().then(r => r.data.data),
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text = input.trim()) => {
    if (!text || loading) return
    const userMsg: Msg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const { data } = await aiApi.chat(text, sessionId || undefined, mode)
      const { reply, session_id, is_emergency } = data.data
      if (!sessionId) {
        setSessionId(session_id)
        qc.invalidateQueries({ queryKey: ['chat-sessions'] })
      }
      setMessages(prev => [...prev, { role: 'assistant', content: reply, is_emergency }])
    } catch {
      toast.error('Failed to get response')
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Unable to respond. Please try again.' }])
    } finally { setLoading(false) }
  }, [input, loading, sessionId, mode, qc])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const autoResize = () => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return toast.error('Voice input not supported in this browser')
    if (recognRef.current) { recognRef.current.stop(); return }
    const r = new SR()
    recognRef.current = r
    r.lang = 'en-IN'; r.continuous = false; r.interimResults = false
    r.onstart  = () => setListening(true)
    r.onend    = () => { setListening(false); recognRef.current = null }
    r.onerror  = () => { setListening(false); recognRef.current = null }
    r.onresult = (e: any) => {
      const t = e.results[0][0].transcript
      setInput(t)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    r.start()
  }

  const newChat = () => { setMessages([]); setSessionId(null); setInput(''); setShowSessions(false) }

  const loadSession = async (id: string) => {
    try {
      const { data } = await aiApi.messages(id)
      setMessages(data.data)
      setSessionId(id)
      setShowSessions(false)
    } catch { toast.error('Failed to load conversation') }
  }

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await aiApi.deleteSession(id)
      qc.invalidateQueries({ queryKey: ['chat-sessions'] })
      if (sessionId === id) newChat()
    } catch { toast.error('Delete failed') }
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] md:h-[calc(100dvh-5rem)] lg:h-[calc(100dvh-4rem)] gap-4 animate-fade-in">

      {/* Desktop sessions sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 gap-2">
        <button onClick={newChat} className="btn-primary w-full"><Plus size={15} />New chat</button>
        <div className="card !p-2 flex-1 overflow-y-auto space-y-0.5">
          <p className="text-xs font-semibold text-slate-400 px-2 py-1.5 uppercase tracking-wide">History</p>
          {!sessions?.length && <p className="text-xs text-slate-400 px-2 py-2">No conversations yet.</p>}
          {sessions?.map((s: any) => (
            <div key={s.id} onClick={() => loadSession(s.id)}
              className={clsx('flex items-center gap-2 px-2 py-2.5 rounded-xl cursor-pointer group transition-all',
                s.id === sessionId ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50 text-slate-600')}>
              <MessageSquare size={13} className="shrink-0 opacity-60" />
              <span className="text-xs flex-1 truncate font-medium">{s.title}</span>
              <button onClick={e => deleteSession(e, s.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 transition-all">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0 card glass !bg-white/70 !p-0 overflow-hidden shadow-lift border-white/50">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
          {/* Mobile back/sessions */}
          <button onClick={() => setShowSessions(!showSessions)}
            className="md:hidden p-1.5 -ml-1 rounded-lg text-slate-400 hover:bg-slate-100">
            {showSessions ? <ChevronLeft size={18} /> : <MessageSquare size={18} />}
          </button>

          <div className="flex-1 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
              <Sparkles size={14} className="text-brand-600" />
            </div>
            <span className="font-semibold text-slate-900 text-sm">AI Health Chat</span>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-0.5 bg-slate-100 rounded-lg p-1">
            {(['simple','technical'] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={clsx('px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
                  mode === m ? 'bg-white text-slate-900 shadow-card' : 'text-slate-400 hover:text-slate-600')}>
                {m === 'simple' ? 'Patient' : 'Doctor'}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile sessions drawer */}
        {showSessions && (
          <div className="md:hidden absolute inset-x-0 top-14 z-10 bg-white border-b border-slate-100 p-3 space-y-1 max-h-60 overflow-y-auto shadow-soft">
            <button onClick={newChat} className="btn-primary w-full mb-2"><Plus size={14} />New chat</button>
            {sessions?.map((s: any) => (
              <div key={s.id} onClick={() => loadSession(s.id)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-slate-50 cursor-pointer">
                <MessageSquare size={13} className="text-slate-400" />
                <span className="text-sm flex-1 truncate text-slate-700">{s.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 animate-fade-in">
              <div className="w-16 h-16 rounded-3xl bg-brand-50 flex items-center justify-center mb-5">
                <Sparkles size={28} className="text-brand-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">Ask about your medicines</h3>
              <p className="text-slate-400 text-sm mb-6 max-w-xs leading-relaxed">
                I can explain medicines, check interactions, and answer health questions safely.
              </p>
              <div className="flex flex-col gap-2.5 w-full max-w-sm">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="card glass !bg-white/80 hover:bg-brand-50 hover:border-brand-200 !py-3 !px-4 text-left justify-start text-[13px] font-medium transition-all hover:-translate-y-0.5 shadow-sm border-white/60">
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-300 mt-6">⚕️ Always consult your doctor for medical decisions.</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.is_emergency ? (
                <div className="w-full alert-danger animate-scale-in">
                  <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-800 mb-1">🚨 Medical Emergency Detected</p>
                    <div className="text-sm text-red-800 whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  </div>
                </div>
              ) : msg.role === 'user' ? (
                <div className="max-w-[80%] px-4 py-3 rounded-2xl bubble-user text-sm leading-relaxed font-medium"
                  style={{ background: 'linear-gradient(135deg,#16a37a,#0ea5e9)', color: 'white' }}>
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[85%] px-4 py-3.5 rounded-2xl bubble-ai bg-slate-100 text-slate-900 text-sm leading-relaxed">
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-2xl bubble-ai bg-slate-100 flex items-center gap-2">
                <span className="flex gap-1">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
                <span className="text-xs text-slate-400 font-medium">AI is thinking…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="px-4 pb-4 pt-3 border-t border-slate-100 shrink-0">
          <div className="flex gap-2 items-end">
            <button onClick={startVoice}
              className={clsx('shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center transition-all',
                listening
                  ? 'border-red-300 bg-red-50 text-red-500 animate-pulse'
                  : 'border-slate-200 text-slate-400 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50')}>
              {listening ? <MicOff size={17} /> : <Mic size={17} />}
            </button>

            <div className="flex-1 relative">
              <textarea ref={inputRef} rows={1}
                className="input resize-none leading-5 pr-12 py-2.5"
                style={{ minHeight: '42px', maxHeight: '120px' }}
                placeholder="Ask about your medicines…"
                value={input}
                onChange={e => { setInput(e.target.value); autoResize() }}
                onKeyDown={handleKeyDown} />
            </div>

            <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
              className="shrink-0 w-10 h-10 rounded-xl bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-brand-sm">
              <Send size={16} />
            </button>
          </div>
          <p className="text-xs text-slate-300 text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}
