import { Router } from 'express';
import { z } from 'zod';
import { adminSupabase, publicSupabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { permanentlyDeleteAccount } from '../services/account-removal.js';

const loginIdSchema = z.string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_-]{3,19}$/, 'Login ID must be 4-20 lowercase letters, numbers, _ or -.');

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be 72 characters or fewer.')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be 72 bytes or fewer.');

const signUpInput = z.object({
  loginId: loginIdSchema,
  password: passwordSchema
});

const signInInput = z.object({
  loginId: loginIdSchema,
  password: z.string().min(1).max(72)
});

const refreshInput = z.object({
  refreshToken: z.string().min(1)
});
const accountUpdateInput = z.object({
  nickname: z.string().trim().min(2).max(30),
  password: passwordSchema.optional(),
  avatarUrl: z.string().trim().min(1).max(500).nullable().optional()
});

/**
 * Supabase Auth requires an email-shaped identifier for password auth. This
 * address is never shown to, or collected from, the user and ends in .invalid
 * so it cannot be a deliverable email address.
 */
function authEmail(loginId: string) {
  return `${loginId}@ramarket.invalid`;
}

function sessionResponse(userId: string, loginId: string, accessToken: string, refreshToken: string, expiresIn: number | undefined) {
  return {
    user: { id: userId, loginId },
    session: { accessToken, refreshToken, expiresIn: expiresIn ?? 0 }
  };
}

async function ensureAccountIsActive(userId: string) {
  const { data, error } = await adminSupabase.from('users').select('status').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data?.status !== 'suspended';
}

export const authRouter = Router();

authRouter.post('/sign-up', async (request, response, next) => {
  try {
    const { loginId, password } = signUpInput.parse(request.body);
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email: authEmail(loginId),
      password,
      // There is intentionally no email verification flow in this product.
      email_confirm: true,
      user_metadata: { login_id: loginId, nickname: loginId }
    });

    if (error || !data.user) {
      if (error?.code === 'email_exists' || /already been registered/i.test(error?.message ?? '')) {
        return response.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
      }
      throw error ?? new Error('Unable to create user.');
    }

    // Sign in once after registration so the user can proceed immediately.
    const { data: signInData, error: signInError } = await publicSupabase.auth.signInWithPassword({
      email: authEmail(loginId),
      password
    });
    if (signInError || !signInData.session) throw signInError ?? new Error('Unable to create a session.');

    return response.status(201).json(sessionResponse(
      data.user.id,
      loginId,
      signInData.session.access_token,
      signInData.session.refresh_token,
      signInData.session.expires_in
    ));
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/sign-in', async (request, response, next) => {
  try {
    const { loginId, password } = signInInput.parse(request.body);
    const { data, error } = await publicSupabase.auth.signInWithPassword({
      email: authEmail(loginId),
      password
    });

    // Do not reveal whether a particular ID exists.
    if (error || !data.session || !data.user) {
      return response.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    if (!await ensureAccountIsActive(data.user.id)) {
      return response.status(403).json({ error: '활동이 정지된 계정입니다. 관리자에게 문의해 주세요.' });
    }

    return response.json(sessionResponse(
      data.user.id,
      loginId,
      data.session.access_token,
      data.session.refresh_token,
      data.session.expires_in
    ));
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/refresh', async (request, response, next) => {
  try {
    const { refreshToken } = refreshInput.parse(request.body);
    const { data, error } = await publicSupabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) {
      return response.status(401).json({ error: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.' });
    }
    if (!await ensureAccountIsActive(data.user.id)) {
      return response.status(403).json({ error: '활동이 정지된 계정입니다. 관리자에게 문의해 주세요.' });
    }
    const loginId = typeof data.user.user_metadata.login_id === 'string' ? data.user.user_metadata.login_id : '';
    if (!loginId) return response.status(401).json({ error: '로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.' });
    return response.json(sessionResponse(
      data.user.id,
      loginId,
      data.session.access_token,
      data.session.refresh_token,
      data.session.expires_in
    ));
  } catch (error) {
    return next(error);
  }
});

authRouter.get('/account', requireAuth, async (request, response, next) => {
  try {
    const { data, error } = await adminSupabase.from('users').select('login_id,nickname,avatar_url').eq('id', request.userId).maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    return response.json({ data: { loginId: data.login_id, nickname: data.nickname, avatarUrl: data.avatar_url } });
  } catch (error) { return next(error); }
});

authRouter.patch('/account', requireAuth, async (request, response, next) => {
  try {
    const input = accountUpdateInput.parse(request.body);
    const userId = request.userId;
    if (!userId) return response.status(401).json({ error: '로그인이 필요합니다.' });
    const { data: current, error: currentError } = await adminSupabase.from('users').select('login_id').eq('id', userId).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return response.status(404).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    const { error: authError } = await adminSupabase.auth.admin.updateUserById(userId, {
      ...(input.password ? { password: input.password } : {}),
      user_metadata: { login_id: current.login_id, nickname: input.nickname, avatar_url: input.avatarUrl ?? null }
    });
    if (authError) throw authError;
    const { data, error } = await adminSupabase.from('users').update({ nickname: input.nickname, avatar_url: input.avatarUrl ?? null }).eq('id', userId).select('login_id,nickname,avatar_url').single();
    if (error) throw error;
    return response.json({ data: { loginId: data.login_id, nickname: data.nickname, avatarUrl: data.avatar_url } });
  } catch (error) { return next(error); }
});

authRouter.delete('/account', requireAuth, async (request, response, next) => {
  try {
    const userId = request.userId;
    if (!userId) return response.status(401).json({ error: '로그인이 필요합니다.' });
    await permanentlyDeleteAccount(userId);
    return response.status(204).send();
  } catch (error) { return next(error); }
});
