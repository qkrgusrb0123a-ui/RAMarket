import { collectDanawaResearchRamMarketData } from '../services/ram-market-collector.js';

try {
  const result = await collectDanawaResearchRamMarketData();
  console.info(`Danawa Research RAM market collection completed: ${result.acceptedCount} observations / ${result.specCount} specs (${result.status}).`);
} catch (error) {
  console.error('Licensed RAM market collection failed.', error);
  process.exitCode = 1;
}
