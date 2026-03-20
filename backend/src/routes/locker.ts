import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { uploadFileToSupabase, deleteFileFromSupabase } from '../services/storage.service';
import { uploadMiddleware } from '../middleware/upload';
import { sendSuccess, sendError } from '../utils/response';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/locker
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { data } = await supabase.from('health_documents').select('*').eq('user_id', req.user!.id).order('created_at', { ascending: false });
    sendSuccess(res, data || []);
  } catch { sendError(res, 'Failed to load documents', 500); }
});

// POST /api/locker/upload
router.post('/upload', uploadMiddleware.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return sendError(res, 'No file provided');
    const { title, type = 'document' } = req.body;
    if (!title) return sendError(res, 'title is required');

    const fileName = `${type}_${uuidv4()}_${req.file.originalname}`;
    const { fileId, viewUrl } = await uploadFileToSupabase(req.user!.id, fileName, req.file.buffer, req.file.mimetype);

    const { data, error } = await supabase.from('health_documents').insert({
      user_id: req.user!.id, title, type, drive_file_id: fileId, drive_view_url: viewUrl, size_bytes: req.file.size,
    }).select().single();

    if (error) return sendError(res, 'Failed to save document record', 500);
    sendSuccess(res, data, 'Document uploaded', 201);
  } catch (err: any) {
    sendError(res, err.message || 'Upload failed', 500);
  }
});

// DELETE /api/locker/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { data } = await supabase.from('health_documents').select('drive_file_id').eq('id', req.params.id).eq('user_id', req.user!.id).single();
    if (!data) return sendError(res, 'Document not found', 404);
    await deleteFileFromSupabase(data.drive_file_id).catch(() => {});
    await supabase.from('health_documents').delete().eq('id', req.params.id);
    sendSuccess(res, null, 'Document deleted');
  } catch { sendError(res, 'Delete failed', 500); }
});

export default router;
