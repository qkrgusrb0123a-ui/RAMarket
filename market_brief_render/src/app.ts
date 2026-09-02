import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { chatsRouter } from './routes/chats.js';
import { healthRouter } from './routes/health.js';
import { internalRouter } from './routes/internal.js';
import { pricesRouter } from './routes/prices.js';
import { productsRouter } from './routes/products.js';

export const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.allowedOrigins, methods: ['GET', 'POST', 'PATCH'], allowedHeaders: ['Authorization', 'Content-Type', 'X-Cron-Secret'] }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));

app.use('/health', healthRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/chats', chatsRouter);
app.use('/api/v1/prices', pricesRouter);
app.use('/internal', internalRouter);
app.use(notFound);
app.use(errorHandler);
