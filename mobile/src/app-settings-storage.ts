import * as SecureStore from 'expo-secure-store';

export type AppSettings = {
  favoriteDiscountAlerts: boolean;
  chatAlerts: boolean;
  doNotDisturbEnabled: boolean;
  doNotDisturbStartMinutes: number;
  doNotDisturbEndMinutes: number;
};

export const defaultAppSettings: AppSettings = {
  favoriteDiscountAlerts: true,
  chatAlerts: true,
  doNotDisturbEnabled: false,
  doNotDisturbStartMinutes: 22 * 60,
  doNotDisturbEndMinutes: 9 * 60
};

function keyFor(userId: string) {
  return `ramarket.app-settings.${userId}`;
}

function isHour(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 24 * 60 && value % 60 === 0;
}

export async function loadAppSettings(userId: string): Promise<AppSettings> {
  const stored = await SecureStore.getItemAsync(keyFor(userId));
  if (!stored) return defaultAppSettings;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return defaultAppSettings;
    const value = parsed as Partial<AppSettings>;
    return {
      favoriteDiscountAlerts: typeof value.favoriteDiscountAlerts === 'boolean' ? value.favoriteDiscountAlerts : defaultAppSettings.favoriteDiscountAlerts,
      chatAlerts: typeof value.chatAlerts === 'boolean' ? value.chatAlerts : defaultAppSettings.chatAlerts,
      doNotDisturbEnabled: typeof value.doNotDisturbEnabled === 'boolean' ? value.doNotDisturbEnabled : defaultAppSettings.doNotDisturbEnabled,
      doNotDisturbStartMinutes: isHour(value.doNotDisturbStartMinutes) ? value.doNotDisturbStartMinutes : defaultAppSettings.doNotDisturbStartMinutes,
      doNotDisturbEndMinutes: isHour(value.doNotDisturbEndMinutes) ? value.doNotDisturbEndMinutes : defaultAppSettings.doNotDisturbEndMinutes
    };
  } catch {
    return defaultAppSettings;
  }
}

export function saveAppSettings(userId: string, settings: AppSettings) {
  return SecureStore.setItemAsync(keyFor(userId), JSON.stringify(settings));
}
