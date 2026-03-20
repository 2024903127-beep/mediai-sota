-- MediAI Platform - Complete Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'admin')),
  language_pref TEXT NOT NULL DEFAULT 'en' CHECK (language_pref IN ('en', 'hi')),
  consent_given_at TIMESTAMPTZ,
  data_delete_requested_at TIMESTAMPTZ,
  encryption_key_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── HOSPITALS ────────────────────────────────────────────────────────────────
CREATE TABLE hospitals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  license_key TEXT UNIQUE NOT NULL DEFAULT uuid_generate_v4()::TEXT,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PATIENT PROFILES ─────────────────────────────────────────────────────────
CREATE TABLE patient_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  dob DATE,
  blood_group TEXT,
  allergies_enc TEXT,
  conditions_enc TEXT,
  emergency_contact_enc TEXT,
  hospital_id UUID REFERENCES hospitals(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PRESCRIPTIONS ────────────────────────────────────────────────────────────
CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  image_drive_id TEXT,
  image_url TEXT,
  ocr_raw_text_enc TEXT,
  ai_summary_enc TEXT,
  prescribed_by TEXT,
  prescribed_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MEDICINES ────────────────────────────────────────────────────────────────
CREATE TABLE medicines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  generic_name TEXT,
  composition_enc TEXT,
  frequency_raw TEXT,
  ai_explanation_simple TEXT,
  ai_explanation_technical TEXT,
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  openfda_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DRUG INTERACTIONS ────────────────────────────────────────────────────────
CREATE TABLE drug_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  medicine_a_id UUID REFERENCES medicines(id),
  medicine_b_id UUID REFERENCES medicines(id),
  medicine_a_name TEXT NOT NULL,
  medicine_b_name TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
  description TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'AI' CHECK (source IN ('AI', 'OpenFDA', 'DrugBank')),
  doctor_acknowledged BOOLEAN DEFAULT FALSE,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CHAT SESSIONS ────────────────────────────────────────────────────────────
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  mode TEXT NOT NULL DEFAULT 'simple' CHECK (mode IN ('simple', 'technical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CHAT MESSAGES ────────────────────────────────────────────────────────────
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  is_emergency BOOLEAN DEFAULT FALSE,
  mode TEXT NOT NULL DEFAULT 'simple',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── REMINDERS ────────────────────────────────────────────────────────────────
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  medicine_id UUID REFERENCES medicines(id) ON DELETE SET NULL,
  medicine_name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily',
  times TEXT[] NOT NULL DEFAULT '{}',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  notification_method TEXT NOT NULL DEFAULT 'push' CHECK (notification_method IN ('push', 'sms', 'both')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── HEALTH DOCUMENTS ─────────────────────────────────────────────────────────
CREATE TABLE health_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'document' CHECK (type IN ('prescription', 'report', 'scan', 'certificate', 'document')),
  drive_file_id TEXT NOT NULL,
  drive_view_url TEXT NOT NULL,
  size_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AUDIT LOG ────────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_prescriptions_user_id ON prescriptions(user_id);
CREATE INDEX idx_prescriptions_status ON prescriptions(status);
CREATE INDEX idx_medicines_prescription_id ON medicines(prescription_id);
CREATE INDEX idx_medicines_user_id ON medicines(user_id);
CREATE INDEX idx_drug_interactions_user_id ON drug_interactions(user_id);
CREATE INDEX idx_drug_interactions_severity ON drug_interactions(severity);
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_health_documents_user_id ON health_documents(user_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_documents ENABLE ROW LEVEL SECURITY;

-- Users can only read their own data (backend uses service role so bypasses RLS)
CREATE POLICY "users_own_data" ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY "profiles_own_data" ON patient_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "prescriptions_own_data" ON prescriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "medicines_own_data" ON medicines FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "interactions_own_data" ON drug_interactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "chat_sessions_own" ON chat_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "reminders_own" ON reminders FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "documents_own" ON health_documents FOR ALL USING (auth.uid() = user_id);

-- ─── UPDATED_AT TRIGGER ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON patient_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_prescriptions_updated_at BEFORE UPDATE ON prescriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
