import { adminSupabase } from '../lib/supabase.js';

/** Removes the data which references a user before deleting their Auth row. */
export async function permanentlyDeleteAccount(userId: string) {
  const { data: ownedProducts, error: productsError } = await adminSupabase
    .from('products')
    .select('id')
    .eq('seller_id', userId);
  if (productsError) throw productsError;

  // Messages reference both users and products with restrictive foreign keys.
  // Delete them first so an account or one of its listings can be removed.
  const { error: messagesError } = await adminSupabase
    .from('messages')
    .delete()
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
  if (messagesError) throw messagesError;

  const productIds = (ownedProducts ?? []).map((product) => product.id);
  if (productIds.length) {
    const { error } = await adminSupabase.from('products').delete().in('id', productIds);
    if (error) throw error;
  }

  const { error } = await adminSupabase.auth.admin.deleteUser(userId);
  if (error) throw error;
}
