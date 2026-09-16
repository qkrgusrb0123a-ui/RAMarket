import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { adminSupabase } from '../lib/supabase.js';

const notificationParams = z.object({ notificationId: z.string().uuid() });

export const notificationsRouter = Router();

notificationsRouter.get('/', requireAuth, async (request, response, next) => {
  try {
    const { data, error } = await adminSupabase
      .from('user_notifications')
      .select('id,kind,title,body,payload,read_at,created_at')
      .eq('user_id', request.userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return response.json({ data: data ?? [] });
  } catch (error) { return next(error); }
});

notificationsRouter.patch('/:notificationId/read', requireAuth, async (request, response, next) => {
  try {
    const { notificationId } = notificationParams.parse(request.params);
    const { data, error } = await adminSupabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', request.userId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ error: 'Notification not found.' });
    return response.json({ data });
  } catch (error) { return next(error); }
});
