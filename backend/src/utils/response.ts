import { Response } from 'express';

export const sendSuccess = <T>(res: Response, data: T, message?: string, status = 200) => {
  res.status(status).json({ success: true, data, message });
};

export const sendError = (res: Response, error: string, status = 400) => {
  res.status(status).json({ success: false, error });
};

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number
) => {
  res.json({ success: true, data, total, page, limit });
};

export const DISCLAIMER =
  '⚕️ This information is for general reference only. Always consult your doctor or pharmacist before making any changes to your medication.';
