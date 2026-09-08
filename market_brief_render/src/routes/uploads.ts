import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { Router } from 'express';
import { adminSupabase } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function normalizeMimeType(value: string) {
  const mimeType = value.split(';')[0].trim().toLowerCase();
  if (mimeType === 'image/jpg' || mimeType === 'image/pjpeg') return 'image/jpeg';
  return mimeType;
}

export const uploadsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

uploadsRouter.post(
  '/product-image',
  requireAuth,
  upload.single('image'),
  async (request, response, next) => {
    try {
      const requestedMimeType = typeof request.body?.mimeType === 'string' ? request.body.mimeType : '';
      const mimeType = normalizeMimeType(requestedMimeType || request.file?.mimetype || '');
      if (!acceptedMimeTypes.has(mimeType)) return response.status(415).json({ error: 'JPEG, PNG, WebP 사진만 업로드할 수 있습니다.' });
      if (!request.file?.buffer.length) return response.status(400).json({ error: '업로드할 사진을 찾을 수 없습니다.' });
      const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
      const path = `products/${request.userId}/${randomUUID()}.${extension}`;
      const { error } = await adminSupabase.storage.from('product-images').upload(path, request.file.buffer, { contentType: mimeType, upsert: false });
      if (error) throw error;
      return response.status(201).json({ data: { path } });
    } catch (error) {
      return next(error);
    }
  }
);
