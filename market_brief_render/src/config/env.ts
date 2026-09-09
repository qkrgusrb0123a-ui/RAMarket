import 'dotenv/config';
import { z } from 'zod';

const optionalUrl = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().url().optional()
);

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(10000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000,http://localhost:8081'),
  ADMIN_PASSWORD_HASH: z.string().regex(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/, 'ADMIN_PASSWORD_HASH must be generated with pnpm run admin:password.'),
  ADMIN_SESSION_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(24).optional(),
  PRICE_FEED_URL: optionalUrl
});

const parsed = environmentSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = {
  ...parsed.data,
  allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
};
