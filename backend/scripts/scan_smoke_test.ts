import assert from 'assert';
import sharp from 'sharp';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'placeholder-service-key';

async function buildSyntheticPrescriptionImage(): Promise<Buffer> {
  const svg = `
    <svg width="900" height="420" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white" />
      <text x="40" y="90" font-size="46" font-family="Arial, sans-serif" fill="#111111">Rx</text>
      <text x="40" y="165" font-size="40" font-family="Arial, sans-serif" fill="#111111">Paracetamol 500 mg</text>
      <text x="40" y="230" font-size="36" font-family="Arial, sans-serif" fill="#111111">Amoxicillin 250 mg</text>
      <text x="40" y="300" font-size="30" font-family="Arial, sans-serif" fill="#111111">1 tablet twice daily</text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

async function run(): Promise<void> {
  console.log('Running scan smoke test...');

  const [{ extractTextFromImage }, { summarisePrescription }, { validateDrugNames }] = await Promise.all([
    import('../src/services/ocr.service'),
    import('../src/services/ai.service'),
    import('../src/services/drug-validation.service'),
  ]);

  const imageBuffer = await buildSyntheticPrescriptionImage();
  const ocr = await extractTextFromImage(imageBuffer, { mimeType: 'image/png' });
  const summary = await summarisePrescription(
    ocr.raw_text,
    'simple',
    ocr.medicines.map((m) => m.name)
  );
  const validated = await validateDrugNames(summary.medicines.map((m) => m.name));

  assert.ok(typeof ocr.raw_text === 'string', 'OCR should return raw text');
  assert.ok(Array.isArray(ocr.medicines), 'OCR should return medicine array');
  assert.ok(typeof summary.summary === 'string', 'Summary should be text');
  assert.ok(Array.isArray(summary.medicines), 'Summary should return medicine array');
  assert.equal(validated.length, summary.medicines.length, 'Validation count should match summary medicines');

  console.log('Smoke test passed.');
  console.log(
    JSON.stringify(
      {
        ocr_confidence: ocr.confidence,
        extracted_medicines: ocr.medicines.map((m) => m.name),
        summary_medicines: summary.medicines.map((m) => m.name),
        validated: validated.map((v) => ({ original: v.original, canonical: v.canonical, source: v.source })),
      },
      null,
      2
    )
  );
}

run().catch((err) => {
  console.error('Smoke test failed:', err?.message || err);
  process.exit(1);
});
