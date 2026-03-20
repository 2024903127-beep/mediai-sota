import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { uploadMiddleware } from '../middleware/upload';
import { extractTextFromImage } from '../services/ocr.service';
import { summarisePrescription } from '../services/ai.service';
import { uploadFileToSupabase } from '../services/storage.service';
import { analyseRisk } from '../services/risk.service';
import { supabase } from '../config/supabase';
import { encrypt, decrypt } from '../utils/encryption';
import { sendSuccess, sendError } from '../utils/response';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/scan/prescription
router.post('/prescription', uploadMiddleware.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return sendError(res, 'No image file provided');

  const userId = req.user!.id;
  const mode = (req.body.mode as 'simple' | 'technical') || 'simple';

  try {
    // 1. OCR extraction
    const ocr = await extractTextFromImage(req.file.buffer);

    // 2. Upload to Supabase Storage (non-fatal — scan still works if storage fails)
    let fileId = '', viewUrl = '';
    try {
      const fileName = `prescription_${uuidv4()}_${Date.now()}.jpg`;
      const uploaded = await uploadFileToSupabase(userId, fileName, req.file.buffer, req.file.mimetype);
      fileId = uploaded.fileId;
      viewUrl = uploaded.viewUrl;
    } catch (uploadErr: any) {
      logger.warn('Prescription storage skipped (non-fatal):', uploadErr.message);
    }

    // 3. AI summary
    const ai_summary = await summarisePrescription(ocr.raw_text, mode);

    // 4. Risk analysis on extracted medicines
    const medicineNames = ocr.medicines.map((m) => m.name).filter(Boolean);

    // Get patient allergies for risk check
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
        image_drive_id: fileId,
        image_url: viewUrl,
        ocr_raw_text_enc: encrypt(ocr.raw_text),
        ai_summary_enc: encrypt(ai_summary),
        prescribed_by: ocr.doctor_name,
        prescribed_date: ocr.date,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;

    // 6. Save each medicine
    if (ocr.medicines.length > 0) {
      await supabase.from('medicines').insert(
        ocr.medicines.map((m) => ({
          prescription_id: prescription.id,
          user_id: userId,
          name: m.name,
          frequency_raw: m.frequency,
          composition_enc: m.composition ? encrypt(m.composition) : null,
          risk_score: 0,
        }))
      );
    }

    // 7. Save detected interactions
    if (riskReport.interactions.length > 0 && medicineNames.length >= 2) {
      await supabase.from('drug_interactions').insert(
        riskReport.interactions.map((ix) => ({
          user_id: userId,
          medicine_a_name: ix.medicine_a,
          medicine_b_name: ix.medicine_b,
          severity: ix.severity,
          description: ix.description,
          source: ix.source,
          doctor_acknowledged: false,
        }))
      );
    }

    sendSuccess(res, {
      prescription_id: prescription.id,
      ocr: {
        medicines: ocr.medicines,
        doctor_name: ocr.doctor_name,
        date: ocr.date,
        confidence: ocr.confidence,
      },
      ai_summary,
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

