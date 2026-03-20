/**
 * Upgraded OCR Service
 * Uses Tesseract.js with image pre-processing via sharp for much better accuracy
 * Plus Levenshtein-based fuzzy correction of common OCR mistakes
 */

import Tesseract from 'tesseract.js';
import { logger } from '../utils/logger';
import { pipeline } from '@xenova/transformers';
import path from 'path';
import fs from 'fs';

export interface OCRResult {
  raw_text: string;
  medicines: ExtractedMedicine[];
  doctor_name?: string;
  date?: string;
  confidence: number;
}

export interface ExtractedMedicine {
  name: string;
  frequency?: string;
  composition?: string;
  raw_line: string;
}

// Common medicine frequency patterns
const FREQUENCY_PATTERNS = [
  /\b(\d+\s*times?\s*(?:a\s*)?day)\b/i,
  /\b(once|twice|thrice|three times)\s*(?:a\s*)?(?:day|daily)\b/i,
  /\b(OD|BD|TDS|QID|SOS|PRN|HS|AC|PC)\b/g,
  /\b(\d+[-–]\d+[-–]\d+)\b/g,
];

const MEDICINE_INDICATORS = [
  /\b(tab|tablet|cap|capsule|syrup|inj|injection|drops?|cream|gel|ointment|susp|suspension)\b/i,
  /\b(mg|mcg|ml|g|iu)\b/i,
];

// Common OCR character substitution errors in medicine names
const OCR_CORRECTIONS: [RegExp, string][] = [
  [/0(?=[a-z])/gi, 'o'],   // 0 mistaken for o
  [/1(?=[a-z])/gi, 'l'],   // 1 mistaken for l
  [/\bI(?=[a-z])/g, 'l'],  // I mistaken for l  
  [/\|/g, 'l'],             // | mistaken for l
  [/\brn\b/g, 'm'],         // rn -> m (common OCR error)
];

function applyOcrCorrections(text: string): string {
  let result = text;
  for (const [pattern, replacement] of OCR_CORRECTIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// ─── TrOCR Configuration ──────────────────────────────────────────────────────
let trocrPipeline: any = null;

async function getTrOCR() {
  if (!trocrPipeline) {
    logger.info('Initializing TrOCR transformer model...');
    trocrPipeline = await pipeline('image-to-text', 'Xenova/trocr-small-printed');
  }
  return trocrPipeline;
}

// Preprocesses image buffer using sharp for better OCR accuracy
async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const sharp = await import('sharp').then(m => m.default || m);
    return await sharp(imageBuffer)
      .grayscale()            // Convert to black & white
      .normalize()            // Maximize contrast
      .sharpen({ sigma: 1.5 }) // Sharpen edges
      .modulate({ brightness: 1.1 }) // Slight brightness boost
      .png()                  // Output as PNG (Tesseract works best with PNG)
      .toBuffer();
  } catch (sharpErr) {
    logger.warn('sharp preprocessing unavailable, using raw image:', sharpErr);
    return imageBuffer; // Fall back to original if sharp not working
  }
}

export async function extractTextFromImage(imageBuffer: Buffer): Promise<OCRResult> {
  try {
    logger.info('Preprocessing image for OCR...');
    const processedBuffer = await preprocessImage(imageBuffer);

    logger.info('Starting OCR Ensemble (Tesseract + TrOCR)...');
    
    // Run Ensemble in parallel
    const [tessResult, trocrText] = await Promise.all([
      // A: Tesseract.js (Fast, multi-line)
      Tesseract.recognize(processedBuffer, 'eng', { logger: () => {} }),
      
      // B: TrOCR (Transformer-based, high accuracy for printed text)
      (async () => {
        try {
          const model = await getTrOCR();
          const tmpPath = path.join(__dirname, `../../tmp_ocr_${Date.now()}.png`);
          fs.writeFileSync(tmpPath, processedBuffer);
          const out = await model(tmpPath);
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
          return out?.[0]?.generated_text || '';
        } catch (e) {
          logger.warn('TrOCR failed, continuing with Tesseract only', e);
          return '';
        }
      })()
    ]);

    let raw_text = applyOcrCorrections(tessResult.data.text);
    const confidence = tessResult.data.confidence;

    // Intelligence: If TrOCR found text that Tesseract missed or if confidence is low, 
    // we append it or use it to verify drug names.
    if (trocrText && trocrText.length > 5) {
      if (confidence < 70) {
        logger.info('Low Tesseract confidence, prioritizing TrOCR results');
        raw_text = applyOcrCorrections(trocrText) + '\n' + raw_text;
      } else {
        raw_text += '\n--- Ensemble Verification ---\n' + applyOcrCorrections(trocrText);
      }
    }

    const medicines = parseMedicinesFromText(raw_text);
    const doctor_name = extractDoctorName(raw_text);
    const date = extractDate(raw_text);

    logger.info(`OCR done — Confidence: ${confidence.toFixed(0)}%, Medicines found: ${medicines.length}`);
    return { raw_text, medicines, doctor_name, date, confidence };
  } catch (error) {
    logger.error('OCR extraction failed', error);
    throw new Error('Failed to extract text from image');
  }
}

function parseMedicinesFromText(text: string): ExtractedMedicine[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const medicines: ExtractedMedicine[] = [];

  for (const line of lines) {
    const isMedicineLine = MEDICINE_INDICATORS.some((p) => p.test(line));
    if (!isMedicineLine && line.length < 5) continue;

    // Skip obvious non-medicine lines
    if (/^(dr\.|doctor|patient|date|rx|address|phone|name:|clinic|hospital|sig:|rp:|dispensed)/i.test(line)) continue;

    const medicine: ExtractedMedicine = { name: '', raw_line: line };

    // Extract frequency
    for (const pattern of FREQUENCY_PATTERNS) {
      const match = line.match(pattern);
      if (match) { medicine.frequency = match[0]; break; }
    }

    // Extract medicine name: first meaningful token before dosage/frequency info
    const nameMatch = line.match(/^([A-Za-z][A-Za-z\s\-\+]+?)(?:\s+\d|\s+tab|\s+cap|\s+mg|\s+ml|$)/i);
    if (nameMatch) {
      medicine.name = nameMatch[1].trim();
    } else {
      medicine.name = line.split(/\s+/).slice(0, 3).join(' ');
    }

    if (medicine.name.length > 2 && medicine.name.length < 60) {
      medicines.push(medicine);
    }
  }

  return medicines;
}

function extractDoctorName(text: string): string | undefined {
  const match = text.match(/(?:Dr\.|Doctor|Physician)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
  return match?.[1];
}

function extractDate(text: string): string | undefined {
  const match = text.match(
    /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/
  );
  return match?.[0];
}
