import { randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import { adminSupabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const uploadsRouter = Router();

uploadsRouter.post(
  '/product-image',
  requireAuth,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }),
  async (request, response, next) => {
    try {
      const mimeType = request.header('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
      if (!acceptedMimeTypes.has(mimeType)) return response.status(415).json({ error: 'JPEG, PNG, WebP 사진만 업로드할 수 있습니다.' });
      if (!Buffer.isBuffer(request.body) || request.body.length === 0) return response.status(400).json({ error: '업로드할 사진을 찾을 수 없습니다.' });
      const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
      const path = `products/${request.userId}/${randomUUID()}.${extension}`;
      const { error } = await adminSupabase.storage.from('product-images').upload(path, request.body, { contentType: mimeType, upsert: false });
      if (error) throw error;
      return response.status(201).json({ data: { path } });
    } catch (error) {
      return next(error);
    }
  }
);
