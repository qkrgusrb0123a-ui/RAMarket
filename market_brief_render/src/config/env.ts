import 'dotenv/config';
import { z } from 'zod';

const optionalLoginId = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{3,19}$/).optional()
);

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(10000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000,http://localhost:8081'),
  ADMIN_LOGIN_ID: optionalLoginId,
  ADMIN_SESSION_SECRET: z.string().min(32),
  // These credentials are used only by the scheduled server-side collector.
  // They must never be exposed through EXPO_PUBLIC_* variables.
  NAVER_SHOPPING_CLIENT_ID: z.string().min(1).optional(),
  NAVER_SHOPPING_CLIENT_SECRET: z.string().min(1).optional()
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
