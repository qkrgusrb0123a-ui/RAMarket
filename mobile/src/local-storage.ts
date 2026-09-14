// TypeScript resolves this fallback file; Expo resolves the .native or .web
// variant at runtime for each platform.
export async function getItem(_key: string): Promise<string | null> {
  return null;
}

export async function setItem(_key: string, _value: string): Promise<void> {
  // Platform-specific implementations persist the value.
}

export async function removeItem(_key: string): Promise<void> {
  // Platform-specific implementations remove the value.
}
