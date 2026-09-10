import { adminSupabase } from '../lib/supabase.js';

export const suspensionDurations = ['1d', '3d', '7d', '30d', '1y', 'permanent'] as const;
export type SuspensionDuration = typeof suspensionDurations[number];

const durationMilliseconds: Record<Exclude<SuspensionDuration, 'permanent'>, number> = {
  '1d': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000
};

function endTimeFor(duration: SuspensionDuration) {
  return duration === 'permanent' ? null : new Date(Date.now() + durationMilliseconds[duration]).toISOString();
}

/** Makes expired temporary suspensions active again. Permanent suspensions have no end time. */
export async function releaseExpiredSuspensions() {
  const { error } = await adminSupabase
    .from('users')
    .update({ status: 'active', suspended_until: null })
    .eq('status', 'suspended')
    .not('suspended_until', 'is', null)
    .lte('suspended_until', new Date().toISOString());
  if (error) throw error;
}

export async function isUserSuspended(userId: string) {
  const { data, error } = await adminSupabase
    .from('users')
    .select('status,suspended_until')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return true;
  if (data.status !== 'suspended') return false;
  if (data.suspended_until && new Date(data.suspended_until).getTime() <= Date.now()) {
    const { error: updateError } = await adminSupabase.from('users').update({ status: 'active', suspended_until: null }).eq('id', userId);
    if (updateError) throw updateError;
    return false;
  }
  return true;
}

export async function suspendUser(userId: string, duration: SuspensionDuration) {
  const { data, error } = await adminSupabase
    .from('users')
    .update({ status: 'suspended', suspended_until: endTimeFor(duration) })
    .eq('id', userId)
    .select('id,status,suspended_until')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function cancelSuspension(userId: string) {
  const { data, error } = await adminSupabase
    .from('users')
    .update({ status: 'active', suspended_until: null })
    .eq('id', userId)
    .select('id,status,suspended_until')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function startSuspensionExpiryWorker() {
  const release = () => releaseExpiredSuspensions().catch((error) => console.error('Unable to release expired suspensions:', error));
  release();
  const interval = setInterval(release, 60_000);
  interval.unref();
}
