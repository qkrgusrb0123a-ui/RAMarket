import { collectWeeklyPrices } from '../services/price-collector.js';

try {
  const count = await collectWeeklyPrices();
  console.info(`Weekly price collection completed: ${count} snapshots saved.`);
} catch (error) {
  console.error('Weekly price collection failed.', error);
  process.exitCode = 1;
}
