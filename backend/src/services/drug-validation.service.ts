import axios from 'axios';
import levenshtein from 'fast-levenshtein';
import medicinesDb from '../data/medicines_db.json';
import { logger } from '../utils/logger';

type ValidationSource = 'local' | 'rxnorm' | 'openfda' | 'unverified';

export interface DrugValidationResult {
  original: string;
  canonical: string;
  source: ValidationSource;
  confidence: number;
  suggestions: string[];
  requires_review: boolean;
}

interface LocalDrugEntry {
  canonical: string;
  normalized: string;
}

const ONLINE_VALIDATION_ENABLED = (process.env.ENABLE_ONLINE_DRUG_VALIDATION || 'false').toLowerCase() === 'true';

const localDrugNames = (((medicinesDb as { medicines?: Array<{ name?: string }> }).medicines) || [])
  .map((med) => med.name?.trim())
  .filter((name): name is string => Boolean(name));

const localDrugEntries: LocalDrugEntry[] = localDrugNames.map((canonical) => ({
  canonical,
  normalized: normalize(canonical),
}));

const localExactMap = new Map(localDrugEntries.map((entry) => [entry.normalized, entry.canonical]));

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function localMatch(name: string): { canonical: string; confidence: number; suggestions: string[] } | null {
  const key = normalize(name);
  if (!key || key.length < 3) return null;

  const exact = localExactMap.get(key);
  if (exact) {
    return { canonical: exact, confidence: 100, suggestions: [] };
  }

  const ranked: Array<{ canonical: string; score: number }> = [];
  for (const entry of localDrugEntries) {
    const maxLen = Math.max(key.length, entry.normalized.length);
    if (!maxLen) continue;
    if (Math.abs(entry.normalized.length - key.length) > 12) continue;

    const distance = levenshtein.get(key, entry.normalized);
    const score = Math.round((1 - distance / maxLen) * 100);
    if (score >= 62) ranked.push({ canonical: entry.canonical, score });
  }

  ranked.sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;

  return {
    canonical: ranked[0].canonical,
    confidence: ranked[0].score,
    suggestions: ranked.slice(1, 4).map((item) => item.canonical),
  };
}

async function lookupRxNorm(name: string): Promise<string | null> {
  try {
    const { data } = await axios.get('https://rxnav.nlm.nih.gov/REST/drugs.json', {
      params: { name },
      timeout: 3000,
    });

    const groups = data?.drugGroup?.conceptGroup;
    if (!Array.isArray(groups)) return null;

    for (const group of groups) {
      const properties = group?.conceptProperties;
      if (Array.isArray(properties) && properties.length) {
        const candidate = properties[0]?.name;
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
      }
    }
  } catch (error) {
    logger.debug(`RxNorm validation skipped for "${name}"`, error);
  }
  return null;
}

async function lookupOpenFDA(name: string): Promise<string | null> {
  try {
    const escaped = name.replace(/"/g, '\\"');
    const search = `openfda.generic_name:"${escaped}" + openfda.brand_name:"${escaped}"`;
    const { data } = await axios.get('https://api.fda.gov/drug/label.json', {
      params: { search, limit: 1 },
      timeout: 3000,
    });

    const openfda = data?.results?.[0]?.openfda;
    const generic = openfda?.generic_name?.[0];
    const brand = openfda?.brand_name?.[0];
    const candidate = generic || brand;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  } catch (error) {
    logger.debug(`OpenFDA validation skipped for "${name}"`, error);
  }
  return null;
}

export async function validateDrugName(name: string): Promise<DrugValidationResult> {
  const original = (name || '').trim();
  if (!original) {
    return {
      original: name,
      canonical: name,
      source: 'unverified',
      confidence: 0,
      suggestions: [],
      requires_review: true,
    };
  }

  const local = localMatch(original);
  if (local && local.confidence >= 92) {
    return {
      original,
      canonical: local.canonical,
      source: 'local',
      confidence: local.confidence,
      suggestions: local.suggestions,
      requires_review: false,
    };
  }

  if (ONLINE_VALIDATION_ENABLED) {
    const rxnorm = await lookupRxNorm(original);
    if (rxnorm) {
      return {
        original,
        canonical: rxnorm,
        source: 'rxnorm',
        confidence: 96,
        suggestions: local?.suggestions || [],
        requires_review: false,
      };
    }

    const openfda = await lookupOpenFDA(original);
    if (openfda) {
      return {
        original,
        canonical: openfda,
        source: 'openfda',
        confidence: 92,
        suggestions: local?.suggestions || [],
        requires_review: false,
      };
    }
  }

  if (local) {
    return {
      original,
      canonical: local.canonical,
      source: 'local',
      confidence: local.confidence,
      suggestions: local.suggestions,
      requires_review: local.confidence < 86,
    };
  }

  return {
    original,
    canonical: original,
    source: 'unverified',
    confidence: 0,
    suggestions: [],
    requires_review: true,
  };
}

export async function validateDrugNames(names: string[]): Promise<DrugValidationResult[]> {
  const firstByKey = new Map<string, string>();
  for (const rawName of names) {
    const key = normalize(rawName || '');
    if (!key) continue;
    if (!firstByKey.has(key)) firstByKey.set(key, rawName);
  }

  const validatedByKey = new Map<string, DrugValidationResult>();
  await Promise.all(
    Array.from(firstByKey.entries()).map(async ([key, original]) => {
      const result = await validateDrugName(original);
      validatedByKey.set(key, result);
    })
  );

  return names.map((name) => {
    const key = normalize(name || '');
    const matched = validatedByKey.get(key);
    if (!matched) {
      return {
        original: name,
        canonical: name,
        source: 'unverified' as ValidationSource,
        confidence: 0,
        suggestions: [],
        requires_review: true,
      };
    }
    return { ...matched, original: name };
  });
}
