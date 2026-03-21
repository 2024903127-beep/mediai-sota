import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'placeholder-service-key';

interface SyntheticFixture {
  id: string;
  title: string;
  lines: string[];
  expected: string[];
  minRecall: number;
  rotate?: number;
  blur?: number;
  brightness?: number;
  contrast?: number;
}

interface RealFixtureManifestEntry {
  id: string;
  file: string;
  expected: string[];
  minRecall?: number;
}

interface FixtureInput {
  id: string;
  title: string;
  expected: string[];
  minRecall: number;
  buffer: Buffer;
  mimeType: string;
  source: 'synthetic' | 'real';
}

interface FixtureResult {
  id: string;
  title: string;
  source: 'synthetic' | 'real';
  expected: string[];
  predicted: string[];
  recall: number;
  minRecall: number;
  passed: boolean;
  ocrConfidence: number;
  ocrPreview: string;
}

const REPORTS_DIR = path.resolve(__dirname, '../reports');
const REAL_FIXTURES_DIR = path.resolve(__dirname, '../tests/fixtures/prescriptions');
const REAL_MANIFEST_PATH = path.join(REAL_FIXTURES_DIR, 'manifest.json');

const SYNTHETIC_FIXTURES: SyntheticFixture[] = [
  {
    id: 'sx-01',
    title: 'Single clear medicine',
    lines: ['Rx', 'Paracetamol 500 mg', '1 tablet twice daily'],
    expected: ['Paracetamol'],
    minRecall: 0.5,
  },
  {
    id: 'sx-02',
    title: 'Two medicines clear',
    lines: ['Ibuprofen 400 mg', 'Omeprazole 20 mg', 'after meals'],
    expected: ['Ibuprofen', 'Omeprazole'],
    minRecall: 0.5,
  },
  {
    id: 'sx-03',
    title: 'Slight rotation',
    lines: ['Amoxicillin 500 mg', 'Cetirizine 10 mg', 'for 5 days'],
    expected: ['Amoxicillin', 'Cetirizine'],
    minRecall: 0.5,
    rotate: -2.5,
  },
  {
    id: 'sx-04',
    title: 'Small blur',
    lines: ['Metformin 500 mg', 'Atorvastatin 10 mg', 'at night'],
    expected: ['Metformin', 'Atorvastatin'],
    minRecall: 0.5,
    blur: 0.6,
  },
  {
    id: 'sx-05',
    title: 'Lower contrast',
    lines: ['Azithromycin 500 mg', 'Paracetamol 650 mg', 'once daily'],
    expected: ['Azithromycin', 'Paracetamol'],
    minRecall: 0.5,
    brightness: 0.95,
    contrast: 0.9,
  },
  {
    id: 'sx-06',
    title: 'Prescription style mixed case',
    lines: ['Tab Crocin 650', 'Cap Amoxicillin 250', 'BD x 3 days'],
    expected: ['Crocin', 'Amoxicillin'],
    minRecall: 0.5,
  },
  {
    id: 'sx-07',
    title: 'Longer lines',
    lines: ['Lisinopril 5 mg', 'Metformin 500 mg', 'monitor blood pressure'],
    expected: ['Lisinopril', 'Metformin'],
    minRecall: 0.5,
    rotate: 1.8,
  },
  {
    id: 'sx-08',
    title: 'Compact text block',
    lines: ['Omeprazole 20mg', 'Cetirizine 10mg', 'Paracetamol 500mg'],
    expected: ['Omeprazole', 'Cetirizine', 'Paracetamol'],
    minRecall: 0.34,
    blur: 0.3,
  },
];

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function inferMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

