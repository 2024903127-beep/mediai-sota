import { supabase } from '../config/supabase';
import { pipeline } from '@xenova/transformers';
import { logger } from '../utils/logger';

let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    logger.info('Initializing embedding model (MiniLM-L6-v2) for Vector RAG...');
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return extractor;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const ext = await getExtractor();
  const output = await ext(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data) as number[];
}

/**
 * Synchronize local medicine/disease database with Supabase pgvector
 */
export async function syncToVectorDB(data: any[]) {
  logger.info(`Syncing ${data.length} records to Supabase Vector DB...`);
  
  for (const item of data) {
    try {
      const content = JSON.stringify(item);
      const textToEmbed = `${item.name} ${item.composition || ''} ${(item.treating || []).join(' ')} ${item.uses || ''}`;
      const embedding = await generateEmbedding(textToEmbed);

      const { error } = await supabase
        .from('medical_knowledge')
        .upsert({
          name: item.name,
          category: item.composition ? 'medicine' : 'disease',
          source: 'openfda/who',
          content,
          embedding,
          metadata: { composition: item.composition, treating: item.treating }
        }, { onConflict: 'name' });

      if (error) logger.error(`Failed to sync ${item.name}`, error);
    } catch (err) {
      logger.error(`Error processing ${item.name} for vector sync`, err);
    }
  }
  logger.info('Vector DB sync complete.');
}

/**
 * Production-grade Semantic Search using Supabase pgvector
 */
export async function vectorSearch(query: string, category?: string, limit = 3) {
  try {
    const embedding = await generateEmbedding(query);
    const { data, error } = await supabase.rpc('match_medical_knowledge', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: limit,
      category_filter: category
    });

    if (error) throw error;
    return data;
  } catch (err) {
    logger.error('Vector search failed, falling back...', err);
    return null;
  }
}
