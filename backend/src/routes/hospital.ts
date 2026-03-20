import { Router, Response } from 'express';
import { AuthRequest, requireRole } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

router.use(requireRole('doctor', 'admin'));

router.get('/patients', async (req: AuthRequest, res: Response) => {
  const { data: doctor } = await supabase.from('patient_profiles').select('hospital_id').eq('user_id', req.user!.id).single();
  if (!doctor?.hospital_id) return sendError(res, 'Not associated with a hospital', 403);

  const { data } = await supabase.from('patient_profiles').select(`
    user_id, dob, blood_group,
    users!inner(email, created_at),
    prescriptions(id, status, created_at, medicines(id, name, risk_score))
  `).eq('hospital_id', doctor.hospital_id);

  sendSuccess(res, data || []);
});

router.get('/patients/:userId/summary', async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const { data: prescriptions } = await supabase.from('prescriptions').select('id, status, created_at, medicines(name, risk_score)').eq('user_id', userId).eq('status', 'active');
  const { data: interactions } = await supabase.from('drug_interactions').select('severity').eq('user_id', userId);

  const critical = interactions?.filter((i) => i.severity === 'critical' || i.severity === 'high').length || 0;
  const activeMeds = prescriptions?.flatMap((p: any) => p.medicines || []).length || 0;
  const maxRisk = prescriptions?.flatMap((p: any) => p.medicines || []).reduce((max: number, m: any) => Math.max(max, m.risk_score || 0), 0) || 0;

  sendSuccess(res, {
    user_id: userId,
    active_medicines: activeMeds,
    critical_interactions: critical,
    risk_score: maxRisk,
    risk_level: maxRisk > 70 ? 'high' : maxRisk > 40 ? 'medium' : 'low',
    prescriptions: prescriptions || [],
  });
});

router.get('/alerts', async (req: AuthRequest, res: Response) => {
  const { data: doctor } = await supabase.from('patient_profiles').select('hospital_id').eq('user_id', req.user!.id).single();
  if (!doctor?.hospital_id) return sendError(res, 'Not associated with a hospital', 403);

  const { data: patients } = await supabase.from('patient_profiles').select('user_id').eq('hospital_id', doctor.hospital_id);
  const userIds = patients?.map((p) => p.user_id) || [];
  if (!userIds.length) return sendSuccess(res, []);

  const { data: alerts } = await supabase.from('drug_interactions').select('*, users!inner(email)').in('user_id', userIds).eq('doctor_acknowledged', false).in('severity', ['high', 'critical']).order('detected_at', { ascending: false });

  sendSuccess(res, alerts || []);
});

router.patch('/alerts/:id/acknowledge', async (_req: AuthRequest, res: Response) => {
  await supabase.from('drug_interactions').update({ doctor_acknowledged: true }).eq('id', _req.params.id);
  sendSuccess(res, null, 'Alert acknowledged');
});

export default router;
