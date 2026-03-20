import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

/**
 * Anonymized Dataset Collector
 * Collects corrected OCR data for future custom model training (ML).
 * Requires user consent (checked at route level).
 */

export async function collectTrainingData(
  original_text: string,
  corrected_text: string,
  source_type: 'prescription' | 'medicine_label',
  metadata: any = {}
) {
  try {
    // Only collect if significantly different (i.e. correction happened)
    if (original_text.trim() === corrected_text.trim()) return;

    logger.info(`📊 Collecting training data for ${source_type}...`);
    
    // We store this in a separate table 'ai_training_data'
    // Note: Table must be created in Supabase (anonymized, no user_id)
    const { error } = await supabase
      .from('ai_training_data')
      .insert({
        original_text: original_text.slice(0, 5000),
        corrected_text: corrected_text.slice(0, 5000),
        source_type,
        metadata,
        created_at: new Date().toISOString()
      });

    if (error) {
      if (error.code === '42P01') {
        logger.debug('Training data table not created yet, skipping collection.');
      } else {
        logger.error('Failed to collect training data', error);
      }
    }
  } catch (err) {
    logger.error('Training data collector error', err);
  }
}
/**
 * HITL (Human-in-the-Loop) Feedback Collector
 * Specifically stores user/doctor corrections for SOTA model fine-tuning.
 */
export async function recordFeedback(
  ocr_raw: string,
  human_correction: string,
  confidence_score?: number,
  model_version: string = 'v2-ensemble'
) {
  try {
    logger.info('🧪 Recording HITL feedback for model improvement...');
    const { error } = await supabase
      .from('ai_training_feedback')
      .insert({
        raw_ocr: ocr_raw,
        human_correction: human_correction,
        confidence_score,
        model_version,
        created_at: new Date().toISOString()
      });

    if (error && error.code !== '42P01') {
      logger.error('Failed to record HITL feedback', error);
    }
  } catch (err) {
    logger.error('Feedback recording crash', err);
  }
}
