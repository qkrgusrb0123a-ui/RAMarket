import { collectAllLicensedRamMarketData } from '../services/ram-market-collector.js';

try {
  const results = await collectAllLicensedRamMarketData();
  console.info(`Licensed RAM market collection completed for ${results.length} provider(s): ${results.map((result) => `${result.acceptedCount} observations / ${result.specCount} specs (${result.status})`).join(', ')}.`);
} catch (error) {
  console.error('Licensed RAM market collection failed.', error);
  process.exitCode = 1;
}
