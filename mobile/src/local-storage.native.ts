import * as SecureStore from 'expo-secure-store';

const storageOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export function getItem(key: string) {
  return SecureStore.getItemAsync(key, storageOptions);
}

export function setItem(key: string, value: string) {
  return SecureStore.setItemAsync(key, value, storageOptions);
}

export function removeItem(key: string) {
  return SecureStore.deleteItemAsync(key, storageOptions);
}
