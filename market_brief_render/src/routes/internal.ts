import { Router } from 'express';
import { env } from '../config/env.js';
import { parseRamPriceFeed, saveRamPrices } from '../services/price-collector.js';

export const internalRouter = Router();

internalRouter.post('/ram-prices', async (request, response, next) => {
  try {
    if (!env.CRON_SECRET || request.header('x-cron-secret') !== env.CRON_SECRET) {
      return response.status(401).json({ error: 'Invalid cron secret.' });
    }
    const feed = parseRamPriceFeed(request.body);
    const inserted = await saveRamPrices(feed.prices);
    return response.status(201).json({ inserted });
  } catch (error) { return next(error); }
});
