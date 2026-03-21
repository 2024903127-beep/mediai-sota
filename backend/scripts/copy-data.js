const fs = require('fs');
const path = require('path');

const sourceDir = path.resolve(__dirname, '../src/data');
const targetDir = path.resolve(__dirname, '../dist/data');

if (!fs.existsSync(sourceDir)) {
  console.warn(`[copy-data] Source data directory not found: ${sourceDir}`);
  process.exit(0);
}

fs.mkdirSync(targetDir, { recursive: true });

const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
let copied = 0;

for (const entry of entries) {
  if (!entry.isFile()) continue;
  const sourceFile = path.join(sourceDir, entry.name);
  const targetFile = path.join(targetDir, entry.name);
  fs.copyFileSync(sourceFile, targetFile);
  copied += 1;
}

console.log(`[copy-data] Copied ${copied} file(s) from src/data to dist/data`);
