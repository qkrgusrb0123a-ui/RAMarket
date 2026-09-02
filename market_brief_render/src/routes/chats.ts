import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { supabaseForRequest } from '../lib/supabase.js';

export const chatsRouter = Router();

chatsRouter.get('/', requireAuth, async (request, response, next) => {
  try {
    const { data, error } = await supabaseForRequest(request)
      .from('chats')
      .select('id,product_id,buyer_id,seller_id,created_at,product:products(id,title,asking_price,status),messages(id,content,created_at,sender_id)')
      .or(`buyer_id.eq.${request.userId},seller_id.eq.${request.userId}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return response.json({ data });
  } catch (error) { return next(error); }
});

chatsRouter.post('/', requireAuth, async (request, response, next) => {
  try {
    const { productId } = z.object({ productId: z.string().uuid() }).parse(request.body);
    const supabase = supabaseForRequest(request);
    const { data: product, error: productError } = await supabase.from('products')
      .select('id,seller_id,status').eq('id', productId).eq('status', 'active').maybeSingle();
    if (productError) throw productError;
    if (!product) return response.status(404).json({ error: 'Active product not found.' });
    if (product.seller_id === request.userId) return response.status(400).json({ error: 'You cannot start a chat on your own product.' });
    const { data, error } = await supabase.from('chats').upsert({
      product_id: product.id, buyer_id: request.userId, seller_id: product.seller_id
    }, { onConflict: 'product_id,buyer_id' }).select().single();
    if (error) throw error;
    return response.status(201).json({ data });
  } catch (error) { return next(error); }
});

chatsRouter.get('/:chatId/messages', requireAuth, async (request, response, next) => {
  try {
    const { data, error } = await supabaseForRequest(request)
      .from('messages').select('id,sender_id,content,created_at').eq('chat_id', request.params.chatId).order('created_at');
    if (error) throw error;
    return response.json({ data });
  } catch (error) { return next(error); }
});

chatsRouter.post('/:chatId/messages', requireAuth, async (request, response, next) => {
  try {
    const { content } = z.object({ content: z.string().trim().min(1).max(2000) }).parse(request.body);
    const { data, error } = await supabaseForRequest(request)
      .from('messages').insert({ chat_id: request.params.chatId, sender_id: request.userId, content }).select().single();
    if (error) throw error;
    return response.status(201).json({ data });
  } catch (error) { return next(error); }
});
