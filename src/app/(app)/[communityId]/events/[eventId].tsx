import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, errorMessage } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import type { CommunityEventDetail, Dive } from '@/types';
import { formatDateRange } from '@/utils/date';

// イベント詳細。URL は Web と同じ形（/{communityId}/events/{eventId}）にしておき、後でリンクから開けるようにする
export default function EventDetailScreen() {
  const params = useLocalSearchParams<{ communityId: string; eventId: string; name?: string }>();
  const communityId = Number(params.communityId);
  const eventId = Number(params.eventId);
  const { handleApiError } = useSession();
  const { communities, invitedEvents, respondEventInvitation } = useCommunity();
  const [event, setEvent] = useState<CommunityEventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [responding, setResponding] = useState(false);

  const load = useCallback(async () => {
    try {
      setEvent(await api.fetchEvent(communityId, eventId));
      setError(null);
    } catch (e) {
      if (!handleApiError(e)) setError(errorMessage(e));
    }
  }, [communityId, eventId, handleApiError]);

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

  const respond = async (accept: boolean) => {
    if (!event) return;
    setResponding(true);
    const ok = await respondEventInvitation({ id: event.id, name: event.name, community_id: communityId }, accept);
    if (ok) await load();
    setResponding(false);
  };

  // 所属していないコミュニティのイベント＝ゲスト参加（図鑑など、コミュニティの他の機能は見られない）
  const isGuest = !communities.some((c) => c.id === communityId);
  const communityName =
    communities.find((c) => c.id === communityId)?.name ??
    invitedEvents.find((ev) => ev.community_id === communityId)?.community_name;

  const title = event?.name ?? params.name ?? '';

  if (!event) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title }} />
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

  const date = formatDateRange(event.start_date, event.end_date);
  const accepted = event.members.filter((m) => m.status === 'accepted');
  const invited = event.members.filter((m) => m.status === 'invited');
  const dives = event.dive_info?.dives ?? [];

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <Stack.Screen options={{ title }} />

      <View style={styles.head}>
        {communityName ? <Text style={styles.community}>{communityName}</Text> : null}
        <Text style={styles.name}>{event.name}</Text>
        <View style={styles.metaLine}>
          {date ? <Text style={styles.meta}>{date}</Text> : null}
          <Text style={[styles.chip, event.status === 'open' ? styles.chipOpen : styles.chipClosed]}>
            {event.status === 'open' ? '開催中' : '終了'}
          </Text>
        </View>
        <Text style={styles.meta}>主催：{event.organizer_name ?? '退会したユーザー'}</Text>
      </View>

      {isGuest ? (
        <View style={styles.notice}>
          <Ionicons name="person-outline" size={16} color={colors.textSub} />
          <Text style={styles.noticeText}>ゲストとして参加しているイベントです</Text>
        </View>
      ) : null}

      {/* コミュニティメンバーは全イベントを見られるが、写真のアップロードなどはイベントのメンバーだけ */}
      {!isGuest && (event.member_status === null || event.member_status === 'declined') ? (
        <View style={styles.notice}>
          <Ionicons name="eye-outline" size={16} color={colors.textSub} />
          <Text style={styles.noticeText}>閲覧のみ（このイベントのメンバーではありません）</Text>
        </View>
      ) : null}

      {event.member_status === 'invited' ? (
        <View style={styles.invite}>
          <Text style={styles.inviteText}>このイベントに招待されています</Text>
          <View style={styles.inviteActions}>
            <View style={styles.flex}>
              <Button title="参加する" onPress={() => respond(true)} loading={responding} />
            </View>
            <View style={styles.flex}>
              <Button title="辞退" variant="secondary" onPress={() => respond(false)} disabled={responding} />
            </View>
          </View>
        </View>
      ) : null}

      {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

      {event.dive_info && (dives.length > 0 || event.dive_info.weather || event.dive_info.notes) ? (
        <Section title="ダイブ情報">
          {event.dive_info.weather ? <Text style={styles.body}>天気：{event.dive_info.weather}</Text> : null}
          {dives.map((d) => (
            <DiveRow key={d.sort_order} dive={d} />
          ))}
          {event.dive_info.notes ? <Text style={styles.body}>{event.dive_info.notes}</Text> : null}
        </Section>
      ) : null}

      <Section title={`参加メンバー（${accepted.length + 1}人）`}>
        <Text style={styles.body}>
          {[`${event.organizer_name ?? '退会したユーザー'}（主催）`, ...accepted.map(memberName)].join('、')}
        </Text>
        {invited.length > 0 ? (
          <Text style={styles.sub}>招待中：{invited.map(memberName).join('、')}</Text>
        ) : null}
      </Section>

      <Section title="写真">
        <Text style={styles.body}>
          {event.photo_count}枚{event.unidentified_count > 0 ? `（未同定 ${event.unidentified_count}枚）` : ''}
        </Text>
        <Text style={styles.sub}>写真・レポートの画面は準備中です</Text>
      </Section>
    </ScrollView>
  );
}

function memberName(m: { name: string | null; is_me: boolean }): string {
  const name = m.name ?? '退会したユーザー';
  return m.is_me ? `${name}（あなた）` : name;
}

function DiveRow({ dive }: { dive: Dive }) {
  const place = [dive.dive_site, dive.point_detail].filter(Boolean).join(' ');
  const facts = [
    dive.water_temp != null ? `水温${dive.water_temp}℃` : null,
    dive.visibility != null ? `透明度${dive.visibility}m` : null,
    dive.max_depth != null ? `最大${dive.max_depth}m` : null,
    dive.dive_time != null ? `${dive.dive_time}分` : null,
  ].filter(Boolean);
  return (
    <View style={styles.dive}>
      <Text style={styles.diveNo}>{dive.sort_order}本目</Text>
      <View style={styles.flex}>
        <Text style={styles.body}>{place || 'ポイント未入力'}</Text>
        {facts.length > 0 ? <Text style={styles.sub}>{facts.join(' · ')}</Text> : null}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, paddingBottom: 48, gap: 20 },
  errorBox: { gap: 12, alignSelf: 'stretch' },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  head: { gap: 6 },
  community: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  name: { fontSize: 22, fontWeight: '700', color: colors.text },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { fontSize: 14, color: colors.textSub },
  chip: { fontSize: 11, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  chipOpen: { color: colors.primary, backgroundColor: colors.primaryLight },
  chipClosed: { color: colors.textSub, backgroundColor: colors.border },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  noticeText: { fontSize: 13, color: colors.textSub },
  invite: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 12, gap: 8 },
  inviteText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  inviteActions: { flexDirection: 'row', gap: 8 },
  description: { fontSize: 15, color: colors.text, lineHeight: 22 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textSub },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  body: { fontSize: 14, color: colors.text, lineHeight: 20 },
  sub: { fontSize: 12, color: colors.textSub, lineHeight: 18 },
  dive: { flexDirection: 'row', gap: 12 },
  diveNo: { fontSize: 13, fontWeight: '600', color: colors.primary, width: 44 },
});
