import { getItem, setItem } from './local-storage';

function keyFor(userId: string) {
  return `ramarket.favorite-product-ids.${userId}`;
}

export async function loadFavoriteProductIds(userId: string): Promise<string[]> {
  const stored = await getItem(keyFor(userId));
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFavoriteProductIds(userId: string, productIds: string[]) {
  return setItem(keyFor(userId), JSON.stringify(productIds));
}
