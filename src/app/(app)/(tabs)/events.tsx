import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { EventRow, type EventTag } from '@/components/EventRow';
import { FilterChips, SegmentedControl } from '@/components/SegmentedControl';
import { NetworkErrorView } from '@/components/NetworkErrorView';
import { Button, errorMessage } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import { getHistory, removeFromHistory, type HistoryEntry } from '@/services/browsingHistoryService';
import type { CommunityEvent, MyInvitedEvent } from '@/types';

type Segment = 'mine' | 'all';
type Filter = 'open' | 'recent' | 'closed';

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'mine', label: '参加中' },
  { value: 'all', label: 'コミュニティ全体' },
];

// Web版のイベント一覧と同じ絞り込み
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open', label: '開催中' },
  { value: 'recent', label: '最近' },
  { value: 'closed', label: '終了' },
];

const EMPTY_TEXT: Record<Filter, string> = {
  open: '開催中のイベントはありません',
  recent: '最近2週間に開催されたイベントはありません',
  closed: '終了したイベントはありません',
};

// 参加中＝自分が手を動かせる（写真のアップロードなど）イベント、全体＝見るだけのイベントも含めたコミュニティの全イベント
export default function EventsTab() {
  const { current, isLoading, loadError, reload } = useCommunity();
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
  return (
    <View style={{ flex: 1 }}>
      <EventsList key={current.id} communityId={current.id} />
      <Pressable
        style={styles.fab}
        onPress={() => router.push(`/${current.id}/events/new`)}
        accessibilityLabel="新規イベントを作成"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

function EventsList({ communityId }: { communityId: number }) {
  const { handleApiError } = useSession();
  const { invitedEvents, reload } = useCommunity();
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // my-events には主催イベントも「参加済み」として入る（作成時に主催者もメンバー登録されるため）
  const mine = useMemo(
    () =>
      invitedEvents
        .filter((ev) => ev.community_id === communityId && ev.member_status === 'accepted')
        .sort(byCreatedDesc),
    [invitedEvents, communityId],
  );
  const myStatus = useMemo(() => {
    const map = new Map<number, MyInvitedEvent['member_status']>();
    invitedEvents.filter((ev) => ev.community_id === communityId).forEach((ev) => map.set(ev.id, ev.member_status));
    return map;
  }, [invitedEvents, communityId]);

  const [segmentChoice, setSegmentChoice] = useState<Segment | null>(null);
  // 参加中のイベントがあれば「参加中」、無ければ「コミュニティ全体」から始める
  const segment: Segment = segmentChoice ?? (mine.length > 0 ? 'mine' : 'all');

  const [filter, setFilter] = useState<Filter>('open');
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allError, setAllError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  // 読み込み済みの絞り込み（フォーカスのたびに1ページ目へ戻さないため）と、古い応答を捨てるための番号
  const loadedFilter = useRef<Filter | null>(null);
  const requestId = useRef(0);

  const loadFirst = useCallback(
    async (f: Filter) => {
      const id = ++requestId.current;
      loadedFilter.current = f;
      setLoadingAll(true);
      setAllError(null);
      try {
        const res = await api.fetchEvents(communityId, f, 1);
        if (id !== requestId.current) return;
        setEvents(res.events);
        setPage(res.meta.current_page);
        setLastPage(res.meta.last_page);
      } catch (e) {
        if (id !== requestId.current) return;
        loadedFilter.current = null;
        if (!handleApiError(e)) setAllError(errorMessage(e));
      } finally {
        if (id === requestId.current) setLoadingAll(false);
      }
    },
    [communityId, handleApiError],
  );

  const loadMore = async () => {
    if (loadingAll || loadingMore || page >= lastPage) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const res = await api.fetchEvents(communityId, filter, page + 1);
      if (id !== requestId.current) return;
      // 読み込みの間に新しいイベントが増えると前のページと重なるので、重複は除く
      setEvents((list) => [...list, ...res.events.filter((e) => !list.some((x) => x.id === e.id))]);
      setPage(res.meta.current_page);
      setLastPage(res.meta.last_page);
    } catch (e) {
      if (!handleApiError(e)) setAllError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  // 戻ってきたときに参加状況（my-events）と閲覧履歴を最新にする
  useFocusEffect(
    useCallback(() => {
      reload();
      getHistory().then(setHistory);
    }, [reload]),
  );
  // 「コミュニティ全体」を初めて表示したときに1ページ目を読む
  useFocusEffect(
    useCallback(() => {
      if (segment === 'all' && loadedFilter.current !== filter) loadFirst(filter);
    }, [segment, filter, loadFirst]),
  );

  const changeSegment = (s: Segment) => {
    setSegmentChoice(s);
    if (s === 'all' && loadedFilter.current !== filter) loadFirst(filter);
  };

  const changeFilter = (f: Filter) => {
    if (f === filter) return;
    setFilter(f);
    setEvents([]);
    loadFirst(f);
  };

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([reload(), segment === 'all' ? loadFirst(filter) : null, getHistory().then(setHistory)]);
    setRefreshing(false);
  };

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
  );

  const header = (
    <View style={styles.header}>
      <SegmentedControl options={SEGMENTS} value={segment} onChange={changeSegment} />
      {segment === 'all' ? <FilterChips options={FILTERS} value={filter} onChange={changeFilter} /> : null}
    </View>
  );

  if (segment === 'mine') {
    const open = mine.filter((ev) => ev.status === 'open');
    const closed = mine.filter((ev) => ev.status === 'closed');
    return (
      <FlatList
        data={showClosed ? [...open, ...closed] : open}
        keyExtractor={(ev) => String(ev.id)}
        renderItem={({ item }) => <EventRow event={item} communityId={communityId} />}
        ListHeaderComponent={header}
        ListFooterComponent={
          <>
            {closed.length > 0 ? (
              <Pressable
                onPress={() => setShowClosed((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showClosed }}
                style={styles.closedToggle}
              >
                <Text style={styles.closedToggleText}>
                  {showClosed ? '終了したイベントを隠す' : `終了したイベント（${closed.length}）を表示`}
                </Text>
              </Pressable>
            ) : null}
            <HistorySection
              entries={history}
              onRemove={async (id) => {
                await removeFromHistory(id);
                setHistory((h) => h.filter((e) => e.eventId !== id));
              }}
            />
          </>
        }
        ListEmptyComponent={
          closed.length > 0 ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>参加中のイベントはありません</Text>
              <Button title="コミュニティのイベントを見る" variant="secondary" onPress={() => changeSegment('all')} />
            </View>
          )
        }
        contentContainerStyle={styles.list}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={refreshControl}
      />
    );
  }

  const tagsFor = (ev: CommunityEvent): EventTag[] => {
    if (ev.is_organizer) return ['organizer'];
    const s = myStatus.get(ev.id);
    if (s === 'accepted') return ['joined'];
    if (s === 'invited') return ['invited'];
    return [];
  };

  return (
    <FlatList
      data={events}
      keyExtractor={(ev) => String(ev.id)}
      renderItem={({ item }) => (
        <EventRow
          event={item}
          communityId={communityId}
          sub={[`${item.member_count}人`, item.photo_count > 0 ? `写真${item.photo_count}枚` : null]
            .filter(Boolean)
            .join(' · ')}
          tags={tagsFor(item)}
        />
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        loadingAll ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : allError ? (
          <View style={styles.empty}>
            <Text style={styles.errorText}>{allError}</Text>
            <Button title="再読み込み" variant="secondary" onPress={() => loadFirst(filter)} />
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{EMPTY_TEXT[filter]}</Text>
          </View>
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      contentContainerStyle={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={refreshControl}
    />
  );
}

function HistorySection({
  entries,
  onRemove,
}: {
  entries: HistoryEntry[];
  onRemove: (eventId: number) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <View style={styles.historySection}>
      <View style={styles.historyHeader}>
        <Ionicons name="time-outline" size={14} color={colors.textSub} />
        <Text style={styles.historyTitle}>最近見た公開イベント</Text>
      </View>
      {entries.slice(0, 10).map((entry) => (
        <Pressable
          key={entry.eventId}
          style={styles.historyRow}
          onPress={() => router.push(`/${entry.communityId}/events/${entry.eventId}`)}
        >
          <View style={styles.historyInfo}>
            {entry.communityName ? (
              <Text style={styles.historyCommunity} numberOfLines={1}>{entry.communityName}</Text>
            ) : null}
            <Text style={styles.historyName} numberOfLines={1}>{entry.name}</Text>
            {entry.startDate ? (
              <Text style={styles.historyDate}>{entry.startDate.slice(0, 10)}</Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => onRemove(entry.eventId)}
            hitSlop={12}
            accessibilityLabel="履歴から削除"
          >
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </Pressable>
        </Pressable>
      ))}
    </View>
  );
}

// 作成の新しい順（コミュニティ全体の一覧と同じ並び）
function byCreatedDesc(a: MyInvitedEvent, b: MyInvitedEvent): number {
  if (a.created_at === b.created_at) return b.id - a.id;
  return a.created_at < b.created_at ? 1 : -1;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  list: { padding: 16, paddingBottom: 48 },
  header: { gap: 12, marginBottom: 12 },
  loading: { paddingVertical: 24 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyText: { fontSize: 14, color: colors.textSub },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
  closedToggle: { alignItems: 'center', paddingVertical: 16 },
  closedToggleText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  historySection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 4,
  },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  historyTitle: { fontSize: 13, fontWeight: '600', color: colors.textSub },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 8,
  },
  historyInfo: { flex: 1, gap: 2 },
  historyCommunity: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  historyName: { fontSize: 14, color: colors.text, fontWeight: '500' },
  historyDate: { fontSize: 12, color: colors.textMuted },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
});
