import Tesseract from 'tesseract.js';
import { logger } from '../utils/logger';
import { pipeline } from '@xenova/transformers';
import path from 'path';
import fs from 'fs';
import levenshtein from 'fast-levenshtein';
import medicinesDb from '../data/medicines_db.json';

const OCR_WARMUP_ENABLED = (process.env.OCR_WARMUP_ENABLED || 'true').toLowerCase() !== 'false';
const TROCR_ENABLED = (process.env.OCR_ENABLE_TROCR || 'true').toLowerCase() !== 'false';

export interface OCRResult {
  raw_text: string;
  medicines: ExtractedMedicine[];
  doctor_name?: string;
  date?: string;
  confidence: number;
  review_required?: string[];
  engine_breakdown?: {
    tesseract_confidence: number;
    trocr_used: boolean;
    consensus_score: number;
    pdf_converted?: boolean;
  };
}

export interface OCRExtractOptions {
  mimeType?: string;
}

export interface ExtractedMedicine {
  name: string;
  frequency?: string;
  composition?: string;
  raw_line: string;
  confidence?: number;
  requires_review?: boolean;
  candidates?: string[];
}

interface EngineOutput {
  text: string;
  lines: string[];
  confidence: number;
}

interface MedicineLookupResult {
  name: string;
  score: number;
  suggestions: string[];
}

interface MedicineIndexEntry {
  name: string;
  normalized: string;
}

function getOcrErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage) return maybeMessage;
  }
  return 'Unknown OCR error';
}

const FREQUENCY_PATTERNS = [
  /\b(\d+\s*times?\s*(?:a\s*)?day)\b/i,
  /\b(once|twice|thrice|three times)\s*(?:a\s*)?(?:day|daily)\b/i,
  /\b(OD|BD|TDS|QID|SOS|PRN|HS|AC|PC)\b/i,
  /\b(\d+\s*[-\/]\s*\d+\s*[-\/]\s*\d+)\b/i,
];

const MEDICINE_INDICATORS = [
  /\b(tab|tablet|cap|capsule|syrup|inj|injection|drops?|cream|gel|ointment|susp|suspension)\b/i,
  /\b(mg|mcg|ml|g|iu)\b/i,
];

const NON_MEDICINE_LINE_PATTERN =
  /^(dr\.|doctor|patient|date|rx|address|phone|name:|clinic|hospital|sig:|rp:|dispensed|diagnosis|advice)\b/i;

const OCR_CORRECTIONS: [RegExp, string][] = [
  [/0(?=[a-z])/gi, 'o'],
  [/1(?=[a-z])/gi, 'l'],
  [/\bI(?=[a-z])/g, 'l'],
  [/\|/g, 'l'],
  [/\brn\b/g, 'm'],
];

const NOISE_WORDS = [
  'MFG',
  'EXP',
  'BATCH',
  'LOT',
  'LTD',
  'PHARMA',
  'TABLETS',
  'CAPSULES',
  'PVT',
  'LIMITED',
  'INC',
  'CO',
  'ADDRESS',
  'PHONE',
  'DATE',
  'PRICE',
  'MRP',
  'INCL',
  'TAXES',
  'FOR',
  'USE',
  'STORE',
  'COOL',
  'PLACE',
  'KEEP',
  'OUT',
  'REACH',
  'CHILDREN',
  'DRY',
  'PROTECT',
  'LIGHT',
  'STRIP',
  'PACK',
];

const medicineList = (((medicinesDb as { medicines?: Array<{ name?: string }> }).medicines) || [])
  .map((m) => m.name?.trim())
  .filter((name): name is string => Boolean(name));

const medicineIndex = new Map<string, string>();
const medicineEntries: MedicineIndexEntry[] = [];
for (const medicine of medicineList) {
  const normalized = normalizeCompact(medicine);
  if (!normalized) continue;
  if (!medicineIndex.has(normalized)) medicineIndex.set(normalized, medicine);
  medicineEntries.push({ name: medicine, normalized });
}

const tokenLookupCache = new Map<string, number>();

let trocrPipeline: any = null;

async function getTrOCR() {
  if (!TROCR_ENABLED) return null;
  if (!trocrPipeline) {
    logger.info('Initializing TrOCR transformer model...');
    trocrPipeline = await pipeline('image-to-text', 'Xenova/trocr-small-printed');
  }
  return trocrPipeline;
}

function isPdfMimeType(mimeType?: string): boolean {
  return (mimeType || '').toLowerCase().includes('pdf');
}

function isPdfBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;
  return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF
}

