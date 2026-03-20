/**
 * OpenFDA Medicine Seeder
 * Fetches drug data from OpenFDA's public API and merges with existing medicines_db.json
 *
 * Run with: npx ts-node scripts/seed_medicines.ts
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

const DB_PATH = path.resolve(__dirname, '../src/data/medicines_db.json');

// Helper to make HTTPS GET and parse JSON
function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    }).on('error', reject);
  });
}

// Extract meaningful interaction text
function cleanText(text: string | string[] | undefined): string {
  if (!text) return '';
  const t = Array.isArray(text) ? text[0] : text;
  return t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

interface MedicineEntry {
  name: string;
  composition: string;
  uses: string;
  side_effects: string;
  precautions: string;
  warnings: string;
  treating: string[];
  interactions: { medicine: string; severity: string; description: string; }[];
}

async function fetchFromOpenFDA(skip: number, limit: number): Promise<MedicineEntry[]> {
  const url = `https://api.fda.gov/drug/label.json?limit=${limit}&skip=${skip}&search=_exists_:openfda.brand_name`;
  const data = await fetchJSON(url);
  if (!data?.results) return [];

  return data.results.map((r: any) => {
    const brand = r.openfda?.brand_name?.[0] || r.openfda?.substance_name?.[0] || 'Unknown';
    const generic = r.openfda?.generic_name?.[0] || r.openfda?.substance_name?.[0] || brand;

    const uses = cleanText(r.indications_and_usage) || cleanText(r.purpose) || 'See prescribing information.';
    const sideEffects = cleanText(r.adverse_reactions) || cleanText(r.side_effects_and_what_to_do) || 'See prescribing information.';
    const warnings = cleanText(r.warnings) || cleanText(r.boxed_warning) || '';
    const precautions = cleanText(r.precautions) || cleanText(r.do_not_use) || '';

    // Extract relevant condition keywords from indications
    const conditionKeywords = ['pain', 'fever', 'infection', 'diabetes', 'hypertension', 'cholesterol', 'acid', 'allergy', 'anxiety', 'depression', 'heart', 'blood pressure', 'arthritis', 'inflammation', 'antibiotic', 'antiviral', 'cough', 'cold', 'nausea'];
    const treating = conditionKeywords.filter(kw => uses.toLowerCase().includes(kw)).map(kw => kw.charAt(0).toUpperCase() + kw.slice(1));

    return {
      name: brand,
      composition: generic,
      uses: uses.slice(0, 300),
      side_effects: sideEffects.slice(0, 300),
      precautions: precautions.slice(0, 200),
      warnings: warnings.slice(0, 200),
      treating,
      interactions: [],
    };
  }).filter((m: MedicineEntry) => m.name !== 'Unknown' && m.name.length > 1);
}

async function seed() {
  console.log('🧬 Starting OpenFDA Medicine Seeder...');

  // Load existing DB
  const existing = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const existingNames = new Set(existing.medicines.map((m: any) => m.name.toLowerCase()));
  const existingDiseases = existing.diseases || [];

  const allNew: MedicineEntry[] = [];
  const batchSize = 100;
  const totalBatches = 5; // 500 records total

  for (let i = 0; i < totalBatches; i++) {
    process.stdout.write(`  Fetching batch ${i + 1}/${totalBatches}...`);
    try {
      const batch = await fetchFromOpenFDA(i * batchSize, batchSize);
      const deduped = batch.filter(m => !existingNames.has(m.name.toLowerCase()));
      deduped.forEach(m => existingNames.add(m.name.toLowerCase()));
      allNew.push(...deduped);
      console.log(` ✅ Got ${deduped.length} new medicines`);
      // Rate limit - 1 request/second is safe
      await new Promise(r => setTimeout(r, 1200));
    } catch (err: any) {
      console.log(` ⚠️ Batch ${i + 1} failed: ${err.message}`);
    }
  }

  // Add extra hand-crafted Indian/common drugs not in OpenFDA
  const indianDrugs: MedicineEntry[] = [
    {
      name: 'Shelcal',
      composition: 'Calcium Carbonate + Vitamin D3',
      uses: 'Calcium and Vitamin D supplement for bones and teeth.',
      side_effects: 'Constipation, nausea, stomach pain.',
      precautions: 'Avoid overdose. Space 2 hours from other medications.',
      warnings: 'Hypercalcemia if overdosed.',
      treating: ['Calcium Deficiency', 'Osteoporosis'],
      interactions: [],
    },
    {
      name: 'Limcee',
      composition: 'Vitamin C (Ascorbic Acid) 500mg',
      uses: 'Vitamin C deficiency, immunity booster, antioxidant.',
      side_effects: 'Nausea, heartburn on empty stomach.',
      precautions: 'Chew tablet. Avoid excessive doses.',
      warnings: 'High doses may cause kidney stones.',
      treating: ['Vitamin C Deficiency', 'Immunity'],
      interactions: [],
    },
    {
      name: 'Monocef',
      composition: 'Ceftriaxone 1g',
      uses: 'Severe bacterial infections including pneumonia, meningitis, and typhoid.',
      side_effects: 'Diarrhea, allergic reactions, rash.',
      precautions: 'Monitor kidney function. Complete full course.',
      warnings: 'Risk of Clostridium difficile-associated diarrhea.',
      treating: ['Severe Infection', 'Meningitis', 'Typhoid'],
      interactions: [],
    },
    {
      name: 'Cipla Actin',
      composition: 'Cyproheptadine',
      uses: 'Appetite stimulant and antihistamine for allergies.',
      side_effects: 'Drowsiness, dry mouth, increased appetite.',
      precautions: 'Avoid alcohol. Do not drive.',
      warnings: 'Do not use in infants under 2 years.',
      treating: ['Allergy', 'Poor Appetite'],
      interactions: [],
    },
    {
      name: 'Pan-D',
      composition: 'Pantoprazole 40mg + Domperidone 10mg',
      uses: 'GERD, gastric reflux, acidity with nausea.',
      side_effects: 'Headache, diarrhea, dry mouth.',
      precautions: 'Take 30 minutes before food.',
      warnings: 'Not for long term use without medical advice.',
      treating: ['Acidity', 'GERD', 'Nausea'],
      interactions: [],
    },
    {
      name: 'Glycomet',
      composition: 'Metformin Hydrochloride 500mg',
      uses: 'Type 2 Diabetes management. First-line therapy.',
      side_effects: 'Nausea, diarrhea, stomach pain initially.',
      precautions: 'Take with meals. Monitor B12 levels.',
      warnings: 'Stop before surgery/contrast dye. Lactic acidosis risk.',
      treating: ['Type 2 Diabetes', 'PCOS'],
      interactions: [],
    },
    {
      name: 'Repace',
      composition: 'Losartan Potassium 25mg',
      uses: 'Hypertension and protection of kidneys in diabetic patients.',
      side_effects: 'Dizziness, high potassium, kidney changes.',
      precautions: 'Monitor blood pressure and potassium.',
      warnings: 'Avoid in pregnancy — can harm fetus.',
      treating: ['Hypertension', 'Heart Failure', 'Diabetic Nephropathy'],
      interactions: [],
    },
    {
      name: 'Telma',
      composition: 'Telmisartan 40mg',
      uses: 'High blood pressure treatment. Also used for cardiovascular risk reduction.',
      side_effects: 'Back pain, upper respiratory infection, dizziness.',
      precautions: 'Regular BP monitoring required.',
      warnings: 'Avoid in pregnancy. Monitor kidney function.',
      treating: ['Hypertension', 'Cardiovascular Risk'],
      interactions: [],
    },
    {
      name: 'Thyronorm',
      composition: 'Levothyroxine Sodium',
      uses: 'Hypothyroidism — underactive thyroid replacement therapy.',
      side_effects: 'Palpitations, weight loss, tremors if overdosed.',
      precautions: 'Take on empty stomach 30 min before food.',
      warnings: 'Do not self-adjust dose. Regular thyroid tests needed.',
      treating: ['Hypothyroidism', 'Thyroid Deficiency'],
      interactions: [],
    },
    {
      name: 'Dolo 650',
      composition: 'Paracetamol 650mg',
      uses: 'Fever and mild to moderate pain relief.',
      side_effects: 'Rare — liver enzyme changes, rash.',
      precautions: 'Do not take with other paracetamol-containing products.',
      warnings: 'Maximum 4 tablets per day.',
      treating: ['Fever', 'Pain', 'Headache'],
      interactions: [],
    },
  ];

  const finalMedicines = [
    ...existing.medicines,
    ...indianDrugs.filter(d => !existingNames.has(d.name.toLowerCase())),
    ...allNew,
  ];

  const finalDB = {
    medicines: finalMedicines,
    diseases: existingDiseases,
  };

  fs.writeFileSync(DB_PATH, JSON.stringify(finalDB, null, 2), 'utf-8');
  console.log(`\n🎉 Done! Total medicines in database: ${finalMedicines.length}`);
}

seed().catch(err => {
  console.error('Seeder failed:', err);
  process.exit(1);
});
