import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { CommunityInvitationList } from '@/components/CommunityInvitationList';
import { Button } from '@/components/ui';
import { ROLE_OWNER } from '@/constants/roles';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';

// 右下タブ：選択中のコミュニティの情報と切り替え
export default function CommunityTab() {
  const { current, loadError, reload } = useCommunity();
  const [refreshing, setRefreshing] = useState(false);
  if (!current) return null;

  const refresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const openSwitcher = () => router.push('/switch-community');

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <Tabs.Screen
        options={{
          // 切り替えは下のメニュー（と右下アイコンの長押し）に任せ、上部は名前の表示だけにする
          headerTitle: () => (
            <Text style={styles.titleText} numberOfLines={1}>
              {current.name}
            </Text>
          ),
        }}
      />

      {loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Button title="再読み込み" variant="secondary" onPress={reload} />
        </View>
      ) : null}

      <View style={styles.summary}>
        <Avatar name={current.name} uri={current.icon_url} size={72} />
        <View style={styles.summaryText}>
          <Text style={styles.name}>{current.name}</Text>
          <Text style={styles.meta}>
            {current.role} · {current.member_count}人が参加
          </Text>
        </View>
      </View>
      {current.description ? <Text style={styles.description}>{current.description}</Text> : null}

      <View style={styles.menu}>
        <MenuRow icon="swap-horizontal" label="コミュニティを切り替える" onPress={openSwitcher} />
        {current.role === ROLE_OWNER ? (
          <>
            <View style={styles.divider} />
            <MenuRow icon="settings-outline" label="コミュニティ設定" note="準備中" />
          </>
        ) : null}
      </View>
      <Text style={styles.hint}>下のコミュニティアイコンを長押ししても切り替えられます</Text>

      <CommunityInvitationList />
    </ScrollView>
  );
}

function MenuRow({
  icon,
  label,
  note,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  note?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Ionicons name={icon} size={20} color={onPress ? colors.text : colors.textMuted} />
      <Text style={[styles.rowLabel, !onPress && { color: colors.textMuted }]}>{label}</Text>
      {note ? <Text style={styles.rowNote}>{note}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 16 },
  titleText: { fontSize: 20, fontWeight: '700', color: colors.text, maxWidth: 260 },
  errorBox: { gap: 8 },
  errorText: { color: colors.danger, fontSize: 14 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  summaryText: { flex: 1, gap: 4 },
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textSub },
  description: { fontSize: 14, color: colors.textSub, lineHeight: 20 },
  menu: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowPressed: { backgroundColor: colors.bg },
  rowLabel: { flex: 1, fontSize: 15, color: colors.text },
  rowNote: { fontSize: 12, color: colors.textMuted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 48 },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: -8 },
});
