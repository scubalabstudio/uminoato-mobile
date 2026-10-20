import { router } from 'expo-router';
import { useEffect } from 'react';

import { takePendingLink } from '@/utils/pendingLink';

// ログイン前に開いたリンク（招待・イベント）があれば、ログイン後のホームが出たところでその画面を開く
export function usePendingLinkNavigation() {
  useEffect(() => {
    takePendingLink().then((href) => {
      if (href) router.push(href as never);
    });
  }, []);
}
