import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs } from 'expo-router';
import { useCallback, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NetworkErrorView } from '@/components/NetworkErrorView';

import { Avatar } from '@/components/Avatar';
import { RoleBadge } from '@/components/RoleBadge';
import { Button } from '@/components/ui';
import { WEB_URL } from '@/config/api';
import { isOwner, ROLE_EDITOR } from '@/constants/roles';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';

// 右下タブ：選択中のコミュニティの情報と切り替え
export default function CommunityTab() {
  const { current, loadError, reload, isLoading } = useCommunity();
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const retry = useCallback(async () => {
    setRetrying(true);
    await reload();
    setRetrying(false);
  }, [reload]);
  if (!current) {
    if (isLoading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
    if (loadError) return (
      <View style={styles.center}>
        <NetworkErrorView message={loadError} onRetry={retry} loading={retrying} />
      </View>
    );
    return null;
  }

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
        <NetworkErrorView message={loadError} onRetry={retry} loading={retrying} />
      ) : null}

      <View style={styles.summary}>
        <Avatar name={current.name} uri={current.icon_url} size={72} />
        <View style={styles.summaryText}>
          <Text style={styles.name}>{current.name}</Text>
          <View style={styles.metaLine}>
            <RoleBadge role={current.role} />
            <Text style={styles.meta}>{current.member_count}人が参加</Text>
          </View>
        </View>
      </View>
      {current.description ? <Text style={styles.description}>{current.description}</Text> : null}

      <View style={styles.menu}>
        <MenuRow icon="swap-horizontal" label="コミュニティを切り替える" onPress={openSwitcher} />
        {/* メンバー管理・設定は管理者だけに出す（サーバーも管理者以外は 403） */}
        {isOwner(current.role) ? (
          <>
            <View style={styles.divider} />
            <MenuRow
              icon="people-outline"
              label="メンバー管理"
              note={`${current.member_count}人`}
              onPress={() =>
                router.push({ pathname: '/[communityId]/members', params: { communityId: String(current.id) } })
              }
            />
            <View style={styles.divider} />
            <MenuRow
              icon="settings-outline"
              label="コミュニティ設定"
              onPress={() =>
                router.push({ pathname: '/[communityId]/settings', params: { communityId: String(current.id) } })
              }
            />
          </>
        ) : null}
      </View>

      {isOwner(current.role) ? null : (
        <View style={styles.roleBox}>
          <Text style={styles.roleBoxText}>
            {current.role === ROLE_EDITOR
              ? '図鑑編集者として、図鑑への登録・編集と未同定写真の同定ができます。'
              : 'メンバーとして、図鑑・イベントの閲覧とイベントの作成ができます。'}
            コミュニティの設定・メンバー管理はコミュニティ管理者が行います。
          </Text>
          <Pressable onPress={() => Linking.openURL(`${WEB_URL}/umi-no-ato/roles`)} accessibilityRole="link">
            <Text style={styles.roleLink}>ロールごとにできること</Text>
          </Pressable>
        </View>
      )}
      <Text style={styles.hint}>下のコミュニティアイコンを長押ししても切り替えられます</Text>

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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  container: { padding: 16, paddingBottom: 48, gap: 16 },
  titleText: { fontSize: 20, fontWeight: '700', color: colors.text, maxWidth: 260 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  summaryText: { flex: 1, gap: 4 },
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textSub },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleBox: { gap: 6, paddingHorizontal: 4 },
  roleBoxText: { fontSize: 12, color: colors.textSub, lineHeight: 18 },
  roleLink: { fontSize: 12, color: colors.primary, fontWeight: '600' },
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
