// Browsers do not provide an Expo SecureStore equivalent. Session and local
// preferences are therefore kept per-browser in localStorage on the web only.
export async function getItem(key: string) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Private browsing or disabled storage should not prevent app use.
  }
}

export async function removeItem(key: string) {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Nothing to clear when browser storage is unavailable.
  }
}
