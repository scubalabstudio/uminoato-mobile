import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Button, errorMessage } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import type { BlockedUser } from '@/types';

// ブロックしたユーザーの一覧と解除
export default function BlockedUsersScreen() {
  const { handleApiError } = useSession();
  const [users, setUsers] = useState<BlockedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await api.fetchBlockedUsers());
      setError(null);
    } catch (e) {
      if (!handleApiError(e)) setError(errorMessage(e));
    }
  }, [handleApiError]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const unblock = (u: BlockedUser) => {
    Alert.alert(`${u.name}さんのブロックを解除しますか？`, 'この人の写真が再び表示され、この人から招待されるようになります。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '解除',
        onPress: async () => {
          setBusyId(u.user_id);
          try {
            await api.unblockUser(u.user_id);
            setUsers((list) => (list ?? []).filter((x) => x.user_id !== u.user_id));
          } catch (e) {
            if (!handleApiError(e)) Alert.alert('解除できませんでした', errorMessage(e));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  if (users === null) {
    return (
      <View style={styles.center}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Button title="再読み込み" variant="secondary" onPress={load} />
          </View>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <FlatList
      data={users}
      keyExtractor={(u) => String(u.user_id)}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.userId}>@{item.login_id}</Text>
          </View>
          <Pressable
            onPress={() => unblock(item)}
            disabled={busyId !== null}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}さんのブロックを解除`}
            style={styles.unblock}
          >
            {busyId === item.user_id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.unblockText}>解除</Text>
            )}
          </Pressable>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={styles.divider} />}
      ListHeaderComponent={
        <Text style={styles.lead}>
          ブロックした人の写真は表示されず、その人からコミュニティやイベントに招待されません。相手にはブロックしたことは知らされません。
        </Text>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="ban-outline" size={28} color={colors.textMuted} />
          <Text style={styles.emptyText}>ブロックしているユーザーはいません</Text>
        </View>
      }
      contentContainerStyle={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorBox: { gap: 12, alignSelf: 'stretch' },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
  list: { padding: 16, paddingBottom: 48 },
  lead: { fontSize: 13, color: colors.textSub, lineHeight: 19, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  userId: { fontSize: 12, color: colors.textSub },
  unblock: {
    minWidth: 64,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  unblockText: { fontSize: 14, fontWeight: '600', color: colors.text },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  emptyText: { fontSize: 14, color: colors.textSub },
});
