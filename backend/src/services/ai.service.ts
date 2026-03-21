import path from 'path';
import fs from 'fs';
import { pipeline } from '@xenova/transformers';
import levenshtein from 'fast-levenshtein';
import { DISCLAIMER } from '../utils/response';
import { logger } from '../utils/logger';
import { vectorSearch } from './vector.service';

export type ExplanationMode = 'simple' | 'technical';

// ─── Emergency keywords ────────────────────────────────────────────────────────
const EMERGENCY_KEYWORDS = [
  'chest pain', 'can\'t breathe', 'difficulty breathing', 'unconscious',
  'overdose', 'swallowed too much', 'allergic reaction', 'anaphylaxis',
  'seizure', 'stroke', 'heart attack', 'suicide', 'self harm', 'poisoning',
];

export function isEmergencyQuery(text: string): boolean {
  return EMERGENCY_KEYWORDS.some((kw) => text.toLowerCase().includes(kw));
}

// ─── Local Database ────────────────────────────────────────────────────────────
let medicinesDb: any[] = [];
let diseasesDb: any[] = [];
try {
  const dbPath = path.resolve(__dirname, '../data/medicines_db.json');
  const fullDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  medicinesDb = fullDb.medicines || [];
  diseasesDb  = fullDb.diseases  || [];
  logger.info(`🧠 AI Brain loaded: ${medicinesDb.length} medicines, ${diseasesDb.length} diseases.`);
} catch (err) {
  logger.error('Could not load medicines_db.json', err);
}

// ─── Fuzzy / alias-based fast search ──────────────────────────────────────────
/**
 * 6-tier matching strategy (SOTA Research Grade):
 * 1. Exact name match
 * 2. Prefix / substring match
 * 3. Composition-based match
 * 4. Phonetic match (Soundex) - SOTA Tier
 * 5. N-gram similarity (handles missing/swapped characters)
 * 6. Levenshtein distance (baseline fuzzy)
 */
export interface SearchResult {
  med: any | null;
  score: number;
  suggestions?: Array<{ name: string; score: number }>;
}

