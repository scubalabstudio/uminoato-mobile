import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button, errorMessage } from '@/components/ui';
import { canEditEncyclopedia } from '@/constants/roles';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import { fetchCreatureById, fetchHousingById, fetchLensById, type CreatureDetail, type Housing, type Lens } from '@/services/supabaseService';
import type { EncyclopediaEntryDetail, EncyclopediaPhoto, Tag } from '@/types';
import EquipmentSheet, { type EquipmentParams } from '@/components/EquipmentSheet';
import { parseExifCamera } from '@/utils/exif';
import { markEncyclopediaStale } from '@/utils/encyclopediaStale';

// 1種あたりの写真の上限（バックエンドの PHOTO_LIMIT）。超えると古い写真から消える
const PHOTO_LIMIT = 5;

// 図鑑の1種の詳細。写真は横にスワイプして切り替える。管理者・図鑑編集者はタグの編集と写真の削除ができる
export default function EncyclopediaEntryScreen() {
  const params = useLocalSearchParams<{ communityId: string; entryId: string; name?: string }>();
  const communityId = Number(params.communityId);
  const entryId = Number(params.entryId);
  const { handleApiError } = useSession();
  const { communities, reload } = useCommunity();
  const canEdit = canEditEncyclopedia(communities.find((c) => c.id === communityId)?.role);

  const [entry, setEntry] = useState<EncyclopediaEntryDetail | null>(null);
  const [creature, setCreature] = useState<CreatureDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingAsset, setPendingAsset] = useState<{ uri: string; mimeType: string; ext: string; exifMake: string | null; exifModel: string | null } | null>(null);
  const [photoHousing, setPhotoHousing] = useState<Housing | null>(null);
  const [photoLens, setPhotoLens] = useState<Lens | null>(null);

  useEffect(() => {
    setPhotoHousing(null);
    setPhotoLens(null);
    if (!entry) return;
    const p = entry.photos[index];
    if (!p) return;
    if (p.housing_id) fetchHousingById(p.housing_id).then(setPhotoHousing);
    if (p.lens_id) fetchLensById(p.lens_id).then(setPhotoLens);
  }, [index, entry]);

  const load = useCallback(async () => {
    try {
      const e = await api.fetchEncyclopediaEntry(communityId, entryId);
      setEntry(e);
      setIndex((i) => Math.min(i, Math.max(0, e.photos.length - 1)));
      setError(null);
      // 生き物辞書の情報は失敗しても図鑑の表示には影響させない
      if (e.creature_id) fetchCreatureById(e.creature_id).then(setCreature).catch(() => {});
    } catch (err) {
      if (handleApiError(err)) return;
      if (err instanceof api.ApiError && err.status === 404) {
        setError('この生き物は図鑑から削除されました');
        return;
      }
      setError(errorMessage(err));
    }
  }, [communityId, entryId, handleApiError]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onEditError = (err: unknown) => {
    if (handleApiError(err)) return;
    // ロールが変わった（403）ときは、編集ボタンを消すためにコミュニティを読み直す
    if (err instanceof api.ApiError && err.status === 403) reload();
    Alert.alert(errorMessage(err));
  };

  const addPhoto = async () => {
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

  const doAddPhoto = async (equipment: EquipmentParams) => {
    if (!pendingAsset) return;
    setPendingAsset(null);
    setUploading(true);
    try {
      const updated = await api.addEncyclopediaPhoto(communityId, entryId, {
        fileUri: pendingAsset.uri, mimeType: pendingAsset.mimeType, ext: pendingAsset.ext,
        ...equipment,
      });
      setEntry(updated);
      setIndex(updated.photos.length - 1);
      markEncyclopediaStale();
    } catch (err) {
      onEditError(err);
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = (photo: EncyclopediaPhoto) => {
    if (!entry) return;
    const last = entry.photos.length === 1;
    Alert.alert(
      'この写真を削除しますか？',
      last ? '最後の1枚なので、この生き物は図鑑から削除されます。' : undefined,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(photo.id);
            try {
              const { entry_deleted } = await api.deleteEncyclopediaPhoto(communityId, entry.id, photo.id);
              markEncyclopediaStale();
              if (entry_deleted) {
                router.back();
                return;
              }
              const photos = entry.photos.filter((p) => p.id !== photo.id);
              setEntry({ ...entry, photos, photo_count: photos.length, thumbnail_url: photos[0]?.thumbnail_url ?? null });
              setIndex((i) => Math.min(i, photos.length - 1));
            } catch (err) {
              onEditError(err);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  const title = entry?.japanese_name ?? params.name ?? '';

  if (!entry) {
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

  const photo = entry.photos[index] ?? null;

  return (
    <>
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
          onSubmit={doAddPhoto}
          onCancel={() => setPendingAsset(null)}
        />
      ) : null}
    </Modal>
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen
        options={{
          title,
          headerRight: canEdit
            ? () => (
                <Pressable
                  onPress={addPhoto}
                  disabled={uploading}
                  accessibilityRole="button"
                  accessibilityLabel="写真を追加"
                  hitSlop={8}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="camera-outline" size={24} color={colors.primary} />
                  )}
                </Pressable>
              )
            : undefined,
        }}
      />

      <PhotoPager photos={entry.photos} index={index} onIndexChange={setIndex} />

      {photo ? (
        <View style={styles.photoMeta}>
          <View style={styles.flex}>
            <MetaLine icon="person-outline">
              {photo.uploader_name ?? '退会したユーザー'} · {formatDate(photo.uploaded_at)}
            </MetaLine>
            {photo.point_name ? <MetaLine icon="location-outline">{photo.point_name}</MetaLine> : null}
            {photo.camera_make || photo.camera_model ? (
              <MetaLine icon="camera-outline">
                {[photo.camera_make, photo.camera_model].filter(Boolean).join(' ')}
              </MetaLine>
            ) : null}
            {photoHousing ? (
              <MetaLine icon="layers-outline">
                {[photoHousing.brand, photoHousing.model].filter(Boolean).join(' ')}
              </MetaLine>
            ) : null}
            {photoLens ? (
              <MetaLine icon="aperture-outline">
                {[photoLens.brand, photoLens.model].filter(Boolean).join(' ')}
              </MetaLine>
            ) : null}
          </View>
          {canEdit ? (
            <Pressable
              onPress={() => deletePhoto(photo)}
              disabled={deletingId !== null}
              accessibilityRole="button"
              accessibilityLabel="この写真を削除"
              hitSlop={8}
              style={styles.deleteButton}
            >
              {deletingId === photo.id ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.body}>
        <View>
          <Text style={styles.name}>{entry.japanese_name}</Text>
          <Text style={styles.scientific}>{entry.scientific_name}</Text>
        </View>

        <TagSection
          communityId={communityId}
          entry={entry}
          canEdit={canEdit}
          onSaved={(e) => {
            setEntry(e);
            markEncyclopediaStale();
          }}
          onError={onEditError}
        />

        {creature ? <CreatureSection creature={creature} /> : null}

        {canEdit ? (
          <Text style={styles.hint}>
            写真は1種につき{PHOTO_LIMIT}枚まで（今{entry.photos.length}枚）。上限を超えると古い写真から入れ替わります。
          </Text>
        ) : null}
      </View>
    </ScrollView>
    </>
  );
}

function PhotoPager({
  photos,
  index,
  onIndexChange,
}: {
  photos: EncyclopediaPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
}) {
  const { width } = useWindowDimensions();
  const height = Math.round(width * 0.75);

  if (photos.length === 0) {
    return (
      <View style={[styles.noPhoto, { height }]}>
        <Ionicons name="fish-outline" size={32} color={colors.textMuted} />
        <Text style={styles.noPhotoText}>写真なし</Text>
      </View>
    );
  }

  return (
    <View>
      <FlatList
        data={photos}
        keyExtractor={(p) => String(p.id)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.display_url }}
            style={{ width, height, backgroundColor: '#000' }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        )}
        onMomentumScrollEnd={(e) => onIndexChange(Math.round(e.nativeEvent.contentOffset.x / width))}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      />
      {photos.length > 1 ? (
        <View style={styles.dots} accessibilityLabel={`${photos.length}枚中${index + 1}枚目`}>
          {photos.map((p, i) => (
            <View key={p.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TagSection({
  communityId,
  entry,
  canEdit,
  onSaved,
  onError,
}: {
  communityId: number;
  entry: EncyclopediaEntryDetail;
  canEdit: boolean;
  onSaved: (entry: EncyclopediaEntryDetail) => void;
  onError: (err: unknown) => void;
}) {
  const [allTags, setAllTags] = useState<Tag[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const startEdit = async () => {
    setPending(entry.tags.map((t) => t.id));
    setEditing(true);
    if (allTags) return;
    try {
      setAllTags(await api.fetchTags());
    } catch (err) {
      setEditing(false);
      onError(err);
    }
  };

  const toggle = (id: number) =>
    setPending((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const save = async () => {
    setSaving(true);
    try {
      onSaved(await api.updateEncyclopediaTags(communityId, entry.id, pending));
      setEditing(false);
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <Section title="タグを編集">
        {allTags ? (
          <View style={styles.tags}>
            {allTags.map((tag) => {
              const selected = pending.includes(tag.id);
              return (
                <Pressable
                  key={tag.id}
                  onPress={() => toggle(tag.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.tagChoice, selected && styles.tagChoiceSelected]}
                >
                  <Text style={[styles.tagChoiceText, selected && styles.tagChoiceTextSelected]}>{tag.name}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <ActivityIndicator color={colors.primary} style={styles.tagLoading} />
        )}
        <View style={styles.tagActions}>
          <View style={styles.flex}>
            <Button title="キャンセル" variant="secondary" onPress={() => setEditing(false)} disabled={saving} />
          </View>
          <View style={styles.flex}>
            <Button title="保存する" onPress={save} loading={saving} disabled={!allTags} />
          </View>
        </View>
      </Section>
    );
  }

  return (
    <Section
      title="タグ"
      action={
        canEdit ? (
          <Pressable onPress={startEdit} accessibilityRole="button" hitSlop={8} style={styles.editLink}>
            <Ionicons name="pencil" size={13} color={colors.primary} />
            <Text style={styles.editLinkText}>編集</Text>
          </Pressable>
        ) : null
      }
    >
      {entry.tags.length > 0 ? (
        <View style={styles.tags}>
          {entry.tags.map((tag) => (
            <Text key={tag.id} style={styles.tag}>
              {tag.name}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>タグなし</Text>
      )}
    </Section>
  );
}

function CreatureSection({ creature }: { creature: CreatureDetail }) {
  const facts = [
    { label: 'サイズ', value: creature.size },
    { label: '水深', value: creature.depth_range },
    { label: 'レア度', value: creature.rarity },
  ].filter((f) => f.value);
  const category = [creature.category, creature.subcategory].filter(Boolean).join(' › ');

  return (
    <Section title="生き物情報">
      {creature.description ? <Paragraph label="特徴">{creature.description}</Paragraph> : null}
      {creature.habitat ? <Paragraph label="生息環境">{creature.habitat}</Paragraph> : null}
      {facts.length > 0 ? (
        <View style={styles.facts}>
          {facts.map((f) => (
            <View key={f.label} style={styles.fact}>
              <Text style={styles.factLabel}>{f.label}</Text>
              <Text style={styles.factValue}>{f.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {category ? <Paragraph label="分類">{category}</Paragraph> : null}
    </Section>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function Paragraph({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.paragraph}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.paragraphText}>{children}</Text>
    </View>
  );
}

function MetaLine({ icon, children }: { icon: 'person-outline' | 'location-outline' | 'camera-outline' | 'layers-outline' | 'aperture-outline'; children: ReactNode }) {
  return (
    <View style={styles.metaLine}>
      <Ionicons name={icon} size={14} color={colors.textSub} />
      <Text style={styles.metaText} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorBox: { gap: 12, alignSelf: 'stretch' },
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  container: { paddingBottom: 48 },
  noPhoto: { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 6 },
  noPhotoText: { fontSize: 13, color: colors.textSub },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },
  photoMeta: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingTop: 10 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  metaText: { fontSize: 13, color: colors.textSub, flexShrink: 1 },
  deleteButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, gap: 24 },
  name: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center' },
  scientific: { fontSize: 15, fontStyle: 'italic', color: colors.textSub, marginTop: 2, textAlign: 'center' },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editLinkText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    fontSize: 13,
    color: colors.primary,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tagChoice: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  tagChoiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  tagChoiceText: { fontSize: 13, color: colors.text },
  tagChoiceTextSelected: { color: colors.white, fontWeight: '600' },
  tagLoading: { paddingVertical: 12 },
  tagActions: { flexDirection: 'row', gap: 8 },
  muted: { fontSize: 13, color: colors.textMuted },
  paragraph: { gap: 4 },
  paragraphText: { fontSize: 14, color: colors.text, lineHeight: 21 },
  facts: { flexDirection: 'row', gap: 8 },
  fact: { flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 10, gap: 2 },
  factLabel: { fontSize: 12, color: colors.textSub },
  factValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  hint: { fontSize: 12, color: colors.textSub, lineHeight: 18 },
});
