import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { adminSupabase } from '../lib/supabase.js';
import { requireAdmin } from '../middleware/admin-auth.js';
import { permanentlyDeleteAccount } from '../services/account-removal.js';
import { cancelSuspension, releaseExpiredSuspensions, suspendUser, suspensionDurations } from '../services/suspensions.js';

const reportFilter = z.object({ targetType: z.enum(['product', 'chat']).default('product') });
const suspensionInput = z.object({ duration: z.enum(suspensionDurations) });

export const adminRouter = Router();
const danawaResearchSource = 'danawa-research-licensed-feed';

adminRouter.use(requireAdmin);

adminRouter.get('/users', async (_request, response, next) => {
  try {
    await releaseExpiredSuspensions();
    const query = adminSupabase.from('users').select('id,login_id,nickname,status,suspended_until');
    if (env.ADMIN_LOGIN_ID) query.neq('login_id', env.ADMIN_LOGIN_ID);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return response.json({ data: data ?? [] });
  } catch (error) { return next(error); }
});

/** Licensed-source audit information and individual RAM observations. */
adminRouter.get('/market-data', async (request, response, next) => {
  try {
    const { ramSpec, collectedOn } = z.object({ ramSpec: z.string().trim().min(1).max(100).optional(), collectedOn: z.string().date().optional() }).parse(request.query);
    const runsQuery = adminSupabase.from('ram_market_collection_runs').select('id,scheduled_for,source,authorization_reference,status,target_per_spec,received_count,accepted_count,rejected_count,failure_reason,started_at,completed_at').eq('source', danawaResearchSource).order('scheduled_for', { ascending: false }).limit(30);
    let observationsQuery = adminSupabase.from('ram_market_observations').select('collected_on,ram_spec,ram_generation,capacity_gb,clock_mhz,price,source,source_product_id,source_product_name,source_url').eq('source', danawaResearchSource).order('collected_on', { ascending: false }).limit(100);
    if (ramSpec) observationsQuery = observationsQuery.eq('ram_spec', ramSpec);
    if (collectedOn) observationsQuery = observationsQuery.eq('collected_on', collectedOn);
    const [runs, observations] = await Promise.all([runsQuery, observationsQuery]);
    if (runs.error) throw runs.error;
    if (observations.error) throw observations.error;
    return response.set('Cache-Control', 'no-store').json({ data: { runs: runs.data ?? [], observations: observations.data ?? [] } });
  } catch (error) { return next(error); }
});

adminRouter.get('/suspensions', async (_request, response, next) => {
  try {
    await releaseExpiredSuspensions();
    const { data, error } = await adminSupabase
      .from('users')
      .select('id,login_id,nickname,status,suspended_until')
      .eq('status', 'suspended')
      .order('suspended_until', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return response.json({ data: data ?? [] });
  } catch (error) { return next(error); }
});

adminRouter.get('/reports', async (request, response, next) => {
  try {
    await releaseExpiredSuspensions();
    const { targetType } = reportFilter.parse(request.query);
    const { data, error } = await adminSupabase
      .from('reports')
      .select('id,target_type,product_id,product_title,created_at,reporter:users!reports_reporter_id_fkey(id,login_id,nickname),reportedUser:users!reports_reported_user_id_fkey(id,login_id,nickname,status,suspended_until),product:products!reports_product_id_fkey(id,title,description,asking_price,status)')
      .eq('target_type', targetType)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return response.json({ data: data ?? [] });
  } catch (error) { return next(error); }
});

adminRouter.delete('/reports/:reportId', async (request, response, next) => {
  try {
    const { data, error } = await adminSupabase.from('reports').delete().eq('id', request.params.reportId).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ error: '취소할 신고를 찾을 수 없습니다.' });
    return response.status(204).send();
  } catch (error) { return next(error); }
});

adminRouter.get('/inquiries', async (_request, response, next) => {
  try {
    const { data, error } = await adminSupabase
      .from('support_inquiries')
      .select('id,contact_label,status,created_at,updated_at,user:users!support_inquiries_user_id_fkey(id,login_id,nickname)')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return response.json({ data: data ?? [] });
  } catch (error) { return next(error); }
});

adminRouter.get('/inquiries/:inquiryId/messages', async (request, response, next) => {
  try {
    const { data: inquiry, error: inquiryError } = await adminSupabase.from('support_inquiries').select('id,contact_label,status').eq('id', request.params.inquiryId).maybeSingle();
    if (inquiryError) throw inquiryError;
    if (!inquiry) return response.status(404).json({ error: '문의 요청을 찾을 수 없습니다.' });
    const { data, error } = await adminSupabase.from('support_messages').select('id,sender_role,content,created_at').eq('inquiry_id', inquiry.id).order('created_at', { ascending: true });
    if (error) throw error;
    return response.set('Cache-Control', 'no-store').json({ data: { inquiry, messages: data ?? [] } });
  } catch (error) { return next(error); }
});

adminRouter.post('/inquiries/:inquiryId/messages', async (request, response, next) => {
  try {
    const { content } = z.object({ content: z.string().trim().min(1).max(2000) }).parse(request.body);
    const { data: inquiry, error: inquiryError } = await adminSupabase.from('support_inquiries').select('id,status').eq('id', request.params.inquiryId).maybeSingle();
    if (inquiryError) throw inquiryError;
    if (!inquiry) return response.status(404).json({ error: '문의 요청을 찾을 수 없습니다.' });
    if (inquiry.status === 'closed') return response.status(400).json({ error: '종료된 문의에는 답변할 수 없습니다.' });
    const { data, error } = await adminSupabase.from('support_messages').insert({ inquiry_id: inquiry.id, sender_role: 'admin', content }).select('id,sender_role,content,created_at').single();
    if (error) throw error;
    return response.status(201).json({ data });
  } catch (error) { return next(error); }
});

adminRouter.patch('/inquiries/:inquiryId/close', async (request, response, next) => {
  try {
    const { data, error } = await adminSupabase.from('support_inquiries').update({ status: 'closed' }).eq('id', request.params.inquiryId).select('id,status').maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ error: '문의 요청을 찾을 수 없습니다.' });
    const { error: messagesError } = await adminSupabase.from('support_messages').delete().eq('inquiry_id', data.id);
    if (messagesError) throw messagesError;
    return response.json({ data });
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

adminRouter.patch('/users/:userId/suspension', async (request, response, next) => {
  try {
    const { duration } = suspensionInput.parse(request.body);
    const data = await suspendUser(request.params.userId, duration);
    if (!data) return response.status(404).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    const { error: reportsError } = await adminSupabase.from('reports').delete().eq('reported_user_id', request.params.userId);
    if (reportsError) throw reportsError;
    return response.json({ data });
  } catch (error) { return next(error); }
});

adminRouter.delete('/users/:userId/suspension', async (request, response, next) => {
  try {
    const data = await cancelSuspension(request.params.userId);
    if (!data) return response.status(404).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    return response.json({ data });
  } catch (error) { return next(error); }
});

adminRouter.delete('/users/:userId', async (request, response, next) => {
  try {
    const { data: user, error: userError } = await adminSupabase.from('users').select('id').eq('id', request.params.userId).maybeSingle();
    if (userError) throw userError;
    if (!user) return response.status(404).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    const { error: reportsError } = await adminSupabase.from('reports').delete().eq('reported_user_id', user.id);
    if (reportsError) throw reportsError;
    await permanentlyDeleteAccount(user.id);
    return response.status(204).send();
  } catch (error) { return next(error); }
});
