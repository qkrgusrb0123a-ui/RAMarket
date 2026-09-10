import { app } from './app.js';
import { env } from './config/env.js';
import { startSuspensionExpiryWorker } from './services/suspensions.js';

const server = app.listen(env.PORT, () => console.info(`RAMarket API is listening on port ${env.PORT}`));
startSuspensionExpiryWorker();

function shutdown(signal: string) {
  console.info(`${signal} received: closing HTTP server.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
