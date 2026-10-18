import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
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

import { Button, Field, FormError, errorMessage } from '@/components/ui';
import EquipmentSheet, { type EquipmentParams } from '@/components/EquipmentSheet';
import { canEditEncyclopedia, ROLE_TEMPORARY } from '@/constants/roles';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import { searchCreatures } from '@/services/supabaseService';
import { parseExifCamera } from '@/utils/exif';
import type { UnidentifiedPhoto } from '@/types';

const PADDING = 16;
const GAP = 4;
const COLUMNS = 3;

// イベントで未同定一覧へPushされ、まだ種が確定していない写真。管理者・図鑑編集者は名前を入れて同定できる
export default function UnidentifiedTab() {
  const { current } = useCommunity();
  if (!current) return null;
  return (
    <UnidentifiedList
      key={current.id}
      communityId={current.id}
      canEdit={canEditEncyclopedia(current.role)}
      canUpload={current.role !== ROLE_TEMPORARY}
    />
  );
}

function UnidentifiedList({ communityId, canEdit, canUpload }: { communityId: number; canEdit: boolean; canUpload: boolean }) {
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
  const [uploading, setUploading] = useState(false);
  const [pendingAsset, setPendingAsset] = useState<{ uri: string; mimeType: string; ext: string; exifMake: string | null; exifModel: string | null } | null>(null);
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

  const uploadPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      quality: 0.85,
      exif: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const { make: exifMake, model: exifModel } = parseExifCamera(asset.exif);
    setPendingAsset({ uri: asset.uri, mimeType, ext, exifMake, exifModel });
  };

  const doUpload = async (equipment: EquipmentParams) => {
    if (!pendingAsset) return;
    setPendingAsset(null);
    setUploading(true);
    try {
      const photo = await api.uploadUnidentifiedPhoto(
        communityId, pendingAsset.uri, pendingAsset.mimeType, pendingAsset.ext, equipment,
      );
      setPhotos((list) => [photo, ...list]);
      setTotal((n) => (n === null ? 1 : n + 1));
    } catch (e) {
      if (!handleApiError(e)) Alert.alert(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const onIdentified = (photo: UnidentifiedPhoto) => {
    setPhotos((list) => list.filter((p) => p.id !== photo.id));
    setTotal((n) => (n === null ? n : Math.max(0, n - 1)));
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
      {canUpload ? (
        <Pressable
          onPress={uploadPhoto}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel="写真をアップロード"
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          {uploading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Ionicons name="camera-outline" size={24} color={colors.white} />
          )}
        </Pressable>
      ) : null}
      </View>

      <Modal
        visible={pendingAsset !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPendingAsset(null)}
      >
        {pendingAsset ? (
          <EquipmentSheet
            uri={pendingAsset.uri}
            exifMake={pendingAsset.exifMake}
            exifModel={pendingAsset.exifModel}
            onSubmit={doUpload}
            onCancel={() => setPendingAsset(null)}
          />
        ) : null}
      </Modal>

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
}: {
  communityId: number;
  photo: UnidentifiedPhoto;
  canEdit: boolean;
  onClose: () => void;
  onIdentified: (photo: UnidentifiedPhoto) => void;
}) {
  const { handleApiError } = useSession();
  const { reload } = useCommunity();
  const { width } = useWindowDimensions();
  const [japaneseName, setJapaneseName] = useState('');
  const [scientificName, setScientificName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ id: number; name: string; scientific_name: string | null }[]>([]);
  const suggDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onJaNameChange = (text: string) => {
    setJapaneseName(text);
    if (suggDebounce.current) clearTimeout(suggDebounce.current);
    suggDebounce.current = setTimeout(async () => {
      setSuggestions(await searchCreatures(text));
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

  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>未同定の写真</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="閉じる" hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.sheetBody}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Image
          source={{ uri: photo.display_url }}
          style={[styles.photo, { height: Math.round((width - PADDING * 2) * 0.75) }]}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <View style={styles.meta}>
          {photo.event_id !== null ? (
            <Pressable onPress={openEvent} accessibilityRole="link" style={styles.eventLink}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={styles.eventLinkText} numberOfLines={1}>
                {photo.event_name ?? 'イベント'}
                {photo.dive_sort_order ? `（${photo.dive_sort_order}本目）` : ''}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          ) : null}
          <Text style={styles.metaText}>
            {photo.uploader_name ?? '退会したユーザー'} · {formatDate(photo.uploaded_at)}
          </Text>
        </View>

        {canEdit ? (
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
            <Button title="同定する" onPress={identify} loading={saving} />
            <Text style={styles.hint}>
              同定しても図鑑には載りません。図鑑に載せるには、イベントの写真から図鑑へ送ってください（今はWeb版で行えます）。
            </Text>
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
  root: { flex: 1 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  fabPressed: { opacity: 0.8 },
  list: { padding: PADDING, paddingBottom: 96 },
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
  sheetBody: { padding: PADDING, gap: 16, paddingBottom: 48 },
  photo: { width: '100%', borderRadius: 12, backgroundColor: '#000' },
  meta: { gap: 4 },
  eventLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  eventLinkText: { fontSize: 15, fontWeight: '600', color: colors.primary, flexShrink: 1 },
  metaText: { fontSize: 13, color: colors.textSub },
  form: { gap: 12 },
  hint: { fontSize: 12, color: colors.textSub, lineHeight: 18 },
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
