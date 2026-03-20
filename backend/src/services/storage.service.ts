import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

const BUCKET_NAME = 'mediai-documents';

// Initialize bucket if needed
async function ensureBucket() {
  const { data, error } = await supabase.storage.getBucket(BUCKET_NAME);
  if (error || !data) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 10485760, // 10MB
    });
    if (createError) logger.error('Failed to create Supabase storage bucket', createError);
  }
}

// ─── Upload file ───────────────────────────────────────────────────────────────
export async function uploadFileToSupabase(
  userId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ fileId: string; viewUrl: string }> {
  try {
    await ensureBucket();
    
    const filePath = `${userId}/${fileName}`;
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    logger.info(`Uploaded ${fileName} to Supabase Storage for user ${userId}`);
    return { fileId: data.path, viewUrl: publicUrlData.publicUrl };
  } catch (error: any) {
    logger.error('Supabase upload failed', error);
    throw new Error(`Upload failed: ${error.message}`);
  }
}

// ─── Delete file ───────────────────────────────────────────────────────────────
export async function deleteFileFromSupabase(filePath: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);
    if (error) throw error;
    logger.info(`Deleted Supabase file ${filePath}`);
  } catch (error) {
    logger.error('Supabase delete failed', error);
  }
}
