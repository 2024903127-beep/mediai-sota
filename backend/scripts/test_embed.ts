import { pipeline } from '@xenova/transformers';

async function test() {
  console.log('Testing embedding...');
  try {
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const output = await extractor('Hello world', { pooling: 'mean', normalize: true });
    console.log('Success! Vector size:', output.data.length);
  } catch (err) {
    console.error('Test Failed:', err);
  }
}

test();
