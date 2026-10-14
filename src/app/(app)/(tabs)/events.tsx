import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { EventRow, type EventTag } from '@/components/EventRow';
import { FilterChips, SegmentedControl } from '@/components/SegmentedControl';
import { Button, errorMessage } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
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
  const { current } = useCommunity();
  if (!current) return null;
  // コミュニティを切り替えたら、選択中のタブ・読み込んだ一覧をリセットする
  return <EventsList key={current.id} communityId={current.id} />;
}

function EventsList({ communityId }: { communityId: number }) {
  const { handleApiError } = useSession();
  const { invitedEvents, reload } = useCommunity();

  // my-events には主催イベントも「参加済み」として入る（作成時に主催者もメンバー登録されるため）
  const mine = useMemo(
    () =>
      invitedEvents
        .filter((ev) => ev.community_id === communityId && ev.member_status === 'accepted')
        .sort(byStartDateDesc),
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

  // 戻ってきたときに参加状況（my-events）を最新にする
  useFocusEffect(
    useCallback(() => {
      reload();
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
    await Promise.all([reload(), segment === 'all' ? loadFirst(filter) : null]);
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
          closed.length > 0 ? (
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
          ) : null
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

// 開催日の新しい順（日付未定は最後）
function byStartDateDesc(a: MyInvitedEvent, b: MyInvitedEvent): number {
  if (a.start_date === b.start_date) return b.id - a.id;
  if (!a.start_date) return 1;
  if (!b.start_date) return -1;
  return a.start_date < b.start_date ? 1 : -1;
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 48 },
  header: { gap: 12, marginBottom: 12 },
  loading: { paddingVertical: 24 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyText: { fontSize: 14, color: colors.textSub },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
  closedToggle: { alignItems: 'center', paddingVertical: 16 },
  closedToggleText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
});
