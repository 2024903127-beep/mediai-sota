import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { encrypt, decrypt } from '../utils/encryption';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

// GET /api/users/me
router.get('/me', async (req: AuthRequest, res: Response) => {
  const { data: user } = await supabase.from('users').select('id, email, phone, role, language_pref, consent_given_at, created_at').eq('id', req.user!.id).single();
  const { data: profile } = await supabase.from('patient_profiles').select('*').eq('user_id', req.user!.id).single();

  let decryptedProfile = null;
  if (profile) {
    decryptedProfile = {
      ...profile,
      allergies: profile.allergies_enc ? JSON.parse(safeDecrypt(profile.allergies_enc)) : [],
      conditions: profile.conditions_enc ? JSON.parse(safeDecrypt(profile.conditions_enc)) : [],
      emergency_contact: profile.emergency_contact_enc ? JSON.parse(safeDecrypt(profile.emergency_contact_enc)) : null,
    };
    delete decryptedProfile.allergies_enc;
    delete decryptedProfile.conditions_enc;
    delete decryptedProfile.emergency_contact_enc;
  }

  sendSuccess(res, { user, profile: decryptedProfile });
});

// PUT /api/users/profile
router.put('/profile', async (req: AuthRequest, res: Response) => {
  const { dob, blood_group, allergies, conditions, emergency_contact, language_pref } = req.body;
  const userId = req.user!.id;

  if (language_pref) {
    await supabase.from('users').update({ language_pref }).eq('id', userId);
  }

  const profileUpdate: Record<string, unknown> = { user_id: userId };
  if (dob) profileUpdate.dob = dob;
  if (blood_group) profileUpdate.blood_group = blood_group;
  if (allergies) profileUpdate.allergies_enc = encrypt(JSON.stringify(allergies));
  if (conditions) profileUpdate.conditions_enc = encrypt(JSON.stringify(conditions));
  if (emergency_contact) profileUpdate.emergency_contact_enc = encrypt(JSON.stringify(emergency_contact));

  const { data: existing } = await supabase.from('patient_profiles').select('id').eq('user_id', userId).single();

  if (existing) {
    await supabase.from('patient_profiles').update(profileUpdate).eq('user_id', userId);
  } else {
    await supabase.from('patient_profiles').insert(profileUpdate);
  }

  sendSuccess(res, null, 'Profile updated');
});

// POST /api/users/consent
router.post('/consent', async (req: AuthRequest, res: Response) => {
  await supabase.from('users').update({ consent_given_at: new Date().toISOString() }).eq('id', req.user!.id);
  sendSuccess(res, null, 'Consent recorded');
});

function safeDecrypt(val: string): string {
  try { return decrypt(val); } catch { return '[]'; }
}

export default router;
