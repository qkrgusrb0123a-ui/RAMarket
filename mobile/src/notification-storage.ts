import { getItem, setItem } from './local-storage';

export type NotificationKind = 'chat' | 'favorite-price-drop' | 'custom-product';

export type ChatNotification = {
  id: string;
  kind: NotificationKind;
  senderName?: string;
  message?: string;
  productId?: string;
  otherUserId?: string;
  productTitle?: string;
  createdAt: string;
  read: boolean;
};

function keyFor(userId: string) {
  return `ramarket.chat-notifications.${userId}`;
}

export async function loadChatNotifications(userId: string): Promise<ChatNotification[]> {
  const stored = await getItem(keyFor(userId));
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): ChatNotification[] => {
      if (!item || typeof item !== 'object') return [];
      const value = item as Partial<ChatNotification>;
      if (typeof value.id !== 'string' || typeof value.createdAt !== 'string' || typeof value.read !== 'boolean') return [];
      const kind: NotificationKind = value.kind === 'favorite-price-drop' || value.kind === 'custom-product' ? value.kind : 'chat';
      return [{
        id: value.id,
        kind,
        senderName: typeof value.senderName === 'string' ? value.senderName : undefined,
        message: typeof value.message === 'string' ? value.message : undefined,
        productId: typeof value.productId === 'string' ? value.productId : undefined,
        otherUserId: typeof value.otherUserId === 'string' ? value.otherUserId : undefined,
        productTitle: typeof value.productTitle === 'string' ? value.productTitle : undefined,
        createdAt: value.createdAt,
        read: value.read
      }];
    });
  } catch {
    return [];
  }
}

export function saveChatNotifications(userId: string, notifications: ChatNotification[]) {
  return setItem(keyFor(userId), JSON.stringify(notifications.slice(0, 100)));
}
