import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { adminSupabase } from '../lib/supabase.js';
import { requireAdmin } from '../middleware/admin-auth.js';
import { permanentlyDeleteAccount } from '../services/account-removal.js';
import { cancelSuspension, releaseExpiredSuspensions, suspendUser, suspensionDurations } from '../services/suspensions.js';

const reportFilter = z.object({ targetType: z.enum(['product', 'chat']).optional(), status: z.enum(['received', 'reviewing', 'resolved', 'rejected']).optional() });
const suspensionInput = z.object({ duration: z.enum(suspensionDurations), reason: z.string().trim().min(2).max(500).optional() });
const reportResolutionInput = z.object({ status: z.enum(['reviewing', 'resolved', 'rejected']), reason: z.string().trim().min(2).max(1000) });
const listingQuery = z.object({ keyword: z.string().trim().max(100).optional(), seller: z.string().trim().max(100).optional(), status: z.enum(['active', 'reserved', 'sold', 'hidden']).optional(), minPrice: z.coerce.number().int().min(0).optional(), maxPrice: z.coerce.number().int().min(0).optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional() });

function actor(request: import('express').Request) { return env.ADMIN_LOGIN_ID ?? 'administrator'; }
function role(request: import('express').Request) { return request.adminRole ?? 'viewer'; }
function canWrite(request: import('express').Request, response: import('express').Response) { if (role(request) === 'viewer') { response.status(403).json({ error: '조회 전용 관리자는 변경할 수 없습니다.' }); return false; } return true; }
function isSuperAdmin(request: import('express').Request, response: import('express').Response) { if (role(request) !== 'super_admin') { response.status(403).json({ error: '최고관리자 권한이 필요합니다.' }); return false; } return true; }
async function audit(request: import('express').Request, action: string, targetType: string, targetId?: string, reason?: string, metadata: Record<string, unknown> = {}) {
  const { error } = await adminSupabase.from('admin_audit_logs').insert({ admin_id: actor(request), admin_role: role(request), action, target_type: targetType, target_id: targetId ?? null, reason: reason ?? null, metadata });
  if (error) throw error;
}

export const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get('/dashboard', async (_request, response, next) => {
  try {
    await releaseExpiredSuspensions();
    const since = new Date(Date.now() - 6 * 86_400_000).toISOString();
    const [reports, inquiries, users, products, sanctions, recentReports] = await Promise.all([
      adminSupabase.from('reports').select('*', { count: 'exact', head: true }).in('status', ['received', 'reviewing']),
      adminSupabase.from('support_inquiries').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      adminSupabase.from('users').select('created_at').gte('created_at', since),
      adminSupabase.from('products').select('created_at,status').gte('created_at', since),
      adminSupabase.from('user_sanctions').select('id,action,reason,starts_at,ends_at,user:users!user_sanctions_user_id_fkey(login_id,nickname)').order('created_at', { ascending: false }).limit(5),
      adminSupabase.from('reports').select('id,status,product_title,created_at').order('created_at', { ascending: false }).limit(5)
    ]);
    for (const result of [reports, inquiries, users, products, sanctions, recentReports]) if (result.error) throw result.error;
    const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(Date.now() - (6 - index) * 86_400_000); return date.toISOString().slice(0, 10); });
    const daily = days.map((day) => ({ day, signups: (users.data ?? []).filter((item) => item.created_at.slice(0, 10) === day).length, listings: (products.data ?? []).filter((item) => item.created_at.slice(0, 10) === day).length, sold: (products.data ?? []).filter((item) => item.created_at.slice(0, 10) === day && item.status === 'sold').length }));
    return response.json({ data: { pendingReports: reports.count ?? 0, pendingInquiries: inquiries.count ?? 0, daily, recentSanctions: sanctions.data ?? [], recentReports: recentReports.data ?? [] } });
  } catch (error) { return next(error); }
});

