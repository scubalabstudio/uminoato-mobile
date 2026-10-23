import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { NetworkErrorView } from '@/components/NetworkErrorView';
import { ZoomableImage } from '@/components/ZoomableImage';
import { Button, Field, FormError, errorMessage } from '@/components/ui';
import { canEditEncyclopedia } from '@/constants/roles';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import { useSession } from '@/context/SessionContext';
import { useModeration } from '@/hooks/useModeration';
import * as api from '@/services/apiService';
import { searchCreatures } from '@/services/supabaseService';
import type { UnidentifiedPhoto } from '@/types';
import { markEncyclopediaStale } from '@/utils/encyclopediaStale';

const PADDING = 16;
const GAP = 4;
const COLUMNS = 3;

// イベントで未同定一覧へPushされ、まだ種が確定していない写真。管理者・図鑑編集者は名前を入れて同定できる
export default function UnidentifiedTab() {
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
    <UnidentifiedList
      key={current.id}
      communityId={current.id}
      canEdit={canEditEncyclopedia(current.role)}
    />
  );
}

function UnidentifiedList({ communityId, canEdit }: { communityId: number; canEdit: boolean }) {
  const { handleApiError } = useSession();
  const { width } = useWindowDimensions();
  const size = (width - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  const [photos, setPhotos] = useState<UnidentifiedPhoto[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<UnidentifiedPhoto | null>(null);
  const requestId = useRef(0);

  const loadFirst = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.fetchUnidentifiedPhotos(communityId, 1);
      if (id !== requestId.current) return;
      setPhotos(res.photos);
      setTotal(res.meta.total);
      setPage(res.meta.current_page);
      setLastPage(res.meta.last_page);
    } catch (e) {
      if (id !== requestId.current) return;
      if (!handleApiError(e)) setError(errorMessage(e));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [communityId, handleApiError]);

  const loadMore = async () => {
    if (loading || loadingMore || page >= lastPage) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const res = await api.fetchUnidentifiedPhotos(communityId, page + 1);
      if (id !== requestId.current) return;
      // 読み込みの間に同定・Pushされると前のページと重なるので、重複は除く
      setPhotos((list) => [...list, ...res.photos.filter((p) => !list.some((x) => x.id === p.id))]);
      setPage(res.meta.current_page);
      setLastPage(res.meta.last_page);
    } catch (e) {
      if (!handleApiError(e)) setError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  // イベントで新しくPushされた写真を拾うため、タブに戻るたびに読み直す
  useFocusEffect(
    useCallback(() => {
      loadFirst();
    }, [loadFirst]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await loadFirst();
    setRefreshing(false);
  };

  // 一覧からは外すが、続けて図鑑に載せるかを選べるよう画面は閉じない
  const onIdentified = (photo: UnidentifiedPhoto) => {
    setPhotos((list) => list.filter((p) => p.id !== photo.id));
    setTotal((n) => (n === null ? n : Math.max(0, n - 1)));
  };

  // ブロックした人の写真は一覧から外し、画面を閉じる
  const onBlocked = (userId: number) => {
    const removed = photos.filter((p) => p.uploader_id === userId).length;
    setPhotos((list) => list.filter((p) => p.uploader_id !== userId));
    setTotal((n) => (n === null ? n : Math.max(0, n - removed)));
    setSelected(null);
  };

  const header = (
    <Text style={styles.lead}>
      {canEdit
        ? '写真をタップして名前を入力すると同定済みになり、この一覧から外れます。'
        : '図鑑編集者が名前を入力すると同定済みになります。'}
      {total ? `（${total}件）` : ''}
    </Text>
  );

  return (
    <>
      <View style={styles.root}>
      <FlatList
        data={photos}
        keyExtractor={(p) => String(p.id)}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.columns}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelected(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.event_name ?? 'イベント'}の写真`}
            style={({ pressed }) => [styles.cell, { width: size, height: size }, pressed && styles.cellPressed]}
          >
            <Image source={{ uri: item.thumbnail_url }} style={styles.cellImage} accessibilityIgnoresInvertColors />
          </Pressable>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading && photos.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : error ? (
            <View style={styles.empty}>
              <Text style={styles.errorText}>{error}</Text>
              <Button title="再読み込み" variant="secondary" onPress={loadFirst} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="fish-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>未同定の写真はありません</Text>
            </View>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.list}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      />
      </View>

      <Modal
        visible={selected !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        {selected ? (
          <PhotoSheet
            key={selected.id}
            communityId={communityId}
            photo={selected}
            canEdit={canEdit}
            onClose={() => setSelected(null)}
            onIdentified={onIdentified}
            onBlocked={onBlocked}
          />
        ) : null}
      </Modal>
    </>
  );
}

function PhotoSheet({
  communityId,
  photo,
  canEdit,
  onClose,
  onIdentified,
  onBlocked,
}: {
  communityId: number;
  photo: UnidentifiedPhoto;
  canEdit: boolean;
  onClose: () => void;
  onIdentified: (photo: UnidentifiedPhoto) => void;
  onBlocked: (userId: number) => void;
}) {
  const { user, handleApiError } = useSession();
  // このシートはモーダルの中なので、メニューもこの中に置く（iOS は外のモーダルを重ねられない）
  const moderation = useModeration();
  const openModeration = () => {
    moderation.openMenu({
      title: 'この写真について',
      report: { type: 'event_photo', id: photo.id, communityId, label: 'この写真' },
      user: photo.uploader_id && photo.uploader_name ? { id: photo.uploader_id, name: photo.uploader_name } : null,
      onBlocked,
    });
  };
  const { reload } = useCommunity();
  const { width } = useWindowDimensions();
  const [japaneseName, setJapaneseName] = useState('');
  const [scientificName, setScientificName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ id: number; name: string; scientific_name: string | null }[]>([]);
  const suggDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggAbort = useRef<AbortController | null>(null);
  // 同定できた名前。入っていれば「図鑑にも載せる」を出す
  const [identifiedName, setIdentifiedName] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushed, setPushed] = useState(false);

  const onJaNameChange = (text: string) => {
    setJapaneseName(text);
    setScientificName('');
    if (suggDebounce.current) clearTimeout(suggDebounce.current);
    suggAbort.current?.abort();
    suggAbort.current = new AbortController();
    const signal = suggAbort.current.signal;
    suggDebounce.current = setTimeout(() => {
      searchCreatures(text, signal).then(setSuggestions).catch(() => {});
    }, 300);
  };

  const selectCreature = (item: { id: number; name: string; scientific_name: string | null }) => {
    setJapaneseName(item.name);
    setScientificName(item.scientific_name ?? '');
    setSuggestions([]);
  };

  const openEvent = () => {
    onClose();
    router.push({
      pathname: '/[communityId]/events/[eventId]',
      params: { communityId: String(communityId), eventId: String(photo.event_id), name: photo.event_name ?? '' },
    });
  };

  const identify = async () => {
    const name = japaneseName.trim();
    if (!name) {
      setError('和名を入力してください');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.identifyPhoto(communityId, photo.id, {
        japanese_name: name,
        scientific_name: scientificName.trim() || null,
      });
      setIdentifiedName(name);
      setSuggestions([]);
      onIdentified(photo);
    } catch (e) {
      if (handleApiError(e)) return;
      // 他の人が先に同定した（422）・ロールが変わった（403）などは一覧を読み直す必要がある
      if (e instanceof api.ApiError && e.status === 403) reload();
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // イベントの写真を図鑑へ送るAPIを使う。未同定一覧に載る写真はイベントが終了済みなので、そのまま送れる
  const doPush = async (body?: Parameters<typeof api.pushEventPhoto>[3]) => {
    setPushing(true);
    setError(null);
    try {
      const result = await api.pushEventPhoto(communityId, photo.event_id, photo.id, body);
      if ('conflict' in result) {
        const { entry_id, japanese_name, photo_count } = result.conflict;
        setPushing(false);
        Alert.alert(
          `「${japanese_name}」が図鑑に登録されています`,
          `同じ名前の図鑑エントリ（写真${photo_count}枚）が既にあります。そちらに追加しますか？`,
          [
            { text: 'キャンセル', style: 'cancel' },
            { text: '新規登録', onPress: () => doPush({ force_new: true }) },
            { text: '追加する', style: 'default', onPress: () => doPush({ target_entry_id: entry_id }) },
          ],
        );
        return;
      }
      markEncyclopediaStale();
      setPushed(true);
    } catch (e) {
      if (handleApiError(e)) return;
      setError(errorMessage(e));
    } finally {
      setPushing(false);
    }
  };

  const pushToEncyclopedia = () => doPush();

  return (
    <View style={styles.sheet}>
      {moderation.element}
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>未同定の写真</Text>
        <View style={styles.sheetActions}>
          {photo.uploader_id !== user?.id ? (
            <Pressable onPress={openModeration} accessibilityRole="button" accessibilityLabel="通報・ブロック" hitSlop={12}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="閉じる" hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.sheetBody}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <ZoomableImage
          uri={photo.display_url}
          style={[styles.photo, { height: Math.round((width - PADDING * 2) * 0.75) }]}
          resizeMode="contain"
        />
        <View style={styles.meta}>
          <Pressable onPress={openEvent} accessibilityRole="link" style={styles.eventLink}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={styles.eventLinkText} numberOfLines={1}>
              {photo.event_name ?? 'イベント'}
              {photo.dive_sort_order ? `（${photo.dive_sort_order}本目）` : ''}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
          <Text style={styles.metaText}>
            {photo.uploader_name ?? '退会したユーザー'} · {formatDate(photo.uploaded_at)}
          </Text>
        </View>

        {identifiedName ? (
          <View style={styles.form}>
            <View style={styles.done}>
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              <Text style={styles.doneText}>「{identifiedName}」として同定しました</Text>
            </View>
            {pushed ? (
              <View style={styles.done}>
                <Ionicons name="book" size={20} color={colors.primary} />
                <Text style={styles.doneText}>図鑑に載せました</Text>
              </View>
            ) : (
              <>
                <Text style={styles.hint}>この写真を図鑑にも載せますか？同じ種の写真は図鑑に5枚まで載せられます。</Text>
                <FormError message={error} />
                <Button title="図鑑にも載せる" onPress={pushToEncyclopedia} loading={pushing} />
              </>
            )}
            <Button title="閉じる" variant="secondary" onPress={onClose} disabled={pushing} />
          </View>
        ) : canEdit ? (
          <View style={styles.form}>
            <Field
              label="和名"
              value={japaneseName}
              onChangeText={onJaNameChange}
              placeholder="例: クマノミ"
              maxLength={255}
              returnKeyType="next"
            />
            {suggestions.length > 0 ? (
              <View style={styles.inlineSugg}>
                <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="always" bounces={false} nestedScrollEnabled>
                  {suggestions.map(item => (
                    <Pressable key={String(item.id)} style={styles.suggRow} onPress={() => selectCreature(item)}>
                      <Text style={styles.suggName}>{item.name}</Text>
                      {item.scientific_name ? <Text style={styles.suggSci}>{item.scientific_name}</Text> : null}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
            <Field
              label="学名（任意）"
              value={scientificName}
              onChangeText={setScientificName}
              placeholder="例: Amphiprion clarkii"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={255}
              returnKeyType="done"
              onSubmitEditing={identify}
            />
            <FormError message={error} />
            <Button title="同定する" onPress={identify} loading={saving} disabled={!japaneseName.trim()} />
            <Text style={styles.hint}>同定したあと、続けて図鑑に載せるかを選べます。</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  root: { flex: 1 },
  list: { padding: PADDING, paddingBottom: 48 },
  columns: { gap: GAP, marginBottom: GAP },
  lead: { fontSize: 13, color: colors.textSub, lineHeight: 19, marginBottom: 12 },
  cell: { backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  cellPressed: { opacity: 0.7 },
  cellImage: { width: '100%', height: '100%' },
  loading: { paddingVertical: 24 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  emptyText: { fontSize: 14, color: colors.textSub },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
  sheet: { flex: 1, backgroundColor: colors.bg },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PADDING,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  sheetActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  sheetBody: { padding: PADDING, gap: 16, paddingBottom: 48 },
  photo: { width: '100%', borderRadius: 12, backgroundColor: '#000' },
  meta: { gap: 4 },
  eventLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  eventLinkText: { fontSize: 15, fontWeight: '600', color: colors.primary, flexShrink: 1 },
  metaText: { fontSize: 13, color: colors.textSub },
  form: { gap: 12 },
  hint: { fontSize: 12, color: colors.textSub, lineHeight: 18 },
  done: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneText: { fontSize: 15, fontWeight: '600', color: colors.text, flexShrink: 1 },
  inlineSugg: {
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card, overflow: 'hidden',
  },
  suggRow: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 2,
  },
  suggName: { fontSize: 14, fontWeight: '600', color: colors.text },
  suggSci: { fontSize: 12, color: colors.textSub, fontStyle: 'italic' },
});
