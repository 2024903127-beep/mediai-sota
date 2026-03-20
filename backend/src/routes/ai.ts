import { Router, Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { explainMedicine, aiChat } from '../services/ai.service';
import { lookupNutrition, searchFood } from '../services/nutrition.service';
import { supabase } from '../config/supabase';
import { sendSuccess, sendError } from '../utils/response';
import { decrypt } from '../utils/encryption';
import { v4 as uuidv4 } from 'uuid';
import { recordFeedback } from '../services/training.service';

const router = Router();

// POST /api/ai/explain
router.post('/explain', async (req: AuthRequest, res: Response) => {
  const { medicine_name, composition, mode = 'simple' } = req.body;
  if (!medicine_name) return sendError(res, 'medicine_name is required');

  const userId = req.user?.id;
  if (!userId) return sendError(res, 'Unauthenticated', 401);

  const { data: userRow } = await supabase.from('users').select('language_pref').eq('id', userId).single();
  const lang = userRow?.language_pref || 'en';

  const explanation = await explainMedicine(medicine_name, composition, mode, lang);
  sendSuccess(res, { explanation, mode, medicine_name });
});

// GET /api/ai/nutrition/:barcode
router.get('/nutrition/:barcode', async (req: AuthRequest, res: Response) => {
  const prod = await lookupNutrition(req.params.barcode);
  if (!prod) return sendError(res, 'Product not found', 404);
  sendSuccess(res, prod);
});

// POST /api/ai/nutrition/search
router.post('/nutrition/search', async (req: AuthRequest, res: Response) => {
  const { query } = req.body;
  if (!query) return sendError(res, 'query required');
  const results = await searchFood(query);
  sendSuccess(res, results);
});

// POST /api/ai/feedback (HITL Feedback)
router.post('/feedback', async (req: Request, res: Response) => {
  const { raw_ocr, human_correction, confidence_score } = req.body;
  await recordFeedback(raw_ocr, human_correction, confidence_score);
  sendSuccess(res, null, 'Feedback recorded for model training');
});

// POST /api/ai/chat
router.post('/chat', async (req: AuthRequest, res: Response) => {
  const { message, session_id, mode = 'simple' } = req.body;
  if (!message) return sendError(res, 'message is required');

  const userId = req.user?.id;
  if (!userId) return sendError(res, 'Unauthenticated', 401);

  // Get conversation history
  let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let sessionId = session_id;

  if (sessionId) {
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(20);
    history = (messages || []) as typeof history;
  } else {
    sessionId = uuidv4();
    await supabase.from('chat_sessions').insert({ id: sessionId, user_id: userId, title: message.slice(0, 50), mode });
  }

  // Get patient context
  const { data: profile } = await supabase.from('patient_profiles').select('allergies_enc, conditions_enc').eq('user_id', userId).single();
  const { data: activeMeds } = await supabase.from('medicines').select('name').eq('user_id', userId).limit(10);

  const patientContext = {
    activeMedicines: activeMeds?.map((m) => m.name),
    allergies: profile?.allergies_enc ? JSON.parse(safeDecrypt(profile.allergies_enc)) : [],
    conditions: profile?.conditions_enc ? JSON.parse(safeDecrypt(profile.conditions_enc)) : [],
  };

  const { data: userRow } = await supabase.from('users').select('language_pref').eq('id', userId).single();
  const lang = userRow?.language_pref || 'en';

  const { reply, isEmergency } = await aiChat(message, history, patientContext, mode, lang);

  // Save messages
  await supabase.from('chat_messages').insert([
    { session_id: sessionId, role: 'user', content: message, is_emergency: false, mode },
    { session_id: sessionId, role: 'assistant', content: reply, is_emergency: isEmergency, mode },
  ]);

  sendSuccess(res, { reply, session_id: sessionId, is_emergency: isEmergency });
});

function safeDecrypt(val: any): string {
  try {
    if (!val) return '[]';
    return decrypt(val);
  } catch {
    return '[]';
  }
}

export default router;
