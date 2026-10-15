import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { FilterChips } from '@/components/SegmentedControl';
import { Button, errorMessage } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import type { EncyclopediaEntry, EncyclopediaSort, Tag } from '@/types';
import { consumeEncyclopediaStale } from '@/utils/encyclopediaStale';

// Web版の図鑑と同じ並び替え
const SORTS: { value: EncyclopediaSort; label: string }[] = [
  { value: 'name_asc', label: '和名順' },
  { value: 'scientific_asc', label: '学名順' },
  { value: 'newest', label: '登録が新しい順' },
  { value: 'oldest', label: '登録が古い順' },
  { value: 'photos_desc', label: '写真が多い順' },
];

const PADDING = 16;
const GAP = 12;

type Filters = { q: string; sort: EncyclopediaSort; tagIds: number[] };

// コミュニティ図鑑の一覧。検索・並び替え・タグで絞り込み、下までスクロールすると続きを読む
export default function EncyclopediaTab() {
  const { current } = useCommunity();
  if (!current) return null;
  // コミュニティを切り替えたら、絞り込みと読み込んだ一覧をリセットする
  return <EncyclopediaList key={current.id} communityId={current.id} />;
}

function EncyclopediaList({ communityId }: { communityId: number }) {
  const { handleApiError } = useSession();
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP) / 2;

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({ q: '', sort: 'name_asc', tagIds: [] });
  const [entries, setEntries] = useState<EncyclopediaEntry[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // 古い応答を捨てるための番号と、初回の読み込みを済ませたか
  const requestId = useRef(0);
  const loaded = useRef(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFirst = useCallback(
    async (f: Filters) => {
      const id = ++requestId.current;
      loaded.current = true;
      setLoading(true);
      setError(null);
      try {
        const res = await api.fetchEncyclopedia(communityId, { page: 1, q: f.q, sort: f.sort, tagIds: f.tagIds });
        if (id !== requestId.current) return;
        setEntries(res.entries);
        setTags(res.tags);
        setTotal(res.meta.total);
        setPage(res.meta.current_page);
        setLastPage(res.meta.last_page);
      } catch (e) {
        if (id !== requestId.current) return;
        loaded.current = false;
        if (!handleApiError(e)) setError(errorMessage(e));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [communityId, handleApiError],
  );

  const loadMore = async () => {
    if (loading || loadingMore || page >= lastPage) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const res = await api.fetchEncyclopedia(communityId, { page: page + 1, ...filters });
      if (id !== requestId.current) return;
      setEntries((list) => [...list, ...res.entries.filter((e) => !list.some((x) => x.id === e.id))]);
      setPage(res.meta.current_page);
      setLastPage(res.meta.last_page);
    } catch (e) {
      if (!handleApiError(e)) setError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      // 詳細でタグの変更・写真の削除をして戻ってきたときも読み直す
      if (consumeEncyclopediaStale() || !loaded.current) loadFirst(filters);
    }, [loadFirst, filters]),
  );

  const applyFilters = (next: Filters) => {
    setFilters(next);
    setEntries([]);
    loadFirst(next);
  };

  // 入力が止まってから0.3秒後に検索する（Web版と同じ）
  const changeQuery = (text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const q = text.trim();
      if (q !== filters.q) applyFilters({ ...filters, q });
    }, 300);
  };

  const toggleTag = (tagId: number) => {
    const tagIds = filters.tagIds.includes(tagId)
      ? filters.tagIds.filter((id) => id !== tagId)
      : [...filters.tagIds, tagId];
    applyFilters({ ...filters, tagIds });
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadFirst(filters);
    setRefreshing(false);
  };

  const filtered = filters.q !== '' || filters.tagIds.length > 0;

  const header = (
    <View style={styles.header}>
      {total !== null ? (
        <Text style={styles.count}>
          {filtered ? `${total}種が見つかりました` : `コミュニティで${total}種登録済み`}
        </Text>
      ) : null}
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={changeQuery}
          placeholder="和名・学名で検索"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={styles.searchInput}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <FilterChips
          options={SORTS}
          value={filters.sort}
          onChange={(sort) => sort !== filters.sort && applyFilters({ ...filters, sort })}
        />
      </ScrollView>
      {tags.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {tags.map((tag) => {
            const selected = filters.tagIds.includes(tag.id);
            return (
              <Pressable
                key={tag.id}
                onPress={() => toggleTag(tag.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.tag, selected && styles.tagSelected]}
              >
                <Text style={[styles.tagLabel, selected && styles.tagLabelSelected]}>#{tag.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={entries}
      keyExtractor={(e) => String(e.id)}
      numColumns={2}
      columnWrapperStyle={styles.columns}
      renderItem={({ item }) => <EntryCard entry={item} width={cardWidth} communityId={communityId} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : error ? (
          <View style={styles.empty}>
            <Text style={styles.errorText}>{error}</Text>
            <Button title="再読み込み" variant="secondary" onPress={() => loadFirst(filters)} />
          </View>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="fish-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {filtered ? '条件に一致する生き物が見つかりませんでした' : 'まだ図鑑に登録された生き物がいません'}
            </Text>
          </View>
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    />
  );
}

function EntryCard({ entry, width, communityId }: { entry: EncyclopediaEntry; width: number; communityId: number }) {
  const open = () =>
    router.push({
      pathname: '/[communityId]/encyclopedia/[entryId]',
      params: { communityId: String(communityId), entryId: String(entry.id), name: entry.japanese_name },
    });

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, { width }, pressed && styles.cardPressed]}
    >
      <View style={[styles.thumb, { height: width }]}>
        {entry.thumbnail_url ? (
          <Image source={{ uri: entry.thumbnail_url }} style={styles.thumbImage} accessibilityIgnoresInvertColors />
        ) : (
          <Ionicons name="fish-outline" size={28} color={colors.textMuted} />
        )}
        {entry.photo_count > 1 ? (
          <View style={styles.photoCount}>
            <Ionicons name="images-outline" size={11} color={colors.white} />
            <Text style={styles.photoCountText}>{entry.photo_count}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardText}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.japanese_name}
        </Text>
        <Text style={styles.scientific} numberOfLines={1}>
          {entry.scientific_name}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: PADDING, paddingBottom: 48 },
  columns: { gap: GAP, marginBottom: GAP },
  header: { gap: 10, marginBottom: 14 },
  count: { fontSize: 13, color: colors.textSub },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: colors.text },
  chipRow: { gap: 8 },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.primaryBg,
  },
  tagSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  tagLabel: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  tagLabelSelected: { color: colors.white, fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.7 },
  thumb: { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  thumbImage: { width: '100%', height: '100%' },
  photoCount: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  photoCountText: { fontSize: 11, color: colors.white, fontWeight: '600' },
  cardText: { paddingHorizontal: 10, paddingVertical: 8, gap: 1 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  scientific: { fontSize: 12, fontStyle: 'italic', color: colors.textSub },
  loading: { paddingVertical: 24 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  emptyText: { fontSize: 14, color: colors.textSub, textAlign: 'center' },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
