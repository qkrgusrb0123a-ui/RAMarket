import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { adminSupabase } from '../lib/supabase.js';
import { requireAdmin } from '../middleware/admin-auth.js';
import { createAdminToken, passwordMatches } from '../services/admin-auth.js';
import { permanentlyDeleteAccount } from '../services/account-removal.js';

const passwordInput = z.object({ password: z.string().min(1).max(256) });
const reportFilter = z.object({ targetType: z.enum(['product', 'chat']).default('product') });
const accountStatusInput = z.object({ status: z.enum(['active', 'suspended']) });

export const adminRouter = Router();

adminRouter.post('/session', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }), (request, response, next) => {
  try {
    const { password } = passwordInput.parse(request.body);
    if (!passwordMatches(password)) return response.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
    return response.json({ data: { token: createAdminToken() } });
  } catch (error) { return next(error); }
});

adminRouter.use(requireAdmin);

adminRouter.get('/reports', async (request, response, next) => {
  try {
    const { targetType } = reportFilter.parse(request.query);
    const { data, error } = await adminSupabase
      .from('reports')
      .select('id,target_type,product_id,product_title,created_at,reporter:users!reports_reporter_id_fkey(id,login_id,nickname),reportedUser:users!reports_reported_user_id_fkey(id,login_id,nickname,status),product:products!reports_product_id_fkey(id,title,description,asking_price,status)')
      .eq('target_type', targetType)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return response.json({ data: data ?? [] });
  } catch (error) { return next(error); }
});

adminRouter.get('/reports/:reportId/conversation', async (request, response, next) => {
  try {
    const { data: report, error: reportError } = await adminSupabase
      .from('reports')
      .select('target_type,product_id,reporter_id,reported_user_id,product_title')
      .eq('id', request.params.reportId)
      .maybeSingle();
    if (reportError) throw reportError;
    if (!report || report.target_type !== 'chat' || !report.product_id || !report.reporter_id || !report.reported_user_id) {
      return response.status(404).json({ error: '확인할 채팅 신고를 찾을 수 없습니다.' });
    }
    const { data, error } = await adminSupabase
      .from('messages')
      .select('id,content,created_at,sender:users!messages_sender_id_fkey(id,login_id,nickname),recipient:users!messages_recipient_id_fkey(id,login_id,nickname)')
      .eq('product_id', report.product_id)
      .or(`and(sender_id.eq.${report.reporter_id},recipient_id.eq.${report.reported_user_id}),and(sender_id.eq.${report.reported_user_id},recipient_id.eq.${report.reporter_id})`)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return response.json({ data: { productTitle: report.product_title, messages: data ?? [] } });
  } catch (error) { return next(error); }
});

adminRouter.delete('/products/:productId', async (request, response, next) => {
  try {
    const { error: messagesError } = await adminSupabase.from('messages').delete().eq('product_id', request.params.productId);
    if (messagesError) throw messagesError;
    const { data, error } = await adminSupabase.from('products').delete().eq('id', request.params.productId).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ error: '삭제할 게시글을 찾을 수 없습니다.' });
    return response.status(204).send();
  } catch (error) { return next(error); }
});

adminRouter.patch('/users/:userId/status', async (request, response, next) => {
  try {
    const { status } = accountStatusInput.parse(request.body);
    const { data, error } = await adminSupabase.from('users').update({ status }).eq('id', request.params.userId).select('id,status').maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    return response.json({ data });
  } catch (error) { return next(error); }
});

adminRouter.delete('/users/:userId', async (request, response, next) => {
  try {
    const { data: user, error: userError } = await adminSupabase.from('users').select('id').eq('id', request.params.userId).maybeSingle();
    if (userError) throw userError;
    if (!user) return response.status(404).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    await permanentlyDeleteAccount(user.id);
    return response.status(204).send();
  } catch (error) { return next(error); }
});
