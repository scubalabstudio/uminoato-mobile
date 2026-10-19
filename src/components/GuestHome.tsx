import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/AppLogo';
import { EventInvitationBell } from '@/components/EventInvitationBell';
import { EventRow } from '@/components/EventRow';
import { SettingsButton } from '@/components/SettingsButton';
import { Button } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';

// タブの代わりに出すホーム。次の2つの場合に使う
// - 切り替えで「ゲスト」を選んだとき：所属していないコミュニティのイベント（テンポラリーメンバーとしての参加）を並べる
// - どのコミュニティにも所属していないとき：ゲスト参加のイベントがあればそれを並べ、無ければ招待への応答かコミュニティ作成を促す
export function GuestHome() {
  const insets = useSafeAreaInsets();
  const { communities, loadError, reload, guestEvents } = useCommunity();
  const hasCommunities = communities.length > 0;
  const [refreshing, setRefreshing] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const joined = guestEvents.filter((ev) => ev.member_status === 'accepted' && ev.status === 'open');
  const closed = guestEvents.filter((ev) => ev.member_status === 'accepted' && ev.status === 'closed');

  const refresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <AppLogo />
        <View style={styles.headerActions}>
          {/* ゲスト参加のイベントの招待はベルの中にまとめる（コミュニティのイベントタブと同じ） */}
          <EventInvitationBell events={guestEvents} />
          <SettingsButton />
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {loadError ? (
          <View style={styles.errorCenter}>
            <Text style={styles.errorText}>{loadError}</Text>
            <Button title="再読み込み" variant="secondary" onPress={reload} />
          </View>
        ) : (
          <>
            {hasCommunities ? (
              <Pressable
                onPress={() => router.push('/switch-community')}
                accessibilityRole="button"
                accessibilityLabel="ゲスト。コミュニティを切り替える"
                style={({ pressed }) => [styles.switchRow, pressed && { opacity: 0.6 }]}
              >
                <View style={styles.guestIcon}>
                  <Ionicons name="person-outline" size={22} color={colors.textSub} />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.switchTitle}>ゲスト</Text>
                  <Text style={styles.emptySub}>所属していないコミュニティのイベント</Text>
                </View>
                <Text style={styles.switchAction}>切り替え</Text>
                <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
              </Pressable>
            ) : null}

            {/* 招待しか届いていないと一覧が空になるので、ベルへ案内する */}
            {guestEvents.length > 0 && joined.length === 0 && closed.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="notifications-outline" size={28} color={colors.textMuted} />
                <Text style={styles.emptyText}>イベントに招待されています</Text>
                <Text style={styles.emptySub}>右上のベルから参加・辞退を選んでください</Text>
              </View>
            ) : null}

            {joined.length > 0 ? (
              <View style={styles.list}>
                <Text style={styles.sectionTitle}>参加中のイベント</Text>
                {joined.map((ev) => (
                  <EventRow key={ev.id} event={ev} communityId={ev.community_id} sub={ev.community_name} />
                ))}
              </View>
            ) : null}

            {closed.length > 0 ? (
              <View style={styles.list}>
                <Pressable
                  onPress={() => setShowClosed((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showClosed }}
                  hitSlop={8}
                >
                  <Text style={styles.sectionTitle}>
                    終了したイベント（{closed.length}） {showClosed ? '▴' : '▾'}
                  </Text>
                </Pressable>
                {showClosed ? closed.map((ev) => <EventRow key={ev.id} event={ev} communityId={ev.community_id} sub={ev.community_name} />) : null}
              </View>
            ) : null}

            {hasCommunities ? null : guestEvents.length > 0 ? (
              <View style={styles.footer}>
                <Text style={styles.emptySub}>仲間と記録を残したいときは</Text>
                <Button
                  title="自分のコミュニティを作る"
                  variant="secondary"
                  onPress={() => router.push('/create-community')}
                />
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>まだ参加しているコミュニティがありません</Text>
                <Text style={styles.emptySub}>招待を受けるか、新しくコミュニティを作成してください</Text>
                <Button title="コミュニティを作成する" onPress={() => router.push('/create-community')} />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, height: 52 },
  container: { padding: 16, paddingBottom: 48, gap: 16 },
  errorCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 48 },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  flex1: { flex: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  guestIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  switchAction: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  list: { gap: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textSub, marginBottom: 4 },
  footer: {
    gap: 10,
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  emptyText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  emptySub: { color: colors.textSub, fontSize: 13 },
});
