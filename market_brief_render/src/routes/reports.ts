import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { adminSupabase } from '../lib/supabase.js';

const reportInput = z.object({
  targetType: z.enum(['product', 'chat']),
  productId: z.string().uuid(),
  reportedUserId: z.string().uuid()
});

export const reportsRouter = Router();

reportsRouter.post('/', requireAuth, async (request, response, next) => {
  try {
    const input = reportInput.parse(request.body);
    if (input.reportedUserId === request.userId) return response.status(400).json({ error: '본인 계정은 신고할 수 없습니다.' });

    const { data: product, error: productError } = await adminSupabase
      .from('products')
      .select('id,title,seller_id')
      .eq('id', input.productId)
      .maybeSingle();
    if (productError) throw productError;
    if (!product) return response.status(404).json({ error: '신고할 판매글을 찾을 수 없습니다.' });

    if (input.targetType === 'product' && product.seller_id !== input.reportedUserId) {
      return response.status(400).json({ error: '판매글의 판매자만 신고할 수 있습니다.' });
    }
    if (input.targetType === 'chat') {
      const { data: message, error: messageError } = await adminSupabase
        .from('messages')
        .select('id')
        .eq('product_id', input.productId)
        .or(`and(sender_id.eq.${request.userId},recipient_id.eq.${input.reportedUserId}),and(sender_id.eq.${input.reportedUserId},recipient_id.eq.${request.userId})`)
        .limit(1)
        .maybeSingle();
      if (messageError) throw messageError;
      if (!message) return response.status(400).json({ error: '참여 중인 1:1 채팅만 신고할 수 있습니다.' });
    }

    const { data: existing, error: existingError } = await adminSupabase
      .from('reports')
      .select('id')
      .eq('target_type', input.targetType)
      .eq('reporter_id', request.userId)
      .eq('reported_user_id', input.reportedUserId)
      .eq('product_id', input.productId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return response.json({ data: { id: existing.id, alreadyReported: true } });

    const { data, error } = await adminSupabase.from('reports').insert({
      target_type: input.targetType,
      reporter_id: request.userId,
      reported_user_id: input.reportedUserId,
      product_id: input.productId,
      product_title: product.title
    }).select('id').single();
    if (error) throw error;
    return response.status(201).json({ data: { id: data.id, alreadyReported: false } });
  } catch (error) { return next(error); }
});
