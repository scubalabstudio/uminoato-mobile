import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerPushToken, unregisterPushToken } from './apiService';

// フォアグラウンドで通知を受け取ったとき、バナーとサウンドを出す
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let _cachedToken: string | null = null;

export async function setupPushNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync();
    _cachedToken = token;
    await registerPushToken(token);
  } catch {
    // シミュレーターや projectId 未設定の場合は無視
  }
}

export async function teardownPushNotifications(): Promise<void> {
  if (!_cachedToken) return;
  try {
    await unregisterPushToken(_cachedToken);
  } catch {}
  _cachedToken = null;
}
