import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { supabaseForRequest } from '../lib/supabase.js';

const productInput = z.object({
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().min(1).max(5000),
  category: z.string().trim().min(1).max(80),
  condition: z.enum(['new', 'like_new', 'good', 'fair']),
  askingPrice: z.coerce.number().int().nonnegative(),
  imagePaths: z.array(z.string().trim().min(1).max(500)).max(8).default([])
});

const productUpdateInput = productInput.extend({
  status: z.enum(['active', 'reserved', 'sold', 'hidden']).optional()
});

export const productsRouter = Router();

productsRouter.get('/', async (request, response, next) => {
  try {
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(request.query.limit) || 20));
    const category = typeof request.query.category === 'string' ? request.query.category : undefined;
    const query = typeof request.query.q === 'string' ? request.query.q.trim() : undefined;
    let statement = supabaseForRequest(request)
      .from('products')
      .select('id,title,description,category,condition,asking_price,status,created_at,seller:users!products_seller_id_fkey(id,nickname,avatar_url),products_images(path,sort_order)', { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (category) statement = statement.eq('category', category);
    if (query) statement = statement.ilike('title', `%${query}%`);
    const { data, count, error } = await statement;
    if (error) throw error;
    return response.json({ data, page, limit, total: count ?? 0 });
  } catch (error) { return next(error); }
});

productsRouter.get('/:productId', async (request, response, next) => {
  try {
    const { data, error } = await supabaseForRequest(request)
      .from('products')
      .select('id,title,description,category,condition,asking_price,status,created_at,seller:users!products_seller_id_fkey(id,nickname,avatar_url),products_images(path,sort_order)')
      .eq('id', request.params.productId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ error: 'Product not found.' });
    return response.json({ data });
  } catch (error) { return next(error); }
});

productsRouter.post('/', requireAuth, async (request, response, next) => {
  try {
    const input = productInput.parse(request.body);
    const supabase = supabaseForRequest(request);
    const { data: product, error } = await supabase.from('products').insert({
      seller_id: request.userId,
      title: input.title,
      description: input.description,
      category: input.category,
      condition: input.condition,
      asking_price: input.askingPrice
    }).select().single();
    if (error) throw error;
    if (input.imagePaths.length) {
      const { error: imageError } = await supabase.from('products_images').insert(
        input.imagePaths.map((path, sortOrder) => ({ product_id: product.id, path, sort_order: sortOrder }))
      );
      if (imageError) throw imageError;
    }
    return response.status(201).json({ data: product });
  } catch (error) { return next(error); }
});

productsRouter.patch('/:productId', requireAuth, async (request, response, next) => {
  try {
    const input = productUpdateInput.parse(request.body);
    const supabase = supabaseForRequest(request);
    const { data: currentProduct, error: currentProductError } = await supabase
      .from('products')
      .select('id')
      .eq('id', request.params.productId)
      .maybeSingle();
    if (currentProductError) throw currentProductError;
    if (!currentProduct) return response.status(404).json({ error: 'Product not found.' });

    const { data: product, error } = await supabase
      .from('products')
      .update({
        title: input.title,
        description: input.description,
        category: input.category,
        condition: input.condition,
        asking_price: input.askingPrice,
        ...(input.status ? { status: input.status } : {})
      })
      .eq('id', request.params.productId)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!product) return response.status(404).json({ error: 'Product not found.' });

    const { error: deleteImagesError } = await supabase
      .from('products_images')
      .delete()
      .eq('product_id', request.params.productId);
    if (deleteImagesError) throw deleteImagesError;
    if (input.imagePaths.length) {
      const { error: insertImagesError } = await supabase.from('products_images').insert(
        input.imagePaths.map((path, sortOrder) => ({ product_id: product.id, path, sort_order: sortOrder }))
      );
      if (insertImagesError) throw insertImagesError;
    }
    return response.json({ data: product });
  } catch (error) { return next(error); }
});

productsRouter.patch('/:productId/status', requireAuth, async (request, response, next) => {
  try {
    const { status } = z.object({ status: z.enum(['active', 'reserved', 'sold', 'hidden']) }).parse(request.body);
    const { data, error } = await supabaseForRequest(request)
      .from('products').update({ status }).eq('id', request.params.productId).select().maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ error: 'Product not found.' });
    return response.json({ data });
  } catch (error) { return next(error); }
});
