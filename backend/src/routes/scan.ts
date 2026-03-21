import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { uploadMiddleware } from '../middleware/upload';
import { extractTextFromImage } from '../services/ocr.service';
import { summarisePrescription } from '../services/ai.service';
import { uploadFileToSupabase } from '../services/storage.service';
import { analyseRisk } from '../services/risk.service';
import { validateDrugNames } from '../services/drug-validation.service';
import { supabase } from '../config/supabase';
import { decrypt } from '../utils/encryption';
import { sendSuccess, sendError } from '../utils/response';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const router = Router();

function normalizeDrugKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// POST /api/scan/prescription
router.post('/prescription', uploadMiddleware.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return sendError(res, 'No image file provided');

  const userId = req.user!.id;
  const mode = (req.body.mode as 'simple' | 'technical') || 'simple';

  try {
    // 1. OCR extraction
    const ocr = await extractTextFromImage(req.file.buffer);

    // 2. Upload to Supabase Storage (non-fatal — scan still works if storage fails)
    let viewUrl = '';
    try {
      const fileName = `prescription_${uuidv4()}_${Date.now()}.jpg`;
      const uploaded = await uploadFileToSupabase(userId, fileName, req.file.buffer, req.file.mimetype);
      viewUrl = uploaded.viewUrl;
    } catch (uploadErr: any) {
      logger.warn('Prescription storage skipped (non-fatal):', uploadErr.message);
    }

    // 3. AI summary (with OCR-seeded medicine candidates)
    const seedCandidates = ocr.medicines.map((m) => m.name).filter(Boolean);
    const aiResult = await summarisePrescription(ocr.raw_text, mode, seedCandidates);

    // 4. Canonicalize/validate extracted medicines before risk analysis
    const validationResults = await validateDrugNames(aiResult.medicines.map((m) => m.name).filter(Boolean));
    const validationMap = new Map(validationResults.map((result) => [normalizeDrugKey(result.original), result]));
    const reviewSet = new Set<string>([...(aiResult.review_required || []), ...(ocr.review_required || [])]);

    const medicinesMap = new Map<string, any>();
    for (const med of aiResult.medicines) {
      const validation = validationMap.get(normalizeDrugKey(med.name));
      const canonicalName = validation?.canonical || med.name;
      const medKey = normalizeDrugKey(canonicalName);
      if (!medKey) continue;

      if (validation?.requires_review) reviewSet.add(canonicalName);
      const existing = medicinesMap.get(medKey);

      const mergedSuggestions = Array.from(
        new Set([...(existing?.suggestions || []), ...(med.suggestions || []), ...(validation?.suggestions || [])])
      ).slice(0, 5);

      const enriched = {
        ...med,
        name: canonicalName,
        original_name: med.name,
        validation_source: validation?.source || 'unverified',
        validation_confidence: validation?.confidence || 0,
        suggestions: mergedSuggestions,
      };

      if (!existing || (existing.score || 0) < (enriched.score || 0)) {
        medicinesMap.set(medKey, enriched);
      }
    }

    const enrichedMedicines = Array.from(medicinesMap.values());
    const medicineNames = enrichedMedicines.map((m) => m.name).filter(Boolean);

    // ... profile logic ...
    const { data: profile } = await supabase
      .from('patient_profiles')
      .select('allergies_enc')
      .eq('user_id', userId)
      .single();

    let allergies: string[] = [];
    if (profile?.allergies_enc) {
      try { allergies = JSON.parse(decrypt(profile.allergies_enc)); } catch { allergies = []; }
    }

    const riskReport = await analyseRisk(medicineNames, allergies);

    // 5. Save prescription to Supabase
    const { data: prescription, error } = await supabase
      .from('prescriptions')
      .insert({
        user_id: userId,
        image_url: viewUrl,
        ocr_text: ocr.raw_text, // Simplified for now, or keep encryption if needed
        summary: aiResult.summary,
        medicines: enrichedMedicines, // Stores canonicalized medicines with validation metadata
        prescribed_by: ocr.doctor_name,
        prescribed_date: ocr.date,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;

    sendSuccess(res, {
      prescription_id: prescription.id,
      ocr: {
        medicines: enrichedMedicines,
        doctor_name: ocr.doctor_name,
        date: ocr.date,
        confidence: ocr.confidence,
        review_required: Array.from(reviewSet),
        engine_breakdown: ocr.engine_breakdown,
      },
      ai_summary: aiResult.summary,
      risk: riskReport,
      image_url: viewUrl,
    }, 'Prescription scanned successfully');

  } catch (err: any) {
    logger.error('Scan error:', err);
    console.error('Scan error full:', err);
    const message = err.message || 'Scan failed';
    sendError(res, `Scan failed: ${message}. Please try again with a clearer image or check your connection.`, 500);
  }
});

export default router;