adminRouter.get('/audit-logs', async (_request, response, next) => { try { const { data, error } = await adminSupabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(100); if (error) throw error; return response.json({ data: data ?? [] }); } catch (error) { return next(error); } });

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
    const { targetType, status } = reportFilter.parse(request.query);
    let statement = adminSupabase
      .from('reports')
      .select('id,target_type,product_id,product_title,status,resolution_reason,processed_at,created_at,reporter:users!reports_reporter_id_fkey(id,login_id,nickname),reportedUser:users!reports_reported_user_id_fkey(id,login_id,nickname,status,suspended_until),product:products!reports_product_id_fkey(id,title,description,asking_price,status)')
      .order('created_at', { ascending: false });
    if (targetType) statement = statement.eq('target_type', targetType);
    if (status) statement = statement.eq('status', status);
    const { data, error } = await statement;
    if (error) throw error;
    return response.json({ data: data ?? [] });
  } catch (error) { return next(error); }
});

adminRouter.delete('/reports/:reportId', async (request, response, next) => {
  try {
    if (!canWrite(request, response)) return;
    const { data, error } = await adminSupabase.from('reports').update({ status: 'rejected', handler_id: actor(request), resolution_reason: '관리자 검토에서 반려', processed_at: new Date().toISOString() }).eq('id', request.params.reportId).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ error: '취소할 신고를 찾을 수 없습니다.' });
    await audit(request, 'report.rejected', 'report', data.id, '관리자 검토에서 반려');
    return response.status(204).send();
  } catch (error) { return next(error); }
});

adminRouter.patch('/reports/:reportId', async (request, response, next) => {
  try {
    if (!canWrite(request, response)) return;
    const input = reportResolutionInput.parse(request.body);
    const processed = input.status === 'resolved' || input.status === 'rejected';
    const { data, error } = await adminSupabase.from('reports').update({ status: input.status, handler_id: actor(request), resolution_reason: input.reason, processed_at: processed ? new Date().toISOString() : null, result_notified_at: processed ? new Date().toISOString() : null }).eq('id', request.params.reportId).select('id,reporter_id').maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ error: '신고 요청을 찾을 수 없습니다.' });
    if (processed && data.reporter_id) {
      const outcome = input.status === 'resolved' ? '처리 완료' : '반려';
      const { error: notificationError } = await adminSupabase.from('user_notifications').insert({ user_id: data.reporter_id, kind: 'report_result', title: `신고 ${outcome}`, body: input.reason, payload: { reportId: data.id, status: input.status } });
      if (notificationError) throw notificationError;
    }
    await audit(request, `report.${input.status}`, 'report', data.id, input.reason);
    return response.json({ data });
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

adminRouter.get('/products', async (request, response, next) => {
  try {
    const input = listingQuery.parse(request.query);
    const [all, active, reserved, sold] = await Promise.all([
      adminSupabase.from('products').select('*', { count: 'exact', head: true }),
      adminSupabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      adminSupabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'reserved'),
      adminSupabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'sold')
    ]);
    for (const result of [all, active, reserved, sold]) if (result.error) throw result.error;
    let statement = adminSupabase.from('products').select('id,title,description,category,asking_price,status,created_at,blinded_at,blinded_reason,anomaly_flags,seller:users!products_seller_id_fkey(id,login_id,nickname)').order('created_at', { ascending: false }).limit(100);
    if (input.status) statement = statement.eq('status', input.status);
    if (input.minPrice !== undefined) statement = statement.gte('asking_price', input.minPrice);
    if (input.maxPrice !== undefined) statement = statement.lte('asking_price', input.maxPrice);
    if (input.from) statement = statement.gte('created_at', input.from);
    if (input.to) statement = statement.lte('created_at', input.to);
    if (input.keyword) statement = statement.or(`title.ilike.%${input.keyword}%,description.ilike.%${input.keyword}%`);
    const { data, error } = await statement;
    if (error) throw error;
    const items = (data ?? []).filter((item) => !input.seller || JSON.stringify(item.seller).toLowerCase().includes(input.seller!.toLowerCase()));
    return response.json({ data: items, stats: { total: all.count ?? 0, active: active.count ?? 0, reserved: reserved.count ?? 0, sold: sold.count ?? 0 } });
  } catch (error) { return next(error); }
});

