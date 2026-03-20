import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

router.get('/sessions', async (req: AuthRequest, res: Response) => {
  const { data } = await supabase.from('chat_sessions').select('id, title, mode, created_at').eq('user_id', req.user!.id).order('created_at', { ascending: false }).limit(20);
  sendSuccess(res, data || []);
});

router.get('/sessions/:id/messages', async (req: AuthRequest, res: Response) => {
  const { data: session } = await supabase.from('chat_sessions').select('id').eq('id', req.params.id).eq('user_id', req.user!.id).single();
  if (!session) return sendError(res, 'Session not found', 404);
  const { data } = await supabase.from('chat_messages').select('*').eq('session_id', req.params.id).order('created_at', { ascending: true });
  sendSuccess(res, data || []);
});

router.delete('/sessions/:id', async (req: AuthRequest, res: Response) => {
  await supabase.from('chat_sessions').delete().eq('id', req.params.id).eq('user_id', req.user!.id);
  sendSuccess(res, null, 'Session deleted');
});

export default router;
