import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * Production-grade Nutrition Intelligence Service
 * Uses Open Food Facts API (Free, Crowdsourced)
 */

export interface FoodProduct {
  name: string;
  brand: string;
  nutriments: any;
  ecoscore: string;
  ingredients: string[];
}

export async function lookupNutrition(barcode: string): Promise<FoodProduct | null> {
  try {
    logger.info(`🔍 Looking up nutrition for barcode: ${barcode}`);
    const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
    const { data } = await axios.get(url);

    if (data.status === 0 || !data.product) return null;

    const p = data.product;
    return {
      name: p.product_name || 'Unknown Product',
      brand: p.brands || 'N/A',
      nutriments: p.nutriments || {},
      ecoscore: p.ecoscore_grade || 'N/A',
      ingredients: p.ingredients_text ? p.ingredients_text.split(',').map((i: string) => i.trim()) : [],
    };
  } catch (err) {
    logger.error('Nutrition lookup failed', err);
    return null;
  }
}

export async function searchFood(query: string): Promise<FoodProduct[]> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`;
    const { data } = await axios.get(url);

    return (data.products || []).map((p: any) => ({
      name: p.product_name || 'Unknown',
      brand: p.brands || 'N/A',
      nutriments: p.nutriments || {},
      ecoscore: p.ecoscore_grade,
      ingredients: p.ingredients_text ? p.ingredients_text.split(',').map((i: string) => i.trim()) : [],
    }));
  } catch (err) {
    logger.error('Food search failed', err);
    return [];
  }
}
