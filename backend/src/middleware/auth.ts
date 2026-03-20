import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase';
import { sendError } from '../utils/response';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return sendError(res, 'No token provided', 401);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string; email: string; role: string;
    };

    // Verify user still exists in Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, data_delete_requested_at')
      .eq('id', decoded.id)
      .single();

    if (error || !user) return sendError(res, 'User not found', 401);
    if (user.data_delete_requested_at) return sendError(res, 'Account pending deletion', 403);

    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch {
    return sendError(res, 'Invalid or expired token', 401);
  }
};

export const requireRole = (...roles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, 'Insufficient permissions', 403);
    }
    next();
  };
