import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { syncToVectorDB } from '../src/services/vector.service';

const DB_PATH = path.resolve(__dirname, '../src/data/medicines_db.json');

async function run() {
  console.log('🚀 Starting Vector Sync (Batched)...');
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const medicines = db.medicines || [];
    const diseases = db.diseases || [];

    // Sync Medicines in batches of 10 to prevent OOM
    const CHUNK_SIZE = 10;
    for (let i = 0; i < medicines.length; i += CHUNK_SIZE) {
      const chunk = medicines.slice(i, i + CHUNK_SIZE);
      console.log(`📦 Syncing medicines chunk ${i / CHUNK_SIZE + 1} (${chunk.length} items)...`);
      await syncToVectorDB(chunk);
    }

    // Sync Diseases
    console.log(`📦 Syncing ${diseases.length} diseases...`);
    await syncToVectorDB(diseases);

    console.log('✨ Vector Sync Complete!');
  } catch (err) {
    console.error('❌ Sync Failed:', err);
  }
}

run();
