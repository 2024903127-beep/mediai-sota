import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

export type Severity = 'low' | 'moderate' | 'high' | 'critical';

export interface InteractionResult {
  medicine_a: string;
  medicine_b: string;
  severity: Severity;
  description: string;
  source: 'AI' | 'OpenFDA';
}

export interface AllergyWarning {
  medicine: string;
  allergen: string;
  severity: Severity;
  description: string;
}

export interface RiskReport {
  interactions: InteractionResult[];
  allergy_warnings: AllergyWarning[];
  duplicate_alerts: string[];
  overall_risk: Severity;
}

// ─── OpenFDA drug interaction check ───────────────────────────────────────────
async function checkOpenFDA(medicineName: string): Promise<string[]> {
  try {
    const url = `https://api.fda.gov/drug/label.json?search=drug_interactions:"${encodeURIComponent(medicineName)}"&limit=1`;
    const { data } = await axios.get(url, { timeout: 5000 });
    return data.results?.[0]?.drug_interactions || [];
  } catch {
    return [];
  }
}

// ─── Local Database Loading for Risks ─────────────────────────────────────────
let medicinesDb: any[] = [];
try {
  const dbPath = path.resolve(__dirname, '../data/medicines_db.json');
  medicinesDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8')).medicines || [];
} catch (err) {
  logger.error('Could not load medicines_db.json in risk.service', err);
}

// ─── Local interaction check ──────────────────────────────────────────────────
async function checkInteractionsLocally(medicines: string[]): Promise<InteractionResult[]> {
  if (medicines.length < 2) return [];
  const results: InteractionResult[] = [];
  
  // Basic rule-based check from our local DB
  for (let i = 0; i < medicines.length; i++) {
    for (let j = i + 1; j < medicines.length; j++) {
      const medA = medicines[i].toLowerCase();
      const medB = medicines[j].toLowerCase();
      
      const dbEntryA = medicinesDb.find(m => m.name.toLowerCase() === medA);
      if (dbEntryA?.interactions) {
        const conflict = dbEntryA.interactions.find((int: any) => int.medicine.toLowerCase() === medB);
        if (conflict) {
          results.push({
            medicine_a: medicines[i],
            medicine_b: medicines[j],
            severity: conflict.severity,
            description: conflict.description,
            source: 'AI'
          });
        }
      }
    }
  }
  return results;
}

// ─── Local Allergy check ───────────────────────────────────────────────────────
async function checkAllergiesLocally(
  medicines: string[],
  knownAllergies: string[]
): Promise<AllergyWarning[]> {
  if (!knownAllergies.length) return [];
  const results: AllergyWarning[] = [];

  for (const medName of medicines) {
    const dbEntry = medicinesDb.find(m => m.name.toLowerCase() === medName.toLowerCase());
    if (dbEntry?.composition) {
      for (const allergy of knownAllergies) {
        if (dbEntry.composition.toLowerCase().includes(allergy.toLowerCase())) {
          results.push({
            medicine: medName,
            allergen: allergy,
            severity: 'high',
            description: `This medicine contains ${allergy}, which you are allergic to.`
          });
        }
      }
    }
  }
  return results;
}

// AI logic replaced by checkAllergiesLocally above

// ─── Duplicate detection ───────────────────────────────────────────────────────
function detectDuplicates(medicines: string[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const med of medicines) {
    const key = med.toLowerCase().replace(/\s+/g, '');
    if (seen.has(key)) duplicates.push(med);
    else seen.add(key);
  }
  return duplicates;
}

function calculateOverallRisk(interactions: InteractionResult[], allergies: AllergyWarning[]): Severity {
  const all = [...interactions, ...allergies];
  if (all.some((i) => i.severity === 'critical')) return 'critical';
  if (all.some((i) => i.severity === 'high')) return 'high';
  if (all.some((i) => i.severity === 'moderate')) return 'moderate';
  if (all.length > 0) return 'low';
  return 'low';
}

// ─── Main risk analysis ────────────────────────────────────────────────────────
export async function analyseRisk(
  medicines: string[],
  knownAllergies: string[] = []
): Promise<RiskReport> {
  logger.info(`Analysing risk for ${medicines.length} medicines`);

  const [interactions, allergy_warnings] = await Promise.all([
    checkInteractionsLocally(medicines),
    checkAllergiesLocally(medicines, knownAllergies),
  ]);

  // Also enrich first medicine with OpenFDA data
  if (medicines[0]) {
    const fdaInteractions = await checkOpenFDA(medicines[0]);
    if (fdaInteractions.length && medicines.length > 1) {
      for (let i = 1; i < medicines.length; i++) {
        const hasMention = fdaInteractions.some((fi) =>
          fi.toLowerCase().includes(medicines[i].toLowerCase())
        );
        if (hasMention && !interactions.find((ix) => ix.medicine_b === medicines[i])) {
          interactions.push({
            medicine_a: medicines[0],
            medicine_b: medicines[i],
            severity: 'moderate',
            description: 'Potential interaction flagged by FDA drug label data.',
            source: 'OpenFDA',
          });
        }
      }
    }
  }

  const duplicate_alerts = detectDuplicates(medicines);
  const overall_risk = calculateOverallRisk(interactions, allergy_warnings);

  return { interactions, allergy_warnings, duplicate_alerts, overall_risk };
}
