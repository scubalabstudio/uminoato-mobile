import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

type NotificationData = {
  type: string;
  community_id?: number;
  event_id?: number;
  invitation_id?: number;
};

export function useNotificationNavigation() {
  const router = useRouter();
  const coldStartHandled = useRef(false);

  function navigate(data: NotificationData) {
    const { type, community_id, event_id } = data;

    switch (type) {
      case 'event_invitation':
      case 'event_invitation_accepted':
      case 'event_invitation_declined':
      case 'event_closed':
        if (community_id && event_id) {
          router.push(`/${community_id}/events/${event_id}` as never);
        }
        break;
      case 'community_invitation_accepted':
      case 'community_invitation_declined':
        if (community_id) {
          router.push(`/${community_id}/events` as never);
        }
        break;
      case 'community_invitation':
        // ベルアイコンで確認できるようにイベントタブへ遷移
        router.push('/(app)/(tabs)/events' as never);
        break;
    }
  }

  useEffect(() => {
    // コールドスタート: アプリが終了した状態で通知タップして起動した場合
    if (!coldStartHandled.current) {
      coldStartHandled.current = true;
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response) return;
        const data = response.notification.request.content.data as NotificationData;
        if (data?.type) navigate(data);
      });
    }

    // フォアグラウンド・バックグラウンドからの通知タップ
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotificationData;
      if (data?.type) navigate(data);
    });

    return () => sub.remove();
  }, []);
}
