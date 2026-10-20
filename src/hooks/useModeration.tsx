import { useState } from 'react';
import { Alert } from 'react-native';

import { ActionMenu, type ActionMenuOption } from '@/components/ActionMenu';
import { ReportSheet, type ReportTarget } from '@/components/ReportSheet';
import { errorMessage } from '@/components/ui';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';

type MenuParams = {
  title?: string;
  // 通報の対象（写真またはユーザー）
  report: ReportTarget;
  // ブロックできる相手（自分の写真・退会済みのユーザーなら null）
  user: { id: number; name: string } | null;
  // 通報・ブロックより前に並べる、画面ごとの操作（「イベントから外す」など）
  extraOptions?: ActionMenuOption[];
  onBlocked?: (userId: number) => void;
};

// 写真・ユーザーの「…」メニュー（通報する・ブロックする）。返り値の element を画面に置いて使う
export function useModeration() {
  const { user: me, handleApiError } = useSession();
  const [menu, setMenu] = useState<MenuParams | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const confirmBlock = (target: { id: number; name: string }, onBlocked?: (userId: number) => void) => {
    Alert.alert(
      `${target.name}さんをブロックしますか？`,
      'この人が投稿した写真が表示されなくなり、この人からコミュニティやイベントに招待されなくなります。相手には知らされません。ブロックは設定からいつでも解除できます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ブロック',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.blockUser(target.id);
              onBlocked?.(target.id);
              Alert.alert(`${target.name}さんをブロックしました`);
            } catch (e) {
              if (!handleApiError(e)) Alert.alert('ブロックできませんでした', errorMessage(e));
            }
          },
        },
      ],
    );
  };

  const options: ActionMenuOption[] = menu
    ? [
        ...(menu.extraOptions ?? []),
        { label: '通報する', icon: 'flag-outline', onPress: () => setReportTarget(menu.report) },
        // 自分自身はブロックできない
        ...(menu.user && menu.user.id !== me?.id
          ? [
              {
                label: `${menu.user.name}さんをブロック`,
                icon: 'ban-outline' as const,
                destructive: true,
                onPress: () => confirmBlock(menu.user!, menu.onBlocked),
              },
            ]
          : []),
      ]
    : [];

  const element = (
    <>
      <ActionMenu visible={menu !== null} title={menu?.title} options={options} onClose={() => setMenu(null)} />
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </>
  );

  return { openMenu: setMenu, element };
}
