import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { CommunityCard } from '@/components/CommunityCard';
import { Button, errorMessage } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import type { Community, MyInvitation, MyInvitedEvent } from '@/types';

export default function DashboardScreen() {
  const { user, signOut, handleApiError } = useSession();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [invitations, setInvitations] = useState<MyInvitation[]>([]);
  const [invitedEvents, setInvitedEvents] = useState<MyInvitedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 応答中の招待（ボタンを無効にする）。キーは `c{id}` / `e{id}`
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, i, e] = await Promise.all([
        api.fetchCommunities(),
        api.fetchMyInvitations(),
        api.fetchMyInvitedEvents(),
      ]);
      setCommunities(c);
      setInvitations(i);
      setInvitedEvents(e);
      setLoadError(null);
    } catch (err) {
      if (!handleApiError(err)) setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [handleApiError]);

  // コミュニティ作成のモーダルから戻ったときも最新にする
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const respondCommunity = async (inv: MyInvitation, accept: boolean) => {
    setBusyKey(`c${inv.id}`);
    try {
      if (accept) {
        await api.acceptInvitation(inv.id);
        await load();
      } else {
        await api.declineInvitation(inv.id);
        setInvitations((list) => list.filter((x) => x.id !== inv.id));
      }
    } catch (err) {
      if (!handleApiError(err)) Alert.alert(errorMessage(err));
    } finally {
      setBusyKey(null);
    }
  };

  const respondEvent = async (ev: MyInvitedEvent, accept: boolean) => {
    setBusyKey(`e${ev.id}`);
    try {
      await api.respondEventInvitation(ev.community_id, ev.id, accept ? 'accepted' : 'declined');
      setInvitedEvents((list) => list.filter((x) => x.id !== ev.id));
      if (accept) Alert.alert('参加しました', `「${ev.name}」に参加しました。`);
    } catch (err) {
      if (!handleApiError(err)) Alert.alert(errorMessage(err));
    } finally {
      setBusyKey(null);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('ログアウトしますか？', 'この端末からログアウトします。', [
      { text: 'キャンセル', style: 'cancel' },
      { text: 'ログアウト', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const header = (
    <View style={styles.headerBlock}>
      <Text style={styles.greeting}>{user?.name} さん</Text>

      {invitations.length > 0 || invitedEvents.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>届いている招待</Text>
          {invitations.map((inv) => (
            <InvitationRow
              key={`c${inv.id}`}
              text={`${inv.invited_by_name ?? '管理者'} さんから「${inv.community_name}」への招待`}
              busy={busyKey === `c${inv.id}`}
              onAccept={() => respondCommunity(inv, true)}
              onDecline={() => respondCommunity(inv, false)}
            />
          ))}
          {invitedEvents.map((ev) => (
            <InvitationRow
              key={`e${ev.id}`}
              text={`イベント「${ev.name}」に招待されています`}
              sub={[ev.community_name, formatDateRange(ev.start_date, ev.end_date)].filter(Boolean).join(' · ')}
              busy={busyKey === `e${ev.id}`}
              onAccept={() => respondEvent(ev, true)}
              onDecline={() => respondEvent(ev, false)}
            />
          ))}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>参加しているコミュニティ</Text>
      {loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Button title="再読み込み" variant="secondary" onPress={load} />
        </View>
      ) : null}
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable onPress={() => router.push('/create-community')} hitSlop={8} accessibilityRole="button">
                <Text style={styles.headerAction}>新規作成</Text>
              </Pressable>
              <Pressable onPress={confirmSignOut} hitSlop={8} accessibilityRole="button">
                <Text style={styles.headerActionSub}>ログアウト</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={communities}
          keyExtractor={(c) => String(c.id)}
          renderItem={({ item }) => <CommunityCard community={item} />}
          ListHeaderComponent={header}
          ListEmptyComponent={
            loadError ? null : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>まだ参加しているコミュニティがありません</Text>
                <Button title="最初のコミュニティを作成する" onPress={() => router.push('/create-community')} />
              </View>
            )
          }
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
          contentInsetAdjustmentBehavior="automatic"
        />
      )}
    </>
  );
}

function InvitationRow({
  text,
  sub,
  busy,
  onAccept,
  onDecline,
}: {
  text: string;
  sub?: string;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <View style={styles.invitation}>
      <Text style={styles.invitationText}>{text}</Text>
      {sub ? <Text style={styles.invitationSub}>{sub}</Text> : null}
      <View style={styles.invitationActions}>
        <View style={styles.flex}>
          <Button title="参加する" onPress={onAccept} loading={busy} />
        </View>
        <View style={styles.flex}>
          <Button title="辞退" variant="secondary" onPress={onDecline} disabled={busy} />
        </View>
      </View>
    </View>
  );
}

// 終了日が開始日と同じ・未設定なら開始日のみ（Web版のイベント一覧と同じ表示）
function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return '';
  const fmt = (d: string) => d.replaceAll('-', '/');
  return end && end !== start ? `${fmt(start)}〜${fmt(end)}` : fmt(start);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 48 },
  headerBlock: { gap: 12, marginBottom: 12 },
  greeting: { fontSize: 14, color: colors.textSub },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerAction: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  headerActionSub: { color: colors.textSub, fontSize: 15 },
  section: { gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textSub },
  invitation: {
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  invitationText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  invitationSub: { fontSize: 12, color: colors.textSub },
  invitationActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  errorBox: { gap: 8 },
  errorText: { color: colors.danger, fontSize: 14 },
  empty: { alignItems: 'center', gap: 16, paddingVertical: 32 },
  emptyText: { color: colors.textSub, fontSize: 14 },
});
