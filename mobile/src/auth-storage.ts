import * as SecureStore from 'expo-secure-store';
import type { AuthSession } from './auth';

const sessionKey = 'ramarket.auth.session';
const storageOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export async function loadSession(): Promise<AuthSession | null> {
  const saved = await SecureStore.getItemAsync(sessionKey, storageOptions);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as AuthSession;
  } catch {
    await SecureStore.deleteItemAsync(sessionKey, storageOptions);
    return null;
  }
}

export function saveSession(session: AuthSession) {
  return SecureStore.setItemAsync(sessionKey, JSON.stringify(session), storageOptions);
}

export function clearSession() {
  return SecureStore.deleteItemAsync(sessionKey, storageOptions);
}
