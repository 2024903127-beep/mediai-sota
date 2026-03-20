# 🏥 MediAI: State-of-the-Art (SOTA) Medical Intelligence Platform

> **MediAI** is a research-grade, production-ready AI healthcare ecosystem designed for **95–98% accuracy** in prescription digitization, medicine intelligence, and clinical decision support.

---

## ⚕️ Safety First: Legal Disclaimer
**MediAI is an informational assistant only.**
- It **NEVER** provides dosage instructions.
- It **NEVER** replaces a doctor's diagnosis.
- Always verify AI-extracted results against the physical prescription.
- Emergency detection logic (Soundex-based) identifies crises and redirects to help instantly.

---

## 🧪 The SOTA 10-Tier Architecture
MediAI uses a multi-layered verification system to ensure ultra-high precision.

1.  **Ensemble OCR System**: Runs **Tesseract.js** (Structural) and **TrOCR** (Visual Transformers) in parallel.
2.  **Confidence Voting Engine**: Orchestrates OCR outputs and selects results based on a weighted confidence score.
3.  **Tiered Correction Layer**: Uses **Soundex (Phonetic)**, **N-Grams**, and **Levenshtein** distance to resolve messy handwriting.
4.  **pgvector RAG Brain**: High-performance medical knowledge retrieval using 384-dimensional embeddings (MiniLM).
5.  **Multi-Source Knowledge Graph**: Integration with **OpenFDA**, **RxNorm**, **WHO Essential Medicines**, and **ICD-10/11**.
6.  **Nutrition Intelligence**: Real-time product lookup via **Open Food Facts API** (millions of products).
7.  **HITL Feedback System**: **Human-in-the-Loop** collector to store corrected data pairs for model fine-tuning.
8.  **Offline Neural Engine**: Local ML inference using `@xenova/transformers` for privacy-first architecture.
9.  **Emergency Shield**: 100+ keyword-based crisis detection system.
10. **Data Privacy (HIPAA-Ready)**: AES-256 encryption, RLS policies, and service-account based Google Drive locker.

---

## 📚 Medical Knowledge Sources
Our "Medical Brain" is powered by the following open-source clinical datasets:
- **🗃️ Drug Data**: OpenFDA, RxNorm, DailyMed, WHO Drug Lists.
- **🏥 Disease Data**: ICD-10 (Clinical Codes), SNOMED Baseline.
- **🍎 Nutrition**: Open Food Facts (Real-time API).
- **📝 Clinical Abstracts**: Structured knowledge from WHO Essential Medicines list.

---

## 🛠️ Technology Stack
| Layer | Technologies |
|---|---|
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, Zustand |
| **Backend** | Node.js, Express, TypeScript, Sharp (Image Processing) |
| **Database** | Supabase (PostgreSQL), **pgvector** (Vector Search) |
| **AI Models** | **all-MiniLM-L6-v2** (Embeddings), **TrOCR** (OCR), **Tesseract.js** |
| **File Storage** | Google Drive API (Patient Vault), Supabase Storage |
| **Security** | Helmet, Morgan, Winston (Logging), AES-256 Encryption |

---

## 🚀 Speed Run: Getting Started

### 1. Unified Setup
```bash
git clone https://github.com/rahulmishra/mediai.git
cd mediai
npm install
```

### 2. Activate the SOTA Brain (Supabase)
1. Go to your **Supabase SQL Editor**.
2. Execute the **Master Schema**: `backend/supabase/migrations/master_schema_v2.sql`.
3. This creates the `pgvector` brain, `medical_knowledge` tables, and `HITL` feedback structures.

### 3. Populate the AI Knowledge
1. Navigate to the `backend` folder.
2. Run: `npm run sync:vectors`
3. This will embed and sync 460+ medicine records into your production database.

---

## 🤖 Model Training Pipeline
MediAI is ready for custom training. We have provided a **[SOTA Training Guide](backend/brain/AI_TRAINING_GUIDE.md)** including PyTorch boilerplate for:
- **Fine-tuning TrOCR** on medical handwriting.
- **Prescription NER** (Named Entity Recognition) using LayoutLM.
- **HITL Retraining** using the collected `ai_training_feedback` table.

---

## 🔐 Compliance & Security
- **HIPAA-Ready**: Data is encrypted at rest and in transit.
- **Audit Logs**: All AI interactions and data accesses are logged via Winston/Supabase.
- **Patient Privacy**: No PII (Personally Identifiable Information) is sent to external AI models; embeddings are generated locally.

---

## 📄 License
MIT © Rahul Mishra - MediAI SOTA Platform.
