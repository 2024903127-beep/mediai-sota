import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mediai_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('mediai_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// ─── API helpers ───────────────────────────────────────────────────────────────
export const authApi = {
  register: (d: any) => api.post('/auth/register', d),
  login: (d: any) => api.post('/auth/login', d),
  consent: () => api.post('/auth/consent'),
  deleteAccount: () => api.delete('/auth/delete-account'),
}

export const userApi = {
  me: () => api.get('/users/me'),
  updateProfile: (d: any) => api.put('/users/profile', d),
  giveConsent: () => api.post('/users/consent'),
}

export const scanApi = {
  scanPrescription: (formData: FormData) => api.post('/scan/prescription', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }),
}

export const prescriptionApi = {
  list: () => api.get('/prescriptions'),
  get: (id: string) => api.get(`/prescriptions/${id}`),
  updateStatus: (id: string, status: string) => api.patch(`/prescriptions/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/prescriptions/${id}`),
}

export const aiApi = {
  explain: (medicine_name: string, composition?: string, mode = 'simple') => api.post('/ai/explain', { medicine_name, composition, mode }),
  chat: (message: string, session_id?: string, mode = 'simple') => api.post('/ai/chat', { message, session_id, mode }),
  sessions: () => api.get('/chat/sessions'),
  messages: (id: string) => api.get(`/chat/sessions/${id}/messages`),
  deleteSession: (id: string) => api.delete(`/chat/sessions/${id}`),
}

export const riskApi = {
  analyse: (medicines: string[], allergies?: string[]) => api.post('/risk/analyse', { medicines, allergies }),
  myReport: () => api.get('/risk/my-report'),
}

export const reminderApi = {
  list: () => api.get('/reminders'),
  generate: (medicines: any[]) => api.post('/reminders/generate', { medicines }),
  create: (d: any) => api.post('/reminders', d),
  update: (id: string, d: any) => api.patch(`/reminders/${id}`, d),
  delete: (id: string) => api.delete(`/reminders/${id}`),
}

export const lockerApi = {
  list: () => api.get('/locker'),
  upload: (formData: FormData) => api.post('/locker/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: string) => api.delete(`/locker/${id}`),
}

export const hospitalApi = {
  patients: () => api.get('/hospital/patients'),
  patientSummary: (userId: string) => api.get(`/hospital/patients/${userId}/summary`),
  alerts: () => api.get('/hospital/alerts'),
  acknowledgeAlert: (id: string) => api.patch(`/hospital/alerts/${id}/acknowledge`),
}
