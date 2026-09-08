import { randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import { adminSupabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function normalizeMimeType(value: string) {
  const mimeType = value.split(';')[0].trim().toLowerCase();
  if (mimeType === 'image/jpg' || mimeType === 'image/pjpeg') return 'image/jpeg';
  return mimeType;
}

export const uploadsRouter = Router();

uploadsRouter.post(
  '/product-image',
  requireAuth,
  // React Native may send the binary body as application/octet-stream even
  // when the selected asset is a JPEG or PNG. Read every binary content type
  // and validate the original MIME type from the explicit request header.
  express.raw({ type: '*/*', limit: '5mb' }),
  async (request, response, next) => {
    try {
      const mimeType = normalizeMimeType(request.header('x-image-mime-type') ?? request.header('content-type') ?? '');
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