async function convertPdfToImageBuffer(pdfBuffer: Buffer): Promise<Buffer> {
  try {
    const sharp = await import('sharp').then((m) => m.default || m);
    return await sharp(pdfBuffer, { density: 240, page: 0 })
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer();
  } catch (error) {
    logger.error('PDF conversion failed for OCR', error);
    throw new Error('PDF conversion failed for OCR');
  }
}

async function normalizeInputBuffer(imageBuffer: Buffer, options: OCRExtractOptions): Promise<{ buffer: Buffer; pdfConverted: boolean }> {
  const pdfInput = isPdfMimeType(options.mimeType) || isPdfBuffer(imageBuffer);
  if (!pdfInput) return { buffer: imageBuffer, pdfConverted: false };

  const converted = await convertPdfToImageBuffer(imageBuffer);
  return { buffer: converted, pdfConverted: true };
}

function normalizeCompact(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function applyOcrCorrections(text: string): string {
  let result = text;
  for (const [pattern, replacement] of OCR_CORRECTIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function looksLikeNoiseToken(token: string): boolean {
  const clean = token.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return true;
  if (NOISE_WORDS.includes(clean)) return true;
  if (/^[0-9]{4,}$/.test(clean)) return true;
  if (/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{8,}$/.test(clean)) return true;
  if (/^[A-Z]{10,}$/.test(clean) && !/[AEIOU]/.test(clean)) return true;
  return false;
}

function fuzzyLookupMedicine(input: string): MedicineLookupResult | null {
  const normalized = normalizeCompact(input);
  if (!normalized || normalized.length < 3) return null;

  const exact = medicineIndex.get(normalized);
  if (exact) return { name: exact, score: 100, suggestions: [] };

  const ranked: Array<{ name: string; score: number }> = [];
  for (const entry of medicineEntries) {
    const maxLen = Math.max(normalized.length, entry.normalized.length);
    if (!maxLen) continue;
    if (Math.abs(entry.normalized.length - normalized.length) > 10) continue;

    const distance = levenshtein.get(normalized, entry.normalized);
    const score = Math.round((1 - distance / maxLen) * 100);
    if (score >= 62) ranked.push({ name: entry.name, score });
  }

  ranked.sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;

  return {
    name: ranked[0].name,
    score: ranked[0].score,
    suggestions: ranked.slice(1, 4).map((r) => r.name),
  };
}

function getTokenMedicineBoost(token: string): number {
  const key = normalizeCompact(token);
  if (!key || key.length < 4) return 0;
  const cached = tokenLookupCache.get(key);
  if (cached !== undefined) return cached;

  const lookup = fuzzyLookupMedicine(token);
  const boost = !lookup ? 0 : lookup.score >= 90 ? 0.35 : lookup.score >= 80 ? 0.2 : 0.1;
  tokenLookupCache.set(key, boost);
  return boost;
}

function scoreToken(token: string, baseWeight: number): number {
  let score = baseWeight;
  if (!token) return 0;
  if (looksLikeNoiseToken(token)) score -= 0.45;
  if (/[a-z]/i.test(token)) score += 0.08;
  if (/^\d+(\.\d+)?(mg|mcg|ml|g|iu)$/i.test(token)) score += 0.08;
  score += getTokenMedicineBoost(token);
  return score;
}

function tokenize(line: string): string[] {
  return line
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function mergeLineTokens(lineA: string, lineB: string, weightA: number, weightB: number): { line: string; agreement: number } {
  if (!lineA.trim() && !lineB.trim()) return { line: '', agreement: 1 };
  if (!lineA.trim()) return { line: lineB, agreement: 0 };
  if (!lineB.trim()) return { line: lineA, agreement: 0 };

  const tokensA = tokenize(lineA);
  const tokensB = tokenize(lineB);
  const maxLength = Math.max(tokensA.length, tokensB.length);
  const merged: string[] = [];

  let agreed = 0;
  let compared = 0;

  for (let idx = 0; idx < maxLength; idx++) {
    const tokenA = tokensA[idx] || '';
    const tokenB = tokensB[idx] || '';
    if (!tokenA && !tokenB) continue;

    if (!tokenA || !tokenB) {
      merged.push(tokenA || tokenB);
      continue;
    }

    compared += 1;
    if (normalizeCompact(tokenA) === normalizeCompact(tokenB)) {
      agreed += 1;
      merged.push(tokenA.length >= tokenB.length ? tokenA : tokenB);
      continue;
    }

    const scoreA = scoreToken(tokenA, weightA);
    const scoreB = scoreToken(tokenB, weightB);
    merged.push(scoreA >= scoreB ? tokenA : tokenB);
  }

  return {
    line: merged.join(' ').trim(),
    agreement: compared ? agreed / compared : 1,
  };
}

function cleanOcrText(text: string): string {
  return applyOcrCorrections(text)
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .map((line) => {
      const filteredTokens = tokenize(line).filter((token) => !looksLikeNoiseToken(token) && token.length > 1);
      return filteredTokens.join(' ').trim();
    })
    .filter((line) => /[a-z]/i.test(line))
    .filter((line) => line.length >= 3)
    .join('\n');
}

function splitLines(text: string): string[] {
  const cleaned = cleanOcrText(text);
  if (!cleaned) return [];
  return cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function fuseEngineOutputs(tesseract: EngineOutput, trocr: EngineOutput): { text: string; consensusScore: number } {
  if (!trocr.text.trim()) {
    return {
      text: cleanOcrText(tesseract.text),
      consensusScore: 1,
    };
  }

  const tWeight = Math.min(0.95, Math.max(0.45, tesseract.confidence / 100));
  const trWeight = tesseract.confidence < 60 ? 0.78 : 0.68;
  const maxLines = Math.max(tesseract.lines.length, trocr.lines.length);
  const mergedLines: string[] = [];

  let agreementAccumulator = 0;
  let agreementCount = 0;

  for (let idx = 0; idx < maxLines; idx++) {
    const lineA = tesseract.lines[idx] || '';
    const lineB = trocr.lines[idx] || '';
    const merged = mergeLineTokens(lineA, lineB, tWeight, trWeight);
    if (merged.line) mergedLines.push(merged.line);
    agreementAccumulator += merged.agreement;
    agreementCount += 1;
  }

  const consensusScore = agreementCount ? agreementAccumulator / agreementCount : 0;
  const mergedText = cleanOcrText(mergedLines.join('\n'));
  return { text: mergedText, consensusScore };
}

async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const sharp = await import('sharp').then((m) => m.default || m);
    return await sharp(imageBuffer)
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1.5 })
      .modulate({ brightness: 1.1 })
      .png()
      .toBuffer();
  } catch (sharpErr) {
    logger.warn('sharp preprocessing unavailable, using raw image:', sharpErr);
    return imageBuffer;
  }
}

async function runTesseract(imageBuffer: Buffer): Promise<EngineOutput> {
  try {
    const tessResult = await Tesseract.recognize(imageBuffer, 'eng', { logger: () => {} });
    const text = tessResult.data.text || '';
    const confidence = Number(tessResult.data.confidence || 0);
    return {
      text,
      lines: splitLines(text),
      confidence,
    };
  } catch (error) {
    logger.warn('Tesseract failed, continuing with available OCR engines', error);
    return {
      text: '',
      lines: [],
      confidence: 0,
    };
  }
}

async function runTrOCR(imageBuffer: Buffer): Promise<EngineOutput> {
  if (!TROCR_ENABLED) {
    return {
      text: '',
      lines: [],
      confidence: 0,
    };
  }

  let tmpPath = '';
  try {
    const model = await getTrOCR();
    if (!model) {
      return {
        text: '',
        lines: [],
        confidence: 0,
      };
    }
    tmpPath = path.join(__dirname, `../../tmp_ocr_${Date.now()}_${Math.random().toString(16).slice(2)}.png`);
    fs.writeFileSync(tmpPath, imageBuffer);
    const output = await model(tmpPath);
    const text = output?.[0]?.generated_text || '';
    return {
      text,
      lines: splitLines(text),
      confidence: 70,
    };
  } catch (error) {
    logger.warn('TrOCR failed, continuing with Tesseract only', error);
    return {
      text: '',
      lines: [],
      confidence: 0,
    };
  } finally {
    if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

function extractMedicineCandidate(line: string): string {
  const nameMatch = line.match(
    /^([A-Za-z][A-Za-z0-9\s\-\+]{1,60}?)(?=\s+\d|\s+(tab|tablet|cap|capsule|syrup|mg|mcg|ml|g|iu|od|bd|tds|qid|sos|prn)\b|$)/i
  );
  if (nameMatch?.[1]) return nameMatch[1].trim();
  return line
    .split(/\s+/)
    .slice(0, 3)
    .join(' ')
    .trim();
}

function parseMedicinesFromText(text: string): ExtractedMedicine[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const medicinesByName = new Map<string, ExtractedMedicine>();

  for (const line of lines) {
    if (NON_MEDICINE_LINE_PATTERN.test(line)) continue;

    const hasIndicator = MEDICINE_INDICATORS.some((pattern) => pattern.test(line));
    const rawCandidate = extractMedicineCandidate(line);
    if (!rawCandidate || rawCandidate.length < 3) continue;

    const lookup = fuzzyLookupMedicine(rawCandidate);
    if (!hasIndicator && (!lookup || lookup.score < 74)) continue;

    const frequency = FREQUENCY_PATTERNS.map((pattern) => line.match(pattern)?.[0]).find(Boolean);
    const resolvedName = lookup && lookup.score >= 80 ? lookup.name : rawCandidate;
    const confidence = lookup ? Math.max(55, lookup.score) : hasIndicator ? 60 : 50;
    const requiresReview = confidence < 78;
    const key = normalizeCompact(resolvedName);

    const medicine: ExtractedMedicine = {
      name: resolvedName,
      raw_line: line,
      frequency,
      confidence,
      requires_review: requiresReview,
      candidates: lookup?.suggestions?.length ? lookup.suggestions : undefined,
    };

    const existing = medicinesByName.get(key);
    if (!existing || (existing.confidence || 0) < confidence) {
      medicinesByName.set(key, medicine);
    }
  }

  return Array.from(medicinesByName.values()).sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
}

function extractDoctorName(text: string): string | undefined {
  const match = text.match(/(?:Dr\.|Doctor|Physician)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
  return match?.[1];
}

function extractDate(text: string): string | undefined {
  const match = text.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/);
  return match?.[0];
}

export async function extractTextFromImage(imageBuffer: Buffer, options: OCRExtractOptions = {}): Promise<OCRResult> {
  try {
    const normalizedInput = await normalizeInputBuffer(imageBuffer, options);

    logger.info('Preprocessing image for OCR...');
    const processedBuffer = await preprocessImage(normalizedInput.buffer);

    logger.info('Starting OCR ensemble (Tesseract + TrOCR)...');
    let [tesseractOutput, trocrOutput] = await Promise.all([runTesseract(processedBuffer), runTrOCR(processedBuffer)]);

    if (!tesseractOutput.text.trim() && !trocrOutput.text.trim() && !processedBuffer.equals(normalizedInput.buffer)) {
      logger.warn('OCR was empty after preprocessing. Retrying with normalized input buffer...');
      [tesseractOutput, trocrOutput] = await Promise.all([
        runTesseract(normalizedInput.buffer),
        runTrOCR(normalizedInput.buffer),
      ]);
    }

    if (!tesseractOutput.text.trim() && !trocrOutput.text.trim()) {
      throw new Error('OCR engines unavailable or failed to read image');
    }

    const fusion = fuseEngineOutputs(tesseractOutput, trocrOutput);
    const raw_text = fusion.text;
    const medicines = parseMedicinesFromText(raw_text);
    const doctor_name = extractDoctorName(raw_text);
    const date = extractDate(raw_text);
    const review_required = medicines.filter((med) => med.requires_review).map((med) => med.name);

    return {
      raw_text,
      medicines,
      doctor_name,
      date,
      confidence: tesseractOutput.confidence,
      review_required,
      engine_breakdown: {
        tesseract_confidence: tesseractOutput.confidence,
        trocr_used: Boolean(trocrOutput.text.trim()),
        consensus_score: Number(fusion.consensusScore.toFixed(2)),
        pdf_converted: normalizedInput.pdfConverted,
      },
    };
  } catch (error) {
    const message = getOcrErrorMessage(error);
    logger.error('OCR extraction failed', error);

    if (message.includes('PDF conversion failed for OCR')) {
      throw new Error('PDF conversion failed for OCR');
    }

    if (message.includes('OCR engines unavailable')) {
      throw new Error('OCR engines unavailable or failed to read image');
    }

    throw new Error(`Failed to extract text from image: ${message}`);
  }
}

export async function warmupOCR(): Promise<void> {
  if (!OCR_WARMUP_ENABLED) {
    logger.info('OCR warm-up skipped (OCR_WARMUP_ENABLED=false).');
    return;
  }

  try {
    logger.info('Starting OCR warm-up...');

    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAn8B9m4fNQAAAABJRU5ErkJggg==',
      'base64'
    );

    await runTesseract(tinyPng);
    if (TROCR_ENABLED) {
      await getTrOCR();
    }

    logger.info('OCR warm-up complete.');
  } catch (error) {
    logger.warn('OCR warm-up failed (non-fatal)', error);
  }
}
