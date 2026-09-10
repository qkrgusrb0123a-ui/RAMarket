import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
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

export const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.allowedOrigins, methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Authorization', 'Content-Type', 'X-Cron-Secret'] }));
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
app.use('/admin', express.static(path.resolve(sourceDirectory, '../public/admin'), { index: 'index.html' }));
app.use(notFound);
app.use(errorHandler);
