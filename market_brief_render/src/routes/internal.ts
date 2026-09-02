import { Router } from 'express';
import { env } from '../config/env.js';
import { parsePriceFeed, savePriceSnapshots } from '../services/price-collector.js';

export const internalRouter = Router();

internalRouter.post('/price-snapshots', async (request, response, next) => {
  try {
    if (!env.CRON_SECRET || request.header('x-cron-secret') !== env.CRON_SECRET) {
      return response.status(401).json({ error: 'Invalid cron secret.' });
    }
    const feed = parsePriceFeed(request.body);
    const inserted = await savePriceSnapshots(feed.snapshots);
    return response.status(201).json({ inserted });
  } catch (error) { return next(error); }
});
