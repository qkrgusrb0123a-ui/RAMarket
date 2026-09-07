import { collectWeeklyPrices } from '../services/price-collector.js';

try {
  const count = await collectWeeklyPrices();
  console.info(`Weekly RAM price collection completed: ${count} prices saved.`);
} catch (error) {
  console.error('Weekly RAM price collection failed.', error);
  process.exitCode = 1;
}
