import { Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { sendError } from '../utils/response';
import { AuthRequest } from './auth';

const CONSENT_EXEMPT = ['/api/auth', '/api/users/consent', '/api/users/me'];

export const consentMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (CONSENT_EXEMPT.some((path) => req.path.startsWith(path))) return next();
  if (!req.user) return next();

  const { data } = await supabase
    .from('users')
    .select('consent_given_at')
    .eq('id', req.user.id)
    .single();

  if (!data?.consent_given_at) {
    return sendError(res, 'User consent required before accessing health data', 403);
  }
  next();
};