adminRouter.delete('/products/:productId/permanent', async (request, response, next) => {
  try {
    if (!isSuperAdmin(request, response)) return;
    const productId = request.params.productId;
    const { data: product, error: lookupError } = await adminSupabase.from('products').select('id,title').eq('id', productId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!product) return response.status(404).json({ error: '삭제할 판매글을 찾을 수 없습니다.' });
    const { error: messageError } = await adminSupabase.from('messages').delete().eq('product_id', productId);
    if (messageError) throw messageError;
    const { error } = await adminSupabase.from('products').delete().eq('id', productId);
    if (error) throw error;
    await audit(request, 'product.deleted', 'product', productId, '최고관리자 영구 삭제', { title: product.title });
    return response.status(204).send();
  } catch (error) { return next(error); }
});

adminRouter.patch('/products/:productId/blind', async (request, response, next) => {
  try {
    if (!canWrite(request, response)) return;
    const { blind, reason } = z.object({ blind: z.boolean(), reason: z.string().trim().min(2).max(500).optional() }).parse(request.body);
    if (blind && !reason) return response.status(400).json({ error: '블라인드 사유를 입력해 주세요.' });
    const { data: current, error: currentError } = await adminSupabase.from('products').select('id,status,status_before_blind').eq('id', request.params.productId).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return response.status(404).json({ error: '판매글을 찾을 수 없습니다.' });
    const previousStatus = current.status === 'hidden' ? current.status_before_blind ?? 'active' : current.status;
    const { data, error } = await adminSupabase.from('products').update(blind ? { status: 'hidden', status_before_blind: previousStatus, blinded_at: new Date().toISOString(), blinded_reason: reason, blinded_by: actor(request) } : { status: previousStatus, status_before_blind: null, blinded_at: null, blinded_reason: null, blinded_by: null }).eq('id', request.params.productId).select('id,seller_id,status').maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ error: '판매글을 찾을 수 없습니다.' });
    await adminSupabase.from('user_notifications').insert({ user_id: data.seller_id, kind: blind ? 'listing_blinded' : 'listing_restored', title: blind ? '판매글이 임시 숨김 처리되었습니다.' : '판매글이 복구되었습니다.', body: reason ?? '관리자 검토 결과 판매글을 복구했습니다.', payload: { productId: data.id } });
    await audit(request, blind ? 'product.blinded' : 'product.restored', 'product', data.id, reason);
    return response.json({ data });
  } catch (error) { return next(error); }
});

adminRouter.get('/users/:userId/detail', async (request, response, next) => {
  try {
    await releaseExpiredSuspensions();
    const userId = request.params.userId;
    const [user, products, sold, received, filed, sanctions] = await Promise.all([
      adminSupabase.from('users').select('id,login_id,nickname,status,suspended_until,created_at').eq('id', userId).maybeSingle(),
      adminSupabase.from('products').select('*', { count: 'exact', head: true }).eq('seller_id', userId),
      adminSupabase.from('products').select('*', { count: 'exact', head: true }).eq('seller_id', userId).eq('status', 'sold'),
      adminSupabase.from('reports').select('*', { count: 'exact', head: true }).eq('reported_user_id', userId),
      adminSupabase.from('reports').select('*', { count: 'exact', head: true }).eq('reporter_id', userId),
      adminSupabase.from('user_sanctions').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    ]);
    for (const result of [user, products, sold, received, filed, sanctions]) if (result.error) throw result.error;
    if (!user.data) return response.status(404).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    return response.json({ data: { ...user.data, listingCount: products.count ?? 0, completedTrades: sold.count ?? 0, reportsReceived: received.count ?? 0, reportsFiled: filed.count ?? 0, sanctions: sanctions.data ?? [] } });
  } catch (error) { return next(error); }
});

