import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useSession } from '@/context/SessionContext';
import { savePendingLink } from '@/utils/pendingLink';

// イベントのリンクから開いた画面。ログイン済みならイベント画面へ。
// 未ログインならリンクを覚えてログイン画面へ移り、ログイン後にイベント画面を開く
export default function EventDeepLink() {
  const { communityId, eventId } = useLocalSearchParams<{ communityId: string; eventId: string }>();
  const { user } = useSession();
  const href = `/${communityId}/events/${eventId}`;

  useEffect(() => {
    if (!user) savePendingLink(href);
  }, [user, href]);

  return <Redirect href={(user ? href : '/login') as never} />;
}
