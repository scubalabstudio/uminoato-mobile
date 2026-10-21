import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { NetworkErrorView } from '@/components/NetworkErrorView';
import { colors } from '@/constants/theme';
import * as api from '@/services/apiService';
import type { EncyclopediaEntry } from '@/types';

export default function PublicEncyclopediaScreen() {
  const { communityId, name } = useLocalSearchParams<{ communityId: string; name?: string }>();
  const cid = Number(communityId);
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - 12 * 2 - CARD_GAP) / 2;

  const [entries, setEntries] = useState<EncyclopediaEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (searchQ: string, pg: number, append = false) => {
    if (pg === 1) append ? setRefreshing(true) : setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await api.fetchPublicEncyclopedia(cid, { q: searchQ, page: pg });
      setEntries(prev => append ? [...prev, ...res.entries] : res.entries);
      setTotal(res.meta.total ?? res.entries.length);
      setHasMore(pg < res.meta.last_page);
      setPage(pg);
      setError(null);
      setNotFound(false);
    } catch (e) {
      if (e instanceof api.ApiError && e.status === 404) {
        setNotFound(true);
      } else {
        setError(e instanceof Error ? e.message : 'エラーが発生しました');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [cid]);

  useEffect(() => { load(debouncedQ, 1); }, [load, debouncedQ]);

  const onChangeQ = (text: string) => {
    setQ(text);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setDebouncedQ(text), 350);
  };

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    load(debouncedQ, page + 1, true);
  };

  const goEntry = (entry: EncyclopediaEntry) =>
    router.push({
      pathname: '/umi-no-ato/public/[communityId]/encyclopedia/[entryId]',
      params: { communityId, entryId: String(entry.id), name: entry.japanese_name },
    } as never);

  const title = name ? `${name}の図鑑` : '図鑑';

  if (notFound) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title }} />
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={styles.notFoundTitle}>図鑑が見つかりません</Text>
          <Text style={styles.notFoundSub}>このコミュニティの図鑑は公開されていないか、削除されました。</Text>
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace('/' as never)}
            style={styles.retryBtn}
          >
            <Text style={styles.retryText}>戻る</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title }} />

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={q}
          onChangeText={onChangeQ}
          placeholder="和名・学名で検索"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : error ? (
        <View style={styles.center}>
          <NetworkErrorView message={error} onRetry={() => load(debouncedQ, 1)} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={e => String(e.id)}
          numColumns={2}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.row}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(debouncedQ, 1, true)}
              tintColor={colors.primary}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            <Text style={styles.count}>{total}種</Text>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footer} /> : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>
                {debouncedQ ? `「${debouncedQ}」に一致する生き物がありません` : '図鑑がまだ空です'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={[styles.card, { width: cardWidth }]} onPress={() => goEntry(item)}>
              {item.thumbnail_url ? (
                <Image source={{ uri: item.thumbnail_url }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <View style={[styles.thumb, styles.noThumb]}>
                  <Ionicons name="fish-outline" size={28} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.jaName} numberOfLines={2}>{item.japanese_name}</Text>
                {item.scientific_name ? (
                  <Text style={styles.sciName} numberOfLines={1}>{item.scientific_name}</Text>
                ) : null}
                {item.tags.length > 0 ? (
                  <Text style={styles.tags} numberOfLines={1}>
                    {item.tags.map(t => t.name).join(' · ')}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const CARD_GAP = 10;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    height: 42,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },

  loader: { marginTop: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, marginTop: 40 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 },
  notFoundTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  notFoundSub: { fontSize: 14, color: colors.textSub, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8,
    backgroundColor: colors.primaryBg, borderWidth: 1, borderColor: colors.primary,
  },
  retryText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  empty: { fontSize: 14, color: colors.textSub, textAlign: 'center' },

  count: { fontSize: 12, color: colors.textMuted, paddingHorizontal: 12, marginBottom: 8 },
  list: { paddingHorizontal: 12, paddingBottom: 32 },
  row: { gap: CARD_GAP },
  footer: { paddingVertical: 16 },

  card: {
    backgroundColor: colors.card,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: CARD_GAP,
  },
  thumb: { width: '100%', aspectRatio: 4 / 3 },
  noThumb: { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 8, gap: 2 },
  jaName: { fontSize: 14, fontWeight: '600', color: colors.text },
  sciName: { fontSize: 11, fontStyle: 'italic', color: colors.textSub },
  tags: { fontSize: 11, color: colors.primary, marginTop: 2 },
});