adminRouter.delete('/products/:productId', async (request, response, next) => {
  try {
    if (!isSuperAdmin(request, response)) return;
    const { data, error } = await adminSupabase.from('products').update({ status: 'hidden', blinded_at: new Date().toISOString(), blinded_reason: '최고관리자 보존 조치', blinded_by: actor(request) }).eq('id', request.params.productId).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ error: '판매글을 찾을 수 없습니다.' });
    await audit(request, 'product.blinded', 'product', data.id, '기존 삭제 API의 보존형 블라인드 전환');
    return response.status(204).send();
  } catch (error) { return next(error); }
});

adminRouter.patch('/users/:userId/suspension', async (request, response, next) => {
  try {
    if (!canWrite(request, response)) return;
    const { duration, reason } = suspensionInput.parse(request.body);
    const data = await suspendUser(request.params.userId, duration);
    if (!data) return response.status(404).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    const { error: sanctionError } = await adminSupabase.from('user_sanctions').insert({ user_id: request.params.userId, action: 'suspension', reason: reason ?? null, ends_at: data.suspended_until, handled_by: actor(request) });
    if (sanctionError) throw sanctionError;
    await audit(request, 'user.suspended', 'user', request.params.userId, reason, { duration, endsAt: data.suspended_until });
    return response.json({ data });
  } catch (error) { return next(error); }
});

adminRouter.delete('/users/:userId/suspension', async (request, response, next) => {
  try {
    if (!canWrite(request, response)) return;
    const data = await cancelSuspension(request.params.userId);
    if (!data) return response.status(404).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    await adminSupabase.from('user_sanctions').insert({ user_id: request.params.userId, action: 'release', handled_by: actor(request) });
    await audit(request, 'user.suspension_released', 'user', request.params.userId);
    return response.json({ data });
  } catch (error) { return next(error); }
});

adminRouter.delete('/users/:userId', async (request, response, next) => {
  try {
    if (!isSuperAdmin(request, response)) return;
    const { data: user, error: userError } = await adminSupabase.from('users').select('id').eq('id', request.params.userId).maybeSingle();
    if (userError) throw userError;
    if (!user) return response.status(404).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    const { error: reportsError } = await adminSupabase.from('reports').delete().eq('reported_user_id', user.id);
    if (reportsError) throw reportsError;
    await permanentlyDeleteAccount(user.id);
    await audit(request, 'user.deleted', 'user', user.id, '최고관리자 영구 삭제');
    return response.status(204).send();
  } catch (error) { return next(error); }
});

adminRouter.get('/banned-terms', async (_request, response, next) => { try { const { data, error } = await adminSupabase.from('banned_terms').select('*').order('created_at', { ascending: false }); if (error) throw error; return response.json({ data: data ?? [] }); } catch (error) { return next(error); } });
adminRouter.post('/banned-terms', async (request, response, next) => { try { if (!canWrite(request, response)) return; const input = z.object({ pattern: z.string().trim().min(2).max(200), category: z.enum(['profanity', 'external_trade', 'contact', 'account', 'custom']).default('custom') }).parse(request.body); const { data, error } = await adminSupabase.from('banned_terms').insert({ ...input, created_by: actor(request) }).select('*').single(); if (error) throw error; await audit(request, 'banned_term.created', 'banned_term', data.id, input.pattern); return response.status(201).json({ data }); } catch (error) { return next(error); } });

