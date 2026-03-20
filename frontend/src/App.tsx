import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/auth.store'
import Layout from './components/shared/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ConsentPage from './pages/ConsentPage'
import DashboardPage from './pages/DashboardPage'
import ScannerPage from './pages/ScannerPage'
import ChatPage from './pages/ChatPage'
import PrescriptionsPage from './pages/PrescriptionsPage'
import RiskPage from './pages/RiskPage'
import LockerPage from './pages/LockerPage'
import RemindersPage from './pages/RemindersPage'
import ProfilePage from './pages/ProfilePage'
import HospitalPage from './pages/HospitalPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (!user?.consent_given_at) return <Navigate to="/consent" replace />
  return <>{children}</>
}

function RequireDoctor({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (user?.role !== 'doctor' && user?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        gutter={8}
        toastOptions={{
          duration: 3500,
          style: {
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
            padding: '12px 16px',
            maxWidth: '360px',
          },
          success: {
            iconTheme: { primary: '#16a37a', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/consent" element={<ConsentPage />} />
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="scanner" element={<ScannerPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="prescriptions" element={<PrescriptionsPage />} />
          <Route path="risk" element={<RiskPage />} />
          <Route path="locker" element={<LockerPage />} />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="hospital" element={<RequireDoctor><HospitalPage /></RequireDoctor>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
