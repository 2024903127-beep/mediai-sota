import { google } from 'googleapis';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

// ─── Credentials path resolution ───────────────────────────────────────────────
let keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (keyFilePath && !path.isAbsolute(keyFilePath)) {
  // Try backend dir first, then monorepo root
  const fromBackend = path.resolve(__dirname, '../../', keyFilePath.replace('./', ''));
  const fromRoot    = path.resolve(process.cwd(), keyFilePath);
  keyFilePath = fs.existsSync(fromBackend) ? fromBackend : fromRoot;
} else if (!keyFilePath) {
  keyFilePath = path.resolve(__dirname, '../config/google-credentials.json');
}

const auth = new google.auth.GoogleAuth({
  keyFile: keyFilePath,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

const ROOT_FOLDER = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
if (!ROOT_FOLDER) {
  logger.warn('⚠️  GOOGLE_DRIVE_FOLDER_ID is not set. Drive uploads will fail.');
}

// ─── Shared Drive support ───────────────────────────────────────────────────────
// supportsAllDrives=true is required for both personal shared folders and Shared Drives
const DRIVE_COMMON_PARAMS = { supportsAllDrives: true, supportsTeamDrives: true };

// ─── Get or create user folder ──────────────────────────────────────────────────
async function getUserFolder(userId: string): Promise<string> {
  try {
    const res = await drive.files.list({
      q: `name='mediai_user_${userId}' and mimeType='application/vnd.google-apps.folder' and '${ROOT_FOLDER}' in parents and trashed=false`,
      fields: 'files(id)',
      ...DRIVE_COMMON_PARAMS,
      includeItemsFromAllDrives: true,
    });

    if (res.data.files?.length) return res.data.files[0].id!;

    const folder = await drive.files.create({
      requestBody: {
        name: `mediai_user_${userId}`,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [ROOT_FOLDER],
      },
      fields: 'id',
      ...DRIVE_COMMON_PARAMS,
    });

    return folder.data.id!;
  } catch (err: any) {
    logger.error('Could not get/create user folder', err.message);
    throw err;
  }
}

// ─── Upload file ────────────────────────────────────────────────────────────────
export async function uploadFileToDrive(
  userId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ fileId: string; viewUrl: string }> {
  try {
    const folderId = await getUserFolder(userId);
    const { Readable } = await import('stream');
    const stream = Readable.from(fileBuffer);

    const res = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType, body: stream },
      fields: 'id, webViewLink',
      ...DRIVE_COMMON_PARAMS,
    });

    // Try to make file publicly viewable (non-fatal if fails)
    try {
      await drive.permissions.create({
        fileId: res.data.id!,
        requestBody: { role: 'reader', type: 'anyone' },
        ...DRIVE_COMMON_PARAMS,
      });
    } catch { /* non-fatal */ }

    logger.info(`✅ Uploaded ${fileName} to Drive for user ${userId}`);
    return { fileId: res.data.id!, viewUrl: res.data.webViewLink! };

  } catch (error: any) {
    logger.error('Drive upload failed:', error.message);

    if (error.message?.includes('storage quota') || error.code === 403) {
      throw new Error(
        `❌ Google Drive quota error. To fix this:\n` +
        `1. Go to drive.google.com\n` +
        `2. Right-click your folder → Share\n` +
        `3. Add "mediai-service@mediai-490814.iam.gserviceaccount.com" as Editor\n` +
        `Files will then count against YOUR Google account quota (15GB free).`
      );
    }
    if (error.code === 404 || error.message?.includes('File not found')) {
      throw new Error(`Drive folder "${ROOT_FOLDER}" not found. Check GOOGLE_DRIVE_FOLDER_ID in .env`);
    }
    if (error.message?.includes('invalid_grant')) {
      throw new Error('Google Auth failed — google-credentials.json may be expired.');
    }
    throw new Error(`Drive upload failed: ${error.message}`);
  }
}

// ─── Delete file ────────────────────────────────────────────────────────────────
export async function deleteFileFromDrive(fileId: string): Promise<void> {
  try {
    await drive.files.delete({ fileId, ...DRIVE_COMMON_PARAMS });
    logger.info(`Deleted Drive file ${fileId}`);
  } catch (error) {
    logger.error('Drive delete failed', error);
  }
}

// ─── Delete all user files ──────────────────────────────────────────────────────
export async function deleteAllUserFiles(userId: string): Promise<void> {
  try {
    const folderId = await getUserFolder(userId);
    await drive.files.delete({ fileId: folderId, ...DRIVE_COMMON_PARAMS });
    logger.info(`Deleted all Drive files for user ${userId}`);
  } catch (error) {
    logger.error('Failed to delete user Drive folder', error);
  }
}