adminRouter.get('/market/masters', async (_request, response, next) => { try { const { data, error } = await adminSupabase.from('product_masters').select('*').order('created_at', { ascending: false }); if (error) throw error; return response.json({ data: data ?? [] }); } catch (error) { return next(error); } });
adminRouter.post('/market/masters', async (request, response, next) => { try { if (!canWrite(request, response)) return; const input = z.object({ manufacturer: z.string().trim().min(1).max(100), generation: z.enum(['DDR4', 'DDR5']), capacityGb: z.number().int().positive().max(128), clockMhz: z.number().int().positive().max(10000).nullable().optional(), modelName: z.string().trim().min(1).max(150), aliases: z.array(z.string().trim().min(1).max(100)).max(20).default([]) }).parse(request.body); const { data, error } = await adminSupabase.from('product_masters').insert({ manufacturer: input.manufacturer, generation: input.generation, capacity_gb: input.capacityGb, clock_mhz: input.clockMhz ?? null, model_name: input.modelName, aliases: input.aliases }).select('*').single(); if (error) throw error; await audit(request, 'master.created', 'product_master', data.id, data.model_name); return response.status(201).json({ data }); } catch (error) { return next(error); } });
adminRouter.get('/market/normalization-queue', async (_request, response, next) => { try { const { data, error } = await adminSupabase.from('product_normalization_queue').select('*,product:products(id,title,category),suggestedMaster:product_masters(id,model_name)').eq('status', 'pending').order('created_at'); if (error) throw error; return response.json({ data: data ?? [] }); } catch (error) { return next(error); } });
adminRouter.patch('/market/normalization-queue/:queueId', async (request, response, next) => { try { if (!canWrite(request, response)) return; const input = z.object({ masterId: z.string().uuid().nullable(), status: z.enum(['mapped', 'excluded']) }).parse(request.body); const { data, error } = await adminSupabase.from('product_normalization_queue').update({ suggested_master_id: input.masterId, status: input.status, handled_by: actor(request), handled_at: new Date().toISOString() }).eq('id', request.params.queueId).select('id,product_id').maybeSingle(); if (error) throw error; if (!data) return response.status(404).json({ error: '정규화 대기 항목을 찾을 수 없습니다.' }); if (input.status === 'mapped' && input.masterId) { const { error: productError } = await adminSupabase.from('products').update({ normalized_master_id: input.masterId }).eq('id', data.product_id); if (productError) throw productError; } await audit(request, `normalization.${input.status}`, 'normalization_queue', data.id); return response.json({ data }); } catch (error) { return next(error); } });
adminRouter.get('/market/policy', async (_request, response, next) => { try { const { data, error } = await adminSupabase.from('price_calculation_policies').select('*').eq('id', true).single(); if (error) throw error; return response.json({ data }); } catch (error) { return next(error); } });
adminRouter.patch('/market/policy', async (request, response, next) => { try { if (!canWrite(request, response)) return; const input = z.object({ aggregateMethod: z.enum(['average', 'median']), windowDays: z.number().int().min(1).max(365), minimumSamples: z.number().int().min(1).max(100) }).parse(request.body); const { data, error } = await adminSupabase.from('price_calculation_policies').update({ aggregate_method: input.aggregateMethod, window_days: input.windowDays, minimum_samples: input.minimumSamples, updated_by: actor(request), updated_at: new Date().toISOString() }).eq('id', true).select('*').single(); if (error) throw error; await audit(request, 'price_policy.updated', 'price_policy', 'default', undefined, input); return response.json({ data }); } catch (error) { return next(error); } });
adminRouter.get('/market/recalculation-runs', async (_request, response, next) => { try { const { data, error } = await adminSupabase.from('price_recalculation_runs').select('*').order('created_at', { ascending: false }).limit(30); if (error) throw error; return response.json({ data: data ?? [] }); } catch (error) { return next(error); } });
adminRouter.post('/market/recalculate', async (request, response, next) => { try { if (!canWrite(request, response)) return; const { data, error } = await adminSupabase.from('price_recalculation_runs').insert({ requested_by: actor(request), status: 'queued' }).select('*').single(); if (error) throw error; await audit(request, 'price_recalculation.queued', 'price_recalculation', data.id); return response.status(202).json({ data }); } catch (error) { return next(error); } });

