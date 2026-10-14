import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isOwner } from '@/constants/roles';
import { colors } from '@/constants/theme';
import type { Community } from '@/types';

// 管理者専用の画面の入口。管理者でなければ中身を出さずに案内だけ出す（Web版の制限画面と同じ文言）。
// 画面側の判定は表示の切り替えにすぎず、実際の権限チェックはサーバー（403）が行う
export function OwnerOnly({
  community,
  feature,
  children,
}: {
  community: Community | undefined;
  feature: string;
  children: (community: Community) => ReactNode;
}) {
  if (!community || !isOwner(community.role)) {
    return (
      <View style={styles.container}>
        <Ionicons name="lock-closed-outline" size={32} color={colors.textMuted} />
        <Text style={styles.text}>{feature}はコミュニティ管理者のみ利用できます</Text>
      </View>
    );
  }
  return <>{children(community)}</>;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  text: { fontSize: 14, color: colors.textSub, textAlign: 'center' },
});
