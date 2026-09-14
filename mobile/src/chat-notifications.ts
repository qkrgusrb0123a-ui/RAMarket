export async function prepareChatNotifications() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

export async function notifyIncomingChat(senderName: string, message: string) {
  if (await prepareChatNotifications()) new Notification(`${senderName}님의 새 채팅`, { body: message });
}

export async function notifyCustomProduct(title: string, category: string) {
  if (await prepareChatNotifications()) new Notification('원하는 RAM 상품이 등록됐어요', { body: `${category}\n${title}` });
}
