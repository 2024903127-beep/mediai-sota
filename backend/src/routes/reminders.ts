import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { generateReminderSchedule } from '../services/ai.service';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

// GET /api/reminders
router.get('/', async (req: AuthRequest, res: Response) => {
  const { data } = await supabase.from('reminders').select('*').eq('user_id', req.user!.id).eq('is_active', true);
  sendSuccess(res, data || []);
});

// POST /api/reminders/generate - AI generates schedule from medicines
router.post('/generate', async (req: AuthRequest, res: Response) => {
  const { medicines } = req.body;
  if (!medicines?.length) return sendError(res, 'medicines array required');

  const schedule = await generateReminderSchedule(medicines);
  sendSuccess(res, { schedule });
});

// POST /api/reminders
router.post('/', async (req: AuthRequest, res: Response) => {
  const { medicine_id, medicine_name, frequency, times, start_date, end_date, notification_method } = req.body;
  if (!medicine_name || !times?.length) return sendError(res, 'medicine_name and times required');

  const { data, error } = await supabase
    .from('reminders')
    .insert({ user_id: req.user!.id, medicine_id, medicine_name, frequency, times, start_date, end_date, notification_method: notification_method || 'push', is_active: true })
    .select()
    .single();

  if (error) return sendError(res, 'Failed to create reminder', 500);
  sendSuccess(res, data, 'Reminder created', 201);
});

// PATCH /api/reminders/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const { error } = await supabase.from('reminders').update(req.body).eq('id', req.params.id).eq('user_id', req.user!.id);
  if (error) return sendError(res, 'Update failed', 500);
  sendSuccess(res, null, 'Reminder updated');
});

// DELETE /api/reminders/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  await supabase.from('reminders').update({ is_active: false }).eq('id', req.params.id).eq('user_id', req.user!.id);
  sendSuccess(res, null, 'Reminder disabled');
});

export default router;
