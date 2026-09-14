export async function prepareChatNotifications() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

export async function notifyIncomingChat(senderName: string, message: string) {
  if (await prepareChatNotifications()) new Notification(`${senderName}님의 새 채팅`, { body: message });
}

export async function notifyCustomProduct(title: string, category: string) {
  if (await prepareChatNotifications()) new Notification('관심 상품이 새롭게 게시되었어요', { body: `${category}\n${title}` });
}

export async function notifyFavoritePriceDrop(title: string) {
  if (await prepareChatNotifications()) new Notification('찜한 상품의 가격이 내려갔어요', { body: title });
}
