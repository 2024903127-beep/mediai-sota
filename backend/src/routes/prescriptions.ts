import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { decrypt } from '../utils/encryption';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

// GET /api/prescriptions
router.get('/', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('prescriptions')
    .select('id, image_url, prescribed_by, prescribed_date, status, created_at, medicines(id, name, frequency_raw, risk_score)')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false });

  if (error) return sendError(res, 'Failed to fetch prescriptions', 500);
  sendSuccess(res, data);
});

// GET /api/prescriptions/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('prescriptions')
    .select('*, medicines(*)')
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .single();

  if (error || !data) return sendError(res, 'Prescription not found', 404);

  // Decrypt sensitive fields
  const result = {
    ...data,
    ocr_raw_text: data.ocr_raw_text_enc ? safeDecrypt(data.ocr_raw_text_enc) : null,
    ai_summary: data.ai_summary_enc ? safeDecrypt(data.ai_summary_enc) : null,
  };
  delete result.ocr_raw_text_enc;
  delete result.ai_summary_enc;

  sendSuccess(res, result);
});

// PATCH /api/prescriptions/:id/status
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  if (!['active', 'expired', 'archived'].includes(status)) return sendError(res, 'Invalid status');

  const { error } = await supabase
    .from('prescriptions')
    .update({ status })
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id);

  if (error) return sendError(res, 'Update failed', 500);
  sendSuccess(res, null, 'Status updated');
});

// DELETE /api/prescriptions/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { error } = await supabase
    .from('prescriptions')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id);

  if (error) return sendError(res, 'Delete failed', 500);
  sendSuccess(res, null, 'Prescription deleted');
});

function safeDecrypt(val: string): string {
  try { return decrypt(val); } catch { return ''; }
}

export default router;
