import { Router } from 'express';
import { z } from 'zod';
import { adminSupabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const messageInput = z.object({ content: z.string().trim().min(1).max(2000) });

async function messagesForInquiry(inquiryId: string) {
  const { data, error } = await adminSupabase
    .from('support_messages')
    .select('id,sender_role,content,created_at')
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export const supportRouter = Router();

supportRouter.get('/thread', requireAuth, async (request, response, next) => {
  try {
    const { data: inquiry, error } = await adminSupabase
      .from('support_inquiries')
      .select('id,status,created_at,updated_at')
      .eq('user_id', request.userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return response.set('Cache-Control', 'no-store').json({ data: inquiry ? { ...inquiry, messages: await messagesForInquiry(inquiry.id) } : null });
  } catch (error) { return next(error); }
});

supportRouter.post('/messages', requireAuth, async (request, response, next) => {
  try {
    const { content } = messageInput.parse(request.body);
    const { data: user, error: userError } = await adminSupabase.from('users').select('nickname,login_id').eq('id', request.userId).maybeSingle();
    if (userError) throw userError;
    if (!user) return response.status(404).json({ error: '사용자 계정을 찾을 수 없습니다.' });
    const { data: activeInquiry, error: inquiryLookupError } = await adminSupabase
      .from('support_inquiries')
      .select('id')
      .eq('user_id', request.userId)
      .eq('status', 'open')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (inquiryLookupError) throw inquiryLookupError;
    let inquiryId = activeInquiry?.id;
    if (!inquiryId) {
      const { data: inquiry, error: inquiryError } = await adminSupabase
        .from('support_inquiries')
        .insert({ user_id: request.userId, contact_label: user.nickname || user.login_id })
        .select('id')
        .single();
      if (inquiryError) throw inquiryError;
      inquiryId = inquiry.id;
    }
    const { data, error } = await adminSupabase
      .from('support_messages')
      .insert({ inquiry_id: inquiryId, sender_role: 'user', content })
      .select('id,sender_role,content,created_at')
      .single();
    if (error) throw error;
    return response.status(201).json({ data });
  } catch (error) { return next(error); }
});
