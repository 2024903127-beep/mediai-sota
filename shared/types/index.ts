// ─── User & Auth ───────────────────────────────────────────────────────────────
export type UserRole = 'patient' | 'doctor' | 'admin';

export interface User {
  id: string;
  email: string;
  phone?: string;
  role: UserRole;
  language_pref: 'en' | 'hi';
  consent_given_at: string | null;
  created_at: string;
}

export interface PatientProfile {
  id: string;
  user_id: string;
  dob?: string;
  blood_group?: string;
  allergies?: string[];
  conditions?: string[];
  emergency_contact?: EmergencyContact;
  hospital_id?: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

// ─── Medicine & Prescription ────────────────────────────────────────────────────
export interface Medicine {
  id: string;
  prescription_id: string;
  name: string;
  generic_name?: string;
  composition?: string;
  frequency_raw?: string;
  ai_explanation_simple?: string;
  ai_explanation_technical?: string;
  risk_score?: number;
  openfda_data?: OpenFDADrug;
}

export type PrescriptionStatus = 'active' | 'expired' | 'archived';

export interface Prescription {
  id: string;
  user_id: string;
  image_drive_id?: string;
  image_url?: string;
  ocr_raw_text?: string;
  ai_summary?: string;
  prescribed_by?: string;
  prescribed_date?: string;
  status: PrescriptionStatus;
  medicines?: Medicine[];
  created_at: string;
}

// ─── Risk Detection ─────────────────────────────────────────────────────────────
export type InteractionSeverity = 'low' | 'moderate' | 'high' | 'critical';

export interface DrugInteraction {
  id: string;
  user_id: string;
  medicine_a_id: string;
  medicine_b_id: string;
  medicine_a_name: string;
  medicine_b_name: string;
  severity: InteractionSeverity;
  description: string;
  source: 'AI' | 'OpenFDA' | 'DrugBank';
  detected_at: string;
  doctor_acknowledged: boolean;
}

export interface AllergyWarning {
  medicine_id: string;
  medicine_name: string;
  allergen: string;
  severity: InteractionSeverity;
  description: string;
}

// ─── Chat ───────────────────────────────────────────────────────────────────────
export type MessageRole = 'user' | 'assistant';
export type ExplanationMode = 'simple' | 'technical';

export interface ChatMessage {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  is_emergency: boolean;
  mode: ExplanationMode;
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  mode: ExplanationMode;
  created_at: string;
  messages?: ChatMessage[];
}

// ─── Reminders ─────────────────────────────────────────────────────────────────
export type ReminderFrequency = 'once' | 'daily' | 'twice_daily' | 'thrice_daily' | 'weekly' | 'custom';

export interface Reminder {
  id: string;
  user_id: string;
  medicine_id: string;
  medicine_name: string;
  frequency: ReminderFrequency;
  times: string[];
  start_date: string;
  end_date?: string;
  is_active: boolean;
  notification_method: 'push' | 'sms' | 'both';
}

// ─── Health Locker ──────────────────────────────────────────────────────────────
export interface HealthDocument {
  id: string;
  user_id: string;
  title: string;
  type: 'prescription' | 'report' | 'scan' | 'certificate';
  drive_file_id: string;
  drive_view_url: string;
  size_bytes: number;
  created_at: string;
}

// ─── Hospital Dashboard ─────────────────────────────────────────────────────────
export interface Hospital {
  id: string;
  name: string;
  license_key: string;
  plan: 'starter' | 'pro' | 'enterprise';
  created_at: string;
}

export interface PatientSummary {
  user_id: string;
  name: string;
  active_medicines: number;
  critical_interactions: number;
  last_prescription_date: string;
  risk_level: 'low' | 'medium' | 'high';
}

// ─── OCR ────────────────────────────────────────────────────────────────────────
export interface OCRResult {
  raw_text: string;
  medicines: ExtractedMedicine[];
  doctor_name?: string;
  date?: string;
  confidence: number;
}

export interface ExtractedMedicine {
  name: string;
  frequency?: string;
  composition?: string;
  raw_line: string;
}

// ─── OpenFDA ─────────────────────────────────────────────────────────────────────
export interface OpenFDADrug {
  brand_name?: string[];
  generic_name?: string[];
  warnings?: string[];
  adverse_reactions?: string[];
  drug_interactions?: string[];
  indications_and_usage?: string[];
}

// ─── API Responses ──────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}