function fastSearch(query: string): SearchResult | null {
  const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  if (!q || q.length < 3) return null;

  const qSoundex = getSoundex(q);
  const candidates: Array<{ med: any; score: number }> = [];

  for (const med of medicinesDb) {
    const name = (med.name || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const comp = (med.composition || '').toLowerCase().replace(/[^a-z0-9\s]/g, '');

    let score = 0;
    if (name === q) score = 100;
    else if (name.startsWith(q) || q.startsWith(name)) score = 90;
    else if (name.includes(q)) score = 80;
    else if (comp.includes(q)) score = 70;
    
    // Phonetic Match
    if (score < 60 && qSoundex === getSoundex(name)) score = 85;

    // N-gram Similarity
    const nGramScore = calculateNGramSimilarity(q, name);
    if (nGramScore > 0.6) score = Math.max(score, nGramScore * 100);

    // Levenshtein distance fallback
    if (score < 60 && q.length >= 5) {
      const dist = levenshtein.get(q, name);
      const tolerance = Math.max(1, Math.floor(q.length / 5));
      if (dist <= tolerance) score = Math.max(score, 80 - dist * 10);
    }

    if (score > 30) {
      candidates.push({ med, score });
    }
  }

  if (!candidates.length) return null;

  const sorted = candidates.sort((a, b) => b.score - a.score);
  const best = sorted[0];

  if (best.score >= 75) {
    return { 
      med: best.med, 
      score: best.score,
      suggestions: sorted.slice(1, 4).map(s => ({ name: s.med.name, score: s.score }))
    };
  }
  
  return {
    med: null,
    score: best.score,
    suggestions: sorted.slice(0, 3).map(s => ({ name: s.med.name, score: s.score }))
  };
}

function calculateNGramSimilarity(s1: string, s2: string, n = 3): number {
  if (s1.length < n || s2.length < n) return 0;
  const getGrams = (s: string) => {
    const grams = new Set();
    for (let i = 0; i <= s.length - n; i++) grams.add(s.substring(i, i + n));
    return grams;
  };
  const grams1 = getGrams(s1);
  const grams2 = getGrams(s2);
  const intersection = new Set([...grams1].filter(x => grams2.has(x)));
  return (2 * intersection.size) / (grams1.size + grams2.size);
}

/**
 * Soundex Phonetic Algorithm (SOTA Tier)
 * Converts a word to a 4-character phonetic code.
 */
function getSoundex(s: string): string {
  const a = s.toUpperCase().split('');
  const f = a.shift();
  let r = '';
  const codes: any = {
    B: 1, F: 1, P: 1, V: 1,
    C: 2, G: 2, J: 2, K: 2, Q: 2, S: 2, X: 2, Z: 2,
    D: 3, T: 3,
    L: 4,
    M: 5, N: 5,
    R: 6
  };
  r = (f || '') + a
    .map(v => codes[v] || '')
    .filter((v, i, b) => (i === 0 ? v !== codes[f || ''] : v !== b[i - 1]))
    .join('');
  return (r + '000').slice(0, 4);
}

// ─── ML Semantic search (fallback) ───────────────────────────────────────────
let extractor: any = null;
async function getExtractor() {
  if (!extractor) {
    logger.info('Initializing local ML model (@xenova/transformers)...');
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return extractor;
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; normA += a[i]**2; normB += b[i]**2; }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── Performance Caching ──────────────────────────────────────────────────────
const SEARCH_CACHE = new Map<string, { result: any; expiry: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Production-grade Semantic search: 
 * Prioritizes Cache -> Supabase pgvector -> Local fallback.
 */
async function semanticSearch(query: string, threshold = 0.5): Promise<any | null> {
  const cacheKey = `search:${query}`;
  const cached = SEARCH_CACHE.get(cacheKey);
  if (cached && cached.expiry > Date.now()) return cached.result;

  try {
    let result = null;

    // 1. Production Tier: Supabase Vector DB (pgvector)
    const vectorMatches = await vectorSearch(query, undefined, 1);
    if (vectorMatches?.[0] && vectorMatches[0].similarity >= threshold) {
      result = JSON.parse(vectorMatches[0].content);
    }

    // 2. Fallback Tier: Local ML (MiniLM) for offline/edge cases
    if (!result) {
      const ext = await getExtractor();
      const outA = await ext(query, { pooling: 'mean', normalize: true });
      const queryVec = Array.from(outA.data) as number[];
      let best: { med: any; score: number } | null = null;

      for (const med of medicinesDb) {
        if (!med._vec) {
          const outB = await ext(`${med.name} ${med.composition} ${(med.treating || []).join(' ')}`, { pooling: 'mean', normalize: true });
          med._vec = Array.from(outB.data) as number[];
        }
        const score = cosineSimilarity(queryVec, med._vec);
        if (!best || score > best.score) best = { med, score };
      }
      if (best && best.score >= threshold) result = best.med;
    }

    if (result) {
      SEARCH_CACHE.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL });
    }
    return result;
  } catch (err) {
    logger.error('Semantic search entirely failed', err);
    return null;
  }
}

// ─── Clean up OCR noise in medicine names ─────────────────────────────────────
export function cleanOcrMedicineName(raw: string): string {
  return raw
    .replace(/\b(\d+)\s*(mg|mcg|ml|iu|gm|g)\b/gi, '') // remove dosage
    .replace(/\b(tablet|cap|capsule|syrup|injection|inj|tab|drop|cream|gel|oint)\b/gi, '')
    .replace(/[^a-zA-Z0-9\s\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Format medicine response ──────────────────────────────────────────────────
function formatMedResponse(med: any, mode: ExplanationMode): string {
  const lines: string[] = [
    `### 💊 ${med.name}`,
    `**Generic Name / Composition:** ${med.composition || 'N/A'}`,
    '',
    `**What it treats:** ${(med.treating || []).join(', ') || 'See prescribing info'}`,
    '',
    `**Uses:** ${med.uses || 'N/A'}`,
    '',
    `**Side Effects:** ${med.side_effects || 'Consult prescribing information.'}`,
    '',
    `**Precautions:** ${med.precautions || 'N/A'}`,
  ];
  if (mode === 'technical' && med.warnings) {
    lines.push('', `**⚠️ Clinical Warnings:** ${med.warnings}`);
  }
  if (med.interactions?.length) {
    lines.push('', `**Known Interactions:** ${med.interactions.map((i: any) => `${i.medicine} (${i.severity})`).join(', ')}`);
  }
  return lines.join('\n') + '\n\n' + DISCLAIMER;
}

// ─── Explain a medicine ────────────────────────────────────────────────────────
export async function explainMedicine(
  medicineName: string,
  _composition: string | undefined,
  mode: ExplanationMode,
  _language: 'en' | 'hi' = 'en'
): Promise<string> {
  const cleaned = cleanOcrMedicineName(medicineName);
  
  const result = fastSearch(cleaned) || fastSearch(medicineName);
  const match = result?.med || await semanticSearch(medicineName);

  if (!match) {
    let msg = `We could not find detailed offline information for **"${medicineName}"**.\n\n`;
    if (result?.suggestions?.length) {
      msg += `**Did you mean?**\n${result.suggestions.map(s => `- ${s.name}`).join('\n')}\n\n`;
    }
    return msg + `This might be a very new, regional, or brand-specific drug. Please consult your pharmacist or doctor for details.\n\n` + DISCLAIMER;
  }
  return formatMedResponse(match, mode);
}

// ─── AI Chat ──────────────────────────────────────────────────────────────────
export async function aiChat(
  userMessage: string,
  _history: Array<{ role: 'user' | 'assistant'; content: string }>,
  patientContext: { activeMedicines?: string[]; allergies?: string[]; conditions?: string[] },
  mode: ExplanationMode,
  _language: 'en' | 'hi' = 'en'
): Promise<{ reply: string; isEmergency: boolean }> {
  if (isEmergencyQuery(userMessage)) {
    return {
      reply: `🚨 **This sounds like a medical emergency.**\nPlease call **112 (India)** or visit the nearest emergency room immediately.\n\n_Do not wait for AI advice in emergencies._`,
      isEmergency: true,
    };
  }

  // 1. Fast medicine lookup
  const searchResult = fastSearch(userMessage);
  const medMatch = searchResult?.med || await semanticSearch(userMessage, 0.4);
  
  if (medMatch) {
    return { reply: formatMedResponse(medMatch, mode), isEmergency: false };
  }

  if (searchResult?.suggestions?.length) {
    return {
      reply: `I couldn't find an exact match for **"${userMessage}"**, but did you mean one of these?\n\n${searchResult.suggestions.map(s => `- **${s.name}**`).join('\n')}\n\n${DISCLAIMER}`,
      isEmergency: false
    };
  }

  // 2. Disease lookup
  const lowerMsg = userMessage.toLowerCase();
  const diseaseMatch = diseasesDb.find((d: any) =>
    lowerMsg.includes(d.name.toLowerCase()) ||
    (d.synonyms || []).some((s: string) => lowerMsg.includes(s.toLowerCase()))
  );
  if (diseaseMatch) {
    return {
      reply: [
        `### 🏥 ${diseaseMatch.name}`,
        '',
        `**What it is:** ${diseaseMatch.explanation}`,
        '',
        `**Biology:** ${diseaseMatch.biology}`,
        '',
        `**Common Medications:** ${(diseaseMatch.common_meds || diseaseMatch.common_medications || []).join(', ')}`,
        '',
        DISCLAIMER,
      ].join('\n'),
      isEmergency: false,
    };
  }

  // 3. Context-aware fallback
  if (patientContext.activeMedicines?.length) {
    return {
      reply: `I found your active medicines: **${patientContext.activeMedicines.join(', ')}**. Ask me about any specific medicine or condition and I'll explain it in detail.\n\n${DISCLAIMER}`,
      isEmergency: false,
    };
  }

  return {
    reply: `I'm your offline medical assistant with **${medicinesDb.length} medicines** in my brain.\n\nYou can ask me:\n- "What is Ecosprin?"\n- "Explain Metformin"\n- "What is Diabetes?"\n- "Side effects of Ibuprofen"\n\n${DISCLAIMER}`,
    isEmergency: false,
  };
}

// ─── Summarise prescription ────────────────────────────────────────────────────
export async function summarisePrescription(
  ocrText: string,
  mode: ExplanationMode = 'simple',
  seedCandidates: string[] = []
): Promise<{ 
  summary: string; 
  medicines: Array<{ 
    name: string; 
    score: number; 
    composition?: string; 
    suggestions?: Array<{ name: string; score: number }> 
  }>;
  review_required?: string[];
}> {
  if (!ocrText || ocrText.trim().length < 5) {
    return {
      summary: 'The scan was unable to extract readable text. Please try again with a clearer, well-lit image.\n\n' + DISCLAIMER,
      medicines: [],
      review_required: ['OCR text unreadable'],
    };
  }

  const words = ocrText
    .split(/\s+/)
    .map((w) => cleanOcrMedicineName(w))
    .filter((w) => w.length >= 3);

  const candidates = new Set<string>();
  const foundMeds: Map<string, any> = new Map();
  const allSuggestions: Map<string, number> = new Map();
  const reviewRequired = new Set<string>();

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word) candidates.add(word);

    if (i < words.length - 1) {
      const bigram = cleanOcrMedicineName(`${words[i]} ${words[i + 1]}`);
      if (bigram.length >= 4) candidates.add(bigram);
    }

    if (i < words.length - 2) {
      const trigram = cleanOcrMedicineName(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      if (trigram.length >= 6) candidates.add(trigram);
    }
  }

  for (const seed of seedCandidates) {
    const cleanSeed = cleanOcrMedicineName(seed);
    if (cleanSeed.length >= 3) candidates.add(cleanSeed);
  }

  const ingestResult = (result: SearchResult | null) => {
    if (!result) return;

    if (result.med) {
      const existing = foundMeds.get(result.med.name);
      if (!existing || existing.score < result.score) {
        foundMeds.set(result.med.name, { ...result.med, score: result.score, suggestions: result.suggestions });
      }
      if (result.score < 85) reviewRequired.add(result.med.name);
      return;
    }

    if (!result.suggestions) return;

    result.suggestions.forEach((s) => {
      const current = allSuggestions.get(s.name) || 0;
      if (s.score > current) allSuggestions.set(s.name, s.score);
      if (s.score >= 70) reviewRequired.add(s.name);
    });
  };

  for (const candidate of candidates) {
    ingestResult(fastSearch(candidate));
  }

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const nextWord = i < words.length - 1 ? words[i + 1] : '';
    const bigram = nextWord ? cleanOcrMedicineName(`${word} ${nextWord}`) : '';
    const result = (bigram && fastSearch(bigram)) || fastSearch(word);
    ingestResult(result);
  }

  const medicines = Array.from(foundMeds.values());
  let summary = '### Prescription Analysis\n\n';

  if (medicines.length) {
    summary += '**Medicines Identified:**\n';
    for (const med of medicines) {
      summary += `\n#### ${med.name} *(${med.composition})* - **${med.score}% Match**\n`;
      summary += `- **Used for:** ${med.uses?.slice(0, 150) || 'N/A'}\n`;
      summary += `- **Side effects:** ${med.side_effects?.slice(0, 100) || 'N/A'}\n`;
      if (mode === 'technical' && med.warnings) {
        summary += `- **Warning:** ${med.warnings?.slice(0, 100)}\n`;
      }
      if (med.score < 85) {
        summary += '- **Review:** Medium confidence extraction. Verify this medicine manually.\n';
      }
    }
  }

  const finalSuggestions = Array.from(allSuggestions.entries())
    .filter(([name]) => !foundMeds.has(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (finalSuggestions.length > 0) {
    summary += '\n---\n**Did you mean? (Uncertain Matches)**\n';
    summary += finalSuggestions.map(([name, score]) => `- ${name} (${score}% confidence)`).join('\n') + '\n';
  }

  medicines.filter((med) => med.score < 85).forEach((med) => reviewRequired.add(med.name));

  if (reviewRequired.size > 0) {
    summary += '\n---\n**Manual review recommended for:**\n';
    summary += Array.from(reviewRequired).slice(0, 6).map((name) => `- ${name}`).join('\n') + '\n';
  }

  if (!medicines.length && !finalSuggestions.length) {
    summary += 'No medicines from our database were definitively identified in this scan.\n\n';
    summary += `**Raw Text Extracted:**\n\`\`\`\n${ocrText.substring(0, 300)}\n\`\`\`\n`;
    summary += '\n_Try a higher resolution, well-lit photo for better results._\n';
  }

  return {
    summary: summary + '\n' + DISCLAIMER,
    medicines: medicines.map((m) => ({
      name: m.name,
      score: m.score,
      composition: m.composition,
      suggestions: m.suggestions,
    })),
    review_required: Array.from(reviewRequired),
  };
}
export async function generateReminderSchedule(
  medicines: Array<{ name: string; frequency?: string }>
): Promise<Array<{ medicine: string; times: string[]; note: string }>> {
  return medicines.map((m) => {
    const freq = (m.frequency || '').toLowerCase();
    let times = ['08:00', '20:00']; // default BD
    if (freq.includes('once') || freq.includes('od') || freq.includes('1 time')) times = ['08:00'];
    else if (freq.includes('three') || freq.includes('tds') || freq.includes('3 time')) times = ['08:00', '14:00', '20:00'];
    else if (freq.includes('four') || freq.includes('qid') || freq.includes('4 time')) times = ['08:00', '12:00', '16:00', '20:00'];
    return { medicine: m.name, times, note: 'As prescribed' };
  });
}

