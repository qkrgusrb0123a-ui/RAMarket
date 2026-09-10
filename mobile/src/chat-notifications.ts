import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let permissionGranted = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

export async function prepareChatNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('chat', {
      name: '거래 채팅',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 150, 250]
    });
  }

  const current = await Notifications.getPermissionsAsync();
  permissionGranted = current.granted;
  if (!permissionGranted) {
    const requested = await Notifications.requestPermissionsAsync();
    permissionGranted = requested.granted;
  }
  return permissionGranted;
}

export async function notifyIncomingChat(senderName: string, message: string) {
  if (!permissionGranted && !(await prepareChatNotifications())) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${senderName}님의 새 채팅`,
      body: message,
      sound: 'default',
      color: '#0E766E'
    },
    trigger: null
  });
}
