import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ScanLine, MessageSquare, FileText,
  AlertTriangle, FolderLock, Bell, User, Building2,
  LogOut, Menu, X, Heart, ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { clsx } from 'clsx'

const NAV = [
  { to: '/app/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/app/scanner',       icon: ScanLine,        label: 'Scan Rx' },
  { to: '/app/chat',          icon: MessageSquare,   label: 'AI Chat' },
  { to: '/app/prescriptions', icon: FileText,        label: 'Prescriptions' },
  { to: '/app/risk',          icon: AlertTriangle,   label: 'Risk Check' },
  { to: '/app/locker',        icon: FolderLock,      label: 'Health Locker' },
  { to: '/app/reminders',     icon: Bell,            label: 'Reminders' },
  { to: '/app/profile',       icon: User,            label: 'Profile' },
]

const BOTTOM_NAV = [
  { to: '/app/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/app/scanner',   icon: ScanLine,        label: 'Scan' },
  { to: '/app/chat',      icon: MessageSquare,   label: 'Chat' },
  { to: '/app/risk',      icon: AlertTriangle,   label: 'Risk' },
  { to: '/app/profile',   icon: User,            label: 'Profile' },
]

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'ME'
  const isDoctor = user?.role === 'doctor' || user?.role === 'admin'
  const allNav = isDoctor
    ? [...NAV, { to: '/app/hospital', icon: Building2, label: 'Hospital' }]
    : NAV

  const SidebarInner = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-[18px] border-b border-slate-100 shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg,#16a37a,#0ea5e9)' }}>
          <Heart size={17} className="text-white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="font-bold text-slate-900 leading-none text-[15px]">MediAI</p>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium">by Rahul Mishra</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {allNav.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-[10px] rounded-xl text-[13.5px] font-medium transition-all duration-150 group select-none',
              isActive
                ? 'bg-brand-600 text-white shadow-brand-sm'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            )}>
            {({ isActive }) => (
              <>
                <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight size={13} className="text-white/50" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-5 pt-3 border-t border-slate-100 space-y-1 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50/80">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
            <span className="text-brand-700 text-[11px] font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-slate-900 truncate">{user?.email}</p>
            <p className="text-[10px] text-slate-400 capitalize">{user?.role}</p>
          </div>
        </div>
        <button onClick={() => { logout(); navigate('/login') }}
          className="flex items-center gap-3 px-3 py-[10px] w-full rounded-xl text-[13px] font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all">
          <LogOut size={15} />Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex bg-slate-50">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-100 z-30">
        <SidebarInner />
      </aside>

      {/* Mobile backdrop */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          onClick={() => setOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside className={clsx(
        'lg:hidden fixed left-0 top-0 h-full w-[268px] bg-white z-50 shadow-lift transition-transform duration-300 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <button onClick={() => setOpen(false)}
          className="absolute top-3.5 right-3.5 p-2 rounded-xl text-slate-400 hover:bg-slate-100 z-10">
          <X size={17} />
        </button>
        <SidebarInner />
      </aside>

      {/* Content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">

        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-100"
          style={{ paddingTop: 'env(safe-area-inset-top,0px)' }}>
          <div className="flex items-center justify-between h-14 px-4">
            <button onClick={() => setOpen(true)}
              className="p-2 -ml-1 rounded-xl text-slate-500 hover:bg-slate-100 transition-all"
              aria-label="Menu">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#16a37a,#0ea5e9)' }}>
                <Heart size={13} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-[14px] text-slate-900">MediAI</span>
            </div>
            <NavLink to="/app/profile">
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                <span className="text-brand-700 text-[11px] font-bold">{initials}</span>
              </div>
            </NavLink>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 pb-24 lg:pb-8">
          <div className="max-w-4xl mx-auto px-4 py-5 md:px-6 md:py-7">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-md border-t border-slate-100"
          style={{ paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
          <div className="flex items-center justify-around px-1 py-1">
            {BOTTOM_NAV.map(({ to, icon: Icon, label }) => {
              const active = location.pathname === to ||
                (to !== '/dashboard' && location.pathname.startsWith(to))
              return (
                <NavLink key={to} to={to}
                  className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[52px]">
                  <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center transition-all', active ? 'bg-brand-50' : '')}>
                    <Icon size={20} className={active ? 'text-brand-600' : 'text-slate-400'}
                      strokeWidth={active ? 2.5 : 2} />
                  </div>
                  <span className={clsx('text-[10px] font-semibold', active ? 'text-brand-600' : 'text-slate-400')}>
                    {label}
                  </span>
                </NavLink>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
