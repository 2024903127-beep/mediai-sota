import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { analyseRisk } from '../services/risk.service';
import { supabase } from '../config/supabase';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

// POST /api/risk/analyse
router.post('/analyse', async (req: AuthRequest, res: Response) => {
  const { medicines, allergies = [] } = req.body;
  if (!medicines || !Array.isArray(medicines)) return sendError(res, 'medicines array required');

  const report = await analyseRisk(medicines, allergies);
  sendSuccess(res, report);
});

// GET /api/risk/my-report
router.get('/my-report', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { data: interactions } = await supabase
    .from('drug_interactions')
    .select('*')
    .eq('user_id', userId)
    .order('detected_at', { ascending: false });
  sendSuccess(res, { interactions: interactions || [] });
});

export default router;
