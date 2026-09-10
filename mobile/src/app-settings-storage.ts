import * as SecureStore from 'expo-secure-store';

export type CustomProductAlertCriteria = {
  productTypes: Array<'desktop' | 'laptop'>;
  memoryStandards: Array<'DDR4' | 'DDR5'>;
  clocks: Array<'2666MHz' | '3200MHz' | '5600MHz' | '6000MHz'>;
  capacities: Array<'4GB' | '8GB' | '12GB' | '16GB' | '24GB' | '32GB' | '64GB' | '128GB'>;
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
  customProductAlertCriteria: { productTypes: [], memoryStandards: [], clocks: [], capacities: [] },
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

function selectedValues<T extends string>(value: unknown, values: readonly T[]): T[] {
  const candidates = Array.isArray(value) ? value : [value];
  return [...new Set(candidates.filter((candidate): candidate is T => isOneOf(candidate, values)))];
}

function customProductAlertCriteria(value: unknown): CustomProductAlertCriteria {
  const saved = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    productTypes: selectedValues(saved.productTypes ?? saved.productType, ['desktop', 'laptop'] as const),
    memoryStandards: selectedValues(saved.memoryStandards ?? saved.memoryStandard, ['DDR4', 'DDR5'] as const),
    clocks: selectedValues(saved.clocks ?? saved.clock, ['2666MHz', '3200MHz', '5600MHz', '6000MHz'] as const),
    capacities: selectedValues(saved.capacities ?? saved.capacity, ['4GB', '8GB', '12GB', '16GB', '24GB', '32GB', '64GB', '128GB'] as const)
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
