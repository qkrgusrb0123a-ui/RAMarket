import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { supabaseForRequest } from '../lib/supabase.js';

const messageQuery = z.object({
  productId: z.string().uuid().optional(),
  otherUserId: z.string().uuid().optional()
});

const messageInput = z.object({
  productId: z.string().uuid(),
  recipientId: z.string().uuid(),
  content: z.string().trim().min(1).max(2000)
});

export const messagesRouter = Router();

messagesRouter.get('/', requireAuth, async (request, response, next) => {
  try {
    const { productId, otherUserId } = messageQuery.parse(request.query);
    let statement = supabaseForRequest(request)
      .from('messages')
      .select('id,product_id,sender_id,recipient_id,content,created_at')
      .order('created_at', { ascending: true });
    if (productId) statement = statement.eq('product_id', productId);
    if (otherUserId) {
      statement = statement.or(
        `and(sender_id.eq.${request.userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${request.userId})`
      );
    }
    const { data, error } = await statement;
    if (error) throw error;
    return response.json({ data });
  } catch (error) { return next(error); }
});

messagesRouter.post('/', requireAuth, async (request, response, next) => {
  try {
    const input = messageInput.parse(request.body);
    const supabase = supabaseForRequest(request);
    const { data: product, error: productError } = await supabase
      .from('products').select('seller_id').eq('id', input.productId).maybeSingle();
    if (productError) throw productError;
    if (!product) return response.status(404).json({ error: 'Product not found.' });
    if (request.userId !== product.seller_id && input.recipientId !== product.seller_id) {
      return response.status(400).json({ error: 'Messages about a product must be sent to its seller.' });
    }
    const { data, error } = await supabase.from('messages').insert({
      product_id: input.productId,
      sender_id: request.userId,
      recipient_id: input.recipientId,
      content: input.content
    }).select().single();
    if (error) throw error;
    return response.status(201).json({ data });
  } catch (error) { return next(error); }
});
