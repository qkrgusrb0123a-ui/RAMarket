import * as SecureStore from 'expo-secure-store';

export type CustomProductAlertCriteria = {
  productType: 'any' | 'desktop' | 'laptop';
  memoryStandard: 'any' | 'DDR4' | 'DDR5';
  clock: 'any' | '2666MHz' | '3200MHz' | '5600MHz' | '6000MHz';
  capacity: 'any' | '4GB' | '8GB' | '12GB' | '16GB' | '24GB' | '32GB' | '64GB' | '128GB';
};

export type AppSettings = {
  favoriteDiscountAlerts: boolean;
  customProductAlerts: boolean;
  customProductAlertCriteria: CustomProductAlertCriteria;
  chatAlerts: boolean;
  doNotDisturbEnabled: boolean;
  doNotDisturbStartMinutes: number;
  doNotDisturbEndMinutes: number;
};

export const defaultAppSettings: AppSettings = {
  favoriteDiscountAlerts: true,
  customProductAlerts: false,
  customProductAlertCriteria: { productType: 'any', memoryStandard: 'any', clock: 'any', capacity: 'any' },
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

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function customProductAlertCriteria(value: unknown): CustomProductAlertCriteria {
  const saved = value && typeof value === 'object' ? value as Partial<CustomProductAlertCriteria> : {};
  return {
    productType: isOneOf(saved.productType, ['any', 'desktop', 'laptop'] as const) ? saved.productType : defaultAppSettings.customProductAlertCriteria.productType,
    memoryStandard: isOneOf(saved.memoryStandard, ['any', 'DDR4', 'DDR5'] as const) ? saved.memoryStandard : defaultAppSettings.customProductAlertCriteria.memoryStandard,
    clock: isOneOf(saved.clock, ['any', '2666MHz', '3200MHz', '5600MHz', '6000MHz'] as const) ? saved.clock : defaultAppSettings.customProductAlertCriteria.clock,
    capacity: isOneOf(saved.capacity, ['any', '4GB', '8GB', '12GB', '16GB', '24GB', '32GB', '64GB', '128GB'] as const) ? saved.capacity : defaultAppSettings.customProductAlertCriteria.capacity
  };
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
      customProductAlerts: typeof value.customProductAlerts === 'boolean' ? value.customProductAlerts : defaultAppSettings.customProductAlerts,
      customProductAlertCriteria: customProductAlertCriteria(value.customProductAlertCriteria),
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