function makeSvg(lines: string[]): string {
  const width = 1200;
  const height = Math.max(500, 140 + lines.length * 90);
  const renderedLines = lines
    .map((line, idx) => {
      const y = 90 + idx * 85;
      const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<text x="48" y="${y}" font-size="54" font-family="Arial, Helvetica, sans-serif" fill="#111">${escaped}</text>`;
    })
    .join('\n');

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white" />
      ${renderedLines}
    </svg>
  `;
}

async function renderSyntheticFixture(fixture: SyntheticFixture): Promise<FixtureInput> {
  let img = sharp(Buffer.from(makeSvg(fixture.lines))).png();

  if (fixture.rotate) {
    img = img.rotate(fixture.rotate, { background: '#ffffff' });
  }

  if (fixture.blur) {
    img = img.blur(fixture.blur);
  }

  if (fixture.brightness || fixture.contrast) {
    img = img.modulate({
      brightness: fixture.brightness || 1,
    });
    if (fixture.contrast) {
      const linearSlope = fixture.contrast;
      const linearOffset = (1 - linearSlope) * 128;
      img = img.linear(linearSlope, linearOffset);
    }
  }

  const buffer = await img.toBuffer();
  return {
    id: fixture.id,
    title: fixture.title,
    expected: fixture.expected,
    minRecall: fixture.minRecall,
    buffer,
    mimeType: 'image/png',
    source: 'synthetic',
  };
}

async function loadRealFixtures(): Promise<FixtureInput[]> {
  if (!fs.existsSync(REAL_MANIFEST_PATH)) return [];

  const manifest = JSON.parse(fs.readFileSync(REAL_MANIFEST_PATH, 'utf-8')) as RealFixtureManifestEntry[];
  const fixtures: FixtureInput[] = [];

  for (const item of manifest) {
    const filePath = path.resolve(REAL_FIXTURES_DIR, item.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`Skipping missing real fixture: ${item.file}`);
      continue;
    }

    const buffer = fs.readFileSync(filePath);
    fixtures.push({
      id: item.id,
      title: `Real fixture: ${item.file}`,
      expected: item.expected || [],
      minRecall: typeof item.minRecall === 'number' ? item.minRecall : 0.5,
      buffer,
      mimeType: inferMimeType(item.file),
      source: 'real',
    });
  }

  return fixtures;
}

function calculateRecall(expected: string[], predicted: string[]): number {
  if (!expected.length) return predicted.length ? 0 : 1;

  const predictedNorm = predicted.map(normalizeToken);
  let matched = 0;
  for (const exp of expected) {
    const expNorm = normalizeToken(exp);
    const found = predictedNorm.some((pred) => pred.includes(expNorm) || expNorm.includes(pred));
    if (found) matched += 1;
  }
  return matched / expected.length;
}

async function runFixture(
  fixture: FixtureInput,
  extractTextFromImage: (buffer: Buffer, options?: { mimeType?: string }) => Promise<any>,
  summarisePrescription: (text: string, mode?: 'simple' | 'technical', seedCandidates?: string[]) => Promise<any>,
  validateDrugNames: (names: string[]) => Promise<Array<{ canonical: string }>>
): Promise<FixtureResult> {
  const ocr = await extractTextFromImage(fixture.buffer, { mimeType: fixture.mimeType });
  const summary = await summarisePrescription(
    ocr.raw_text,
    'simple',
    (ocr.medicines || []).map((m: any) => m.name).filter(Boolean)
  );
  const validation = await validateDrugNames((summary.medicines || []).map((m: any) => m.name).filter(Boolean));
  const predicted = Array.from(new Set(validation.map((entry) => entry.canonical)));

  const recall = calculateRecall(fixture.expected, predicted);
  const passed = recall >= fixture.minRecall;

  return {
    id: fixture.id,
    title: fixture.title,
    source: fixture.source,
    expected: fixture.expected,
    predicted,
    recall: Number(recall.toFixed(2)),
    minRecall: fixture.minRecall,
    passed,
    ocrConfidence: Number((ocr.confidence || 0).toFixed(2)),
    ocrPreview: String(ocr.raw_text || '').slice(0, 160),
  };
}

function printResults(results: FixtureResult[]): void {
  console.log('\nScan Regression Results\n');
  for (const result of results) {
    const status = result.passed ? 'PASS' : 'FAIL';
    console.log(
      `${status} [${result.id}] ${result.title} | recall=${result.recall} (min=${result.minRecall}) | expected=${result.expected.join(
        ', '
      )} | predicted=${result.predicted.join(', ')}`
    );
  }
}

function writeReport(results: FixtureResult[]): string {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const avgRecall = results.length ? results.reduce((sum, r) => sum + r.recall, 0) / results.length : 0;

  const report = {
    generated_at: new Date().toISOString(),
    total: results.length,
    passed,
    failed,
    pass_rate: Number((results.length ? passed / results.length : 0).toFixed(2)),
    avg_recall: Number(avgRecall.toFixed(2)),
    results,
  };

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(REPORTS_DIR, `scan-regression-${timestamp}.json`);
  const latestPath = path.join(REPORTS_DIR, 'scan-regression-latest.json');

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(latestPath, JSON.stringify(report, null, 2));

  return reportPath;
}

async function main(): Promise<void> {
  console.log('Running scan regression test...');

  const [{ extractTextFromImage }, { summarisePrescription }, { validateDrugNames }] = await Promise.all([
    import('../src/services/ocr.service'),
    import('../src/services/ai.service'),
    import('../src/services/drug-validation.service'),
  ]);

  const syntheticInputs = await Promise.all(SYNTHETIC_FIXTURES.map((fixture) => renderSyntheticFixture(fixture)));
  const realInputs = await loadRealFixtures();
  const fixtures = [...syntheticInputs, ...realInputs];

  if (!fixtures.length) {
    throw new Error('No regression fixtures available');
  }

  const results: FixtureResult[] = [];
  for (const fixture of fixtures) {
    const result = await runFixture(fixture, extractTextFromImage, summarisePrescription, validateDrugNames);
    results.push(result);
  }

  printResults(results);
  const reportPath = writeReport(results);

  const passRate = results.length ? results.filter((r) => r.passed).length / results.length : 0;
  const strictMode = (process.env.SCAN_REGRESSION_STRICT || 'false').toLowerCase() === 'true';
  const minPassRate = strictMode ? 0.9 : 0.6;

  console.log(`\nReport saved: ${reportPath}`);
  console.log(`Pass rate: ${(passRate * 100).toFixed(0)}% (required ${(minPassRate * 100).toFixed(0)}%)`);

  if (passRate < minPassRate) {
    throw new Error(`Regression threshold not met. Pass rate ${(passRate * 100).toFixed(0)}%`);
  }
}

main().catch((err) => {
  console.error('Regression test failed:', err?.message || err);
  process.exit(1);
});
