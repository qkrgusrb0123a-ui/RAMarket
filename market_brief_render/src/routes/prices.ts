import { Router } from 'express';
import { z } from 'zod';
import { supabaseForRequest } from '../lib/supabase.js';

export const ramPriceRouter = Router();

/**
 * Lists the RAM categories that currently have an active marketplace listing.
 * The chart deliberately reads the marketplace rather than retaining a copied
 * price feed, so sold or removed listings stop affecting the median at once.
 */
ramPriceRouter.get('/listing-categories', async (request, response, next) => {
  try {
    const { data, error } = await supabaseForRequest(request)
      .from('products')
      .select('category')
      .eq('status', 'active');
    if (error) throw error;
    const categories = [...new Set((data ?? [])
      .map((item) => item.category?.trim())
      .filter((category): category is string => Boolean(category)))]
      .sort((left, right) => left.localeCompare(right, 'ko-KR'));
    return response.set('Cache-Control', 'no-store').json({ data: categories });
  } catch (error) { return next(error); }
});

/**
 * Returns every active, second-hand listing price in a category in ascending
 * order, together with its median. All marketplace listings are user-posted
 * used-RAM listings; only status=active listings are included.
 */
ramPriceRouter.get('/listing-chart', async (request, response, next) => {
  try {
    const { category } = z.object({ category: z.string().trim().min(1).max(150) }).parse(request.query);
    const { data, error } = await supabaseForRequest(request)
      .from('products')
      .select('asking_price')
      .eq('status', 'active')
      .eq('category', category)
      .order('asking_price', { ascending: true });
    if (error) throw error;
    const sortedPrices = (data ?? []).map((item) => Number(item.asking_price)).filter(Number.isFinite);
    const middle = Math.floor(sortedPrices.length / 2);
    const medianPrice = sortedPrices.length === 0 ? null : sortedPrices.length % 2
      ? sortedPrices[middle]
      : Math.round((sortedPrices[middle - 1] + sortedPrices[middle]) / 2);
    return response.set('Cache-Control', 'no-store').json({ data: {
      category,
      listingCount: sortedPrices.length,
      minPrice: sortedPrices[0] ?? null,
      maxPrice: sortedPrices.at(-1) ?? null,
      medianPrice,
      sortedPrices
    } });
  } catch (error) { return next(error); }
});

ramPriceRouter.get('/history', async (request, response, next) => {
  try {
    const { ramName } = z.object({ ramName: z.string().trim().min(1).max(100).optional() }).parse(request.query);
    let statement = supabaseForRequest(request)
      .from('ram_price')
      .select('id,ram_name,price,source,week_start')
      .order('week_start', { ascending: true });
    if (ramName) statement = statement.eq('ram_name', ramName);
    const { data, error } = await statement;
    if (error) throw error;
    return response.json({ data });
  } catch (error) { return next(error); }
});
