import { getItem, setItem } from './local-storage';

export type ChatNotification = {
  id: string;
  senderName: string;
  message: string;
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
    return parsed.filter((item): item is ChatNotification => Boolean(
      item
      && typeof item === 'object'
      && typeof (item as ChatNotification).id === 'string'
      && typeof (item as ChatNotification).senderName === 'string'
      && typeof (item as ChatNotification).message === 'string'
      && typeof (item as ChatNotification).createdAt === 'string'
      && typeof (item as ChatNotification).read === 'boolean'
    ));
  } catch {
    return [];
  }
}

export function saveChatNotifications(userId: string, notifications: ChatNotification[]) {
  return setItem(keyFor(userId), JSON.stringify(notifications.slice(0, 100)));
}
