import type { AuthSession } from './auth';
import { removeItem, getItem, setItem } from './local-storage';

const sessionKey = 'ramarket.auth.session';
export async function loadSession(): Promise<AuthSession | null> {
  const saved = await getItem(sessionKey);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as AuthSession;
  } catch {
    await removeItem(sessionKey);
    return null;
  }
}

export function saveSession(session: AuthSession) {
  return setItem(sessionKey, JSON.stringify(session));
}

export function clearSession() {
  return removeItem(sessionKey);
}
