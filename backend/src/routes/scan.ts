import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { uploadMiddleware } from '../middleware/upload';
import { extractTextFromImage } from '../services/ocr.service';
import { summarisePrescription } from '../services/ai.service';
import { uploadFileToSupabase } from '../services/storage.service';
import { analyseRisk } from '../services/risk.service';
import { validateDrugNames } from '../services/drug-validation.service';
import { supabase } from '../config/supabase';
import { decrypt, encrypt } from '../utils/encryption';
import { sendSuccess, sendError } from '../utils/response';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const router = Router();

function normalizeDrugKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const asRecord = err as Record<string, unknown>;
    if (typeof asRecord.message === 'string' && asRecord.message) return asRecord.message;
    if (typeof asRecord.error === 'string' && asRecord.error) return asRecord.error;
  }
  return 'Unknown error';
}

interface SavePrescriptionArgs {
  userId: string;
  fileId: string;
  viewUrl: string;
  rawText: string;
  summary: string;
  medicines: any[];
  doctorName?: string;
  prescribedDate?: string;
  reviewRequired: string[];
  engineBreakdown?: unknown;
}

async function savePrescriptionWithFallback(args: SavePrescriptionArgs): Promise<any> {
  const attempts: Array<{ name: string; payload: Record<string, unknown> }> = [
    {
      name: 'legacy_encrypted',
      payload: {
        user_id: args.userId,
        image_drive_id: args.fileId,
        image_url: args.viewUrl || null,
        ocr_raw_text_enc: encrypt(args.rawText),
        ai_summary_enc: encrypt(args.summary),
        prescribed_by: args.doctorName || null,
        prescribed_date: args.prescribedDate || null,
        status: 'active',
      },
    },
    {
      name: 'hybrid_plaintext',
      payload: {
        user_id: args.userId,
        image_url: args.viewUrl || null,
        ocr_text: args.rawText,
        summary: args.summary,
        medicines: args.medicines,
        prescribed_by: args.doctorName || null,
        prescribed_date: args.prescribedDate || null,
        status: 'active',
      },
    },
    {
      name: 'master_v2',
      payload: {
        user_id: args.userId,
        file_url: args.viewUrl || 'unavailable://upload-failed',
        ocr_text: args.rawText,
        summary: args.summary,
        medicines: args.medicines,
        scan_metadata: {
          review_required: args.reviewRequired,
          engine_breakdown: args.engineBreakdown || null,
          medicines_count: args.medicines.length,
        },
      },
    },
  ];

  const attemptErrors: string[] = [];

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from('prescriptions')
      .insert(attempt.payload)
      .select()
      .single();

    if (!error && data) {
      logger.info(`Prescription saved using schema: ${attempt.name}`);
      return data;
    }

    if (error) {
      const msg = `${attempt.name}: ${error.message}`;
      attemptErrors.push(msg);
      logger.warn(`Prescription insert attempt failed (${msg})`);
    }
  }

  throw new Error(`Unable to save prescription. ${attemptErrors.join(' | ')}`);
}

