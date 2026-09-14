import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { authRouter } from './routes/auth.js';
import { messagesRouter } from './routes/messages.js';
import { healthRouter } from './routes/health.js';
import { internalRouter } from './routes/internal.js';
import { ramPriceRouter } from './routes/prices.js';
import { productsRouter } from './routes/products.js';
import { uploadsRouter } from './routes/uploads.js';
import { reportsRouter } from './routes/reports.js';
import { adminRouter } from './routes/admin.js';
import { supportRouter } from './routes/support.js';

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const webDirectory = path.resolve(sourceDirectory, '../public/web');
const webEntryFile = path.join(webDirectory, 'index.html');

export const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'connect-src': ["'self'", 'https:'],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'style-src': ["'self'", "'unsafe-inline'"]
    }
  }
}));
app.use(cors({ origin: env.allowedOrigins, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Authorization', 'Content-Type', 'X-Cron-Secret'] }));
app.use(express.json({
  limit: '1mb',
  // Avoid relying on a transitive content-type resolver and accept only JSON
  // (including vendor +json media types) before parsing a request body.
  type: (request) => /^application\/(?:[\w.-]+\+)?json(?:;|$)/i.test(request.headers['content-type'] ?? '')
}));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));

app.use('/health', healthRouter);
app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }), authRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/uploads', uploadsRouter);
app.use('/api/v1/messages', messagesRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/support', supportRouter);
app.use('/api/v1/ram-prices', ramPriceRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/internal', internalRouter);
app.use(express.static(webDirectory, { index: 'index.html' }));
app.use((request, response, next) => {
  const isApiRoute = request.path === '/health'
    || request.path.startsWith('/api/')
    || request.path.startsWith('/internal/')
    || request.path === '/admin'
    || request.path.startsWith('/admin/');
  if (!existsSync(webEntryFile) || (request.method !== 'GET' && request.method !== 'HEAD') || isApiRoute || path.extname(request.path)) return next();
  response.sendFile(webEntryFile, (error) => { if (error) next(error); });
});
app.use(notFound);
app.use(errorHandler);
