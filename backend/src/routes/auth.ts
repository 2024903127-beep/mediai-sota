import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { sendSuccess, sendError } from '../utils/response';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { deleteAllUserFiles } from '../services/drive.service';

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  role: z.enum(['patient', 'doctor']).default('patient'),
  language_pref: z.enum(['en', 'hi']).default('en'),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function signToken(id: string, email: string, role: string) {
  return jwt.sign({ id, email, role }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, parsed.error.errors[0].message);

  const { email, password, role, language_pref } = parsed.data;
  const phone = parsed.data.phone?.trim() || undefined;

  const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
  if (existing) return sendError(res, 'Email already registered');

  const password_hash = await bcrypt.hash(password, 12);

  const { data: user, error } = await supabase
    .from('users')
    .insert({ email, password_hash, phone, role, language_pref })
    .select('id, email, role, language_pref')
    .single();

  if (error || !user) {
    console.error('Registration Error:', error);
    return sendError(res, error ? error.message : 'Registration failed', 500);
  }

  const token = signToken(user.id, user.email, user.role);
  sendSuccess(res, { user, token }, 'Registration successful', 201);
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, parsed.error.errors[0].message);

  const { email, password } = parsed.data;

  const { data: user } = await supabase
    .from('users')
    .select('id, email, role, password_hash, language_pref, consent_given_at')
    .eq('email', email)
    .single();

  if (!user) return sendError(res, 'Invalid credentials', 401);

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return sendError(res, 'Invalid credentials', 401);

  const token = signToken(user.id, user.email, user.role);
  const { password_hash: _, ...safeUser } = user;
  sendSuccess(res, { user: safeUser, token });
});

// POST /api/auth/consent (give data consent)
router.post('/consent', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 'Unauthenticated', 401);

  await supabase
    .from('users')
    .update({ consent_given_at: new Date().toISOString() })
    .eq('id', userId);
  sendSuccess(res, null, 'Consent recorded');
});

// DELETE /api/auth/delete-account
router.delete('/delete-account', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 'Unauthenticated', 401);

  await supabase.from('users').update({ data_delete_requested_at: new Date().toISOString() }).eq('id', userId);
  // Async cleanup
  deleteAllUserFiles(userId).catch(() => {});
  sendSuccess(res, null, 'Account deletion scheduled. All data will be removed within 30 days.');
});

export default router;