// POST /api/scan/prescription
router.post('/prescription', uploadMiddleware.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return sendError(res, 'No image file provided');

  const userId = req.user!.id;
  const mode = (req.body.mode as 'simple' | 'technical') || 'simple';

  try {
    // 1. OCR extraction
    const ocr = await extractTextFromImage(req.file.buffer);

    // 2. Upload to Supabase Storage (non-fatal)
    let fileId = '';
    let viewUrl = '';
    try {
      const fileName = `prescription_${uuidv4()}_${Date.now()}.jpg`;
      const uploaded = await uploadFileToSupabase(userId, fileName, req.file.buffer, req.file.mimetype);
      fileId = uploaded.fileId;
      viewUrl = uploaded.viewUrl;
    } catch (uploadErr: unknown) {
      logger.warn(`Prescription storage skipped (non-fatal): ${extractErrorMessage(uploadErr)}`);
    }

    // 3. AI summary (with OCR-seeded medicine candidates)
    const seedCandidates = ocr.medicines.map((m) => m.name).filter(Boolean);
    const aiResult = await summarisePrescription(ocr.raw_text, mode, seedCandidates);

    // 4. Canonicalize/validate extracted medicines before risk analysis
    const validationResults = await validateDrugNames(aiResult.medicines.map((m) => m.name).filter(Boolean));
    const validationMap = new Map(validationResults.map((result) => [normalizeDrugKey(result.original), result]));
    const reviewSet = new Set<string>([...(aiResult.review_required || []), ...(ocr.review_required || [])]);

    const ocrMetaByKey = new Map(ocr.medicines.map((m) => [normalizeDrugKey(m.name), m]));
    const medicinesMap = new Map<string, any>();

    for (const med of aiResult.medicines) {
      const validation = validationMap.get(normalizeDrugKey(med.name));
      const canonicalName = validation?.canonical || med.name;
      const medKey = normalizeDrugKey(canonicalName);
      if (!medKey) continue;

      if (validation?.requires_review) reviewSet.add(canonicalName);
      const existing = medicinesMap.get(medKey);
      const ocrMeta = ocrMetaByKey.get(medKey) || ocrMetaByKey.get(normalizeDrugKey(med.name));

      const mergedSuggestions = Array.from(
        new Set([...(existing?.suggestions || []), ...(med.suggestions || []), ...(validation?.suggestions || [])])
      ).slice(0, 5);

      const enriched = {
        ...med,
        name: canonicalName,
        original_name: med.name,
        frequency: ocrMeta?.frequency,
        raw_line: ocrMeta?.raw_line,
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

    // 5. Profile + risk
    const { data: profile } = await supabase
      .from('patient_profiles')
      .select('allergies_enc')
      .eq('user_id', userId)
      .single();

    let allergies: string[] = [];
    if (profile?.allergies_enc) {
      try {
        allergies = JSON.parse(decrypt(profile.allergies_enc));
      } catch {
        allergies = [];
      }
    }

    const riskReport = await analyseRisk(medicineNames, allergies);

    // 6. Save prescription with schema fallbacks
    const prescription = await savePrescriptionWithFallback({
      userId,
      fileId,
      viewUrl,
      rawText: ocr.raw_text,
      summary: aiResult.summary,
      medicines: enrichedMedicines,
      doctorName: ocr.doctor_name,
      prescribedDate: ocr.date,
      reviewRequired: Array.from(reviewSet),
      engineBreakdown: ocr.engine_breakdown,
    });

    // 7. Legacy tables: medicines + interactions (non-fatal)
    if (enrichedMedicines.length > 0) {
      const medicineRows = enrichedMedicines.map((m) => ({
        prescription_id: prescription.id,
        user_id: userId,
        name: m.name,
        frequency_raw: m.frequency || null,
        composition_enc: m.composition ? encrypt(String(m.composition)) : null,
        risk_score: typeof m.score === 'number' ? Math.max(0, 100 - m.score) : 0,
      }));

      const { error: medsError } = await supabase.from('medicines').insert(medicineRows);
      if (medsError) {
        logger.warn(`Legacy medicines insert skipped (non-fatal): ${medsError.message}`);
      }
    }

    if (riskReport.interactions.length > 0 && medicineNames.length >= 2) {
      const interactionRows = riskReport.interactions.map((ix) => ({
        user_id: userId,
        medicine_a_name: ix.medicine_a,
        medicine_b_name: ix.medicine_b,
        severity: ix.severity,
        description: ix.description,
        source: ix.source,
        doctor_acknowledged: false,
      }));

      const { error: interactionError } = await supabase.from('drug_interactions').insert(interactionRows);
      if (interactionError) {
        logger.warn(`Legacy drug_interactions insert skipped (non-fatal): ${interactionError.message}`);
      }
    }

    sendSuccess(
      res,
      {
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
      },
      'Prescription scanned successfully'
    );
  } catch (err: unknown) {
    const message = extractErrorMessage(err);
    logger.error(`Scan error: ${message}`, err);

    if (message.includes('Failed to extract text from image') || message.includes('OCR engines unavailable')) {
      return sendError(
        res,
        'Unable to read text from the uploaded file. Please upload a clear JPG/PNG image with good lighting.',
        500
      );
    }

    return sendError(
      res,
      `Scan failed: ${message}`,
      500
    );
  }
});

export default router;