adminRouter.get('/chat-flags', async (request, response, next) => { try { const { status } = z.object({ status: z.enum(['open', 'reviewed', 'dismissed']).optional() }).parse(request.query); let statement = adminSupabase.from('chat_detection_flags').select('*,message:messages(id,content,created_at,sender:users!messages_sender_id_fkey(id,login_id,nickname),recipient:users!messages_recipient_id_fkey(id,login_id,nickname))').order('created_at', { ascending: false }).limit(100); if (status) statement = statement.eq('status', status); const { data, error } = await statement; if (error) throw error; return response.json({ data: data ?? [] }); } catch (error) { return next(error); } });
adminRouter.patch('/chat-flags/:flagId', async (request, response, next) => { try { if (!canWrite(request, response)) return; const { status, reason } = z.object({ status: z.enum(['reviewed', 'dismissed']), reason: z.string().trim().min(2).max(500) }).parse(request.body); const { data, error } = await adminSupabase.from('chat_detection_flags').update({ status }).eq('id', request.params.flagId).select('id').maybeSingle(); if (error) throw error; if (!data) return response.status(404).json({ error: '채팅 탐지 항목을 찾을 수 없습니다.' }); await audit(request, `chat_flag.${status}`, 'chat_flag', data.id, reason); return response.json({ data }); } catch (error) { return next(error); } });

adminRouter.post('/announcements', async (request, response, next) => {
  try {
    if (!canWrite(request, response)) return;
    const input = z.object({ title: z.string().trim().min(2).max(200), body: z.string().trim().min(2).max(2000) }).parse(request.body);
    const { data: content, error: contentError } = await adminSupabase.from('content_items').insert({ kind: 'notice', title: input.title, body: input.body, audience: 'all', active: true, published_at: new Date().toISOString(), created_by: actor(request) }).select('id').single();
    if (contentError) throw contentError;
    const { data: users, error: usersError } = await adminSupabase.from('users').select('id');
    if (usersError) throw usersError;
    if (users?.length) {
      const { error: notificationError } = await adminSupabase.from('user_notifications').insert(users.map((user) => ({ user_id: user.id, kind: 'announcement', title: input.title, body: input.body, payload: { contentId: content.id } })));
      if (notificationError) throw notificationError;
    }
    await audit(request, 'announcement.sent', 'content', content.id, input.title, { recipients: users?.length ?? 0 });
    return response.status(201).json({ data: { id: content.id, recipients: users?.length ?? 0 } });
  } catch (error) { return next(error); }
});
adminRouter.get('/content', async (_request, response, next) => { try { const { data, error } = await adminSupabase.from('content_items').select('*').order('updated_at', { ascending: false }); if (error) throw error; return response.json({ data: data ?? [] }); } catch (error) { return next(error); } });
adminRouter.post('/content', async (request, response, next) => { try { if (!canWrite(request, response)) return; const input = z.object({ kind: z.enum(['notice', 'popup', 'banner', 'faq', 'terms', 'privacy']), title: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(10000), audience: z.string().trim().min(1).max(100).default('all'), active: z.boolean().default(true) }).parse(request.body); const { data, error } = await adminSupabase.from('content_items').insert({ kind: input.kind, title: input.title, body: input.body, audience: input.audience, active: input.active, published_at: input.active ? new Date().toISOString() : null, created_by: actor(request) }).select('*').single(); if (error) throw error; await adminSupabase.from('content_revisions').insert({ content_id: data.id, revision: 1, title: data.title, body: data.body, changed_by: actor(request) }); await audit(request, 'content.created', 'content', data.id, data.title); return response.status(201).json({ data }); } catch (error) { return next(error); } });
