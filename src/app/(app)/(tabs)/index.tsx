import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { Button, FormError, errorMessage } from '@/components/ui';
import { canEditEncyclopedia } from '@/constants/roles';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import {
  equipmentSetLabel,
  loadMyEquipment,
  type MyEquipmentSet,
} from '@/services/myEquipmentService';
import {
  type Camera, type DivingPoint, type Housing, type Lens,
  fetchHousingsForCamera, fetchLensesForCameraHousing,
  matchCameraByExif, searchCameras, searchCreatures, searchDivingPoints,
} from '@/services/supabaseService';
import type { EncyclopediaEntry, EncyclopediaEntryDetail, EncyclopediaSort, Tag } from '@/types';
import { consumeEncyclopediaStale, markEncyclopediaStale } from '@/utils/encyclopediaStale';
import { parseExifCamera } from '@/utils/exif';

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
  return (
    <EncyclopediaList
      key={current.id}
      communityId={current.id}
      canEdit={canEditEncyclopedia(current.role)}
    />
  );
}

function EncyclopediaList({ communityId, canEdit }: { communityId: number; canEdit: boolean }) {
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
  const [creating, setCreating] = useState(false);
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

  const onCreated = (entry: EncyclopediaEntryDetail) => {
    setCreating(false);
    markEncyclopediaStale();
    router.push({
      pathname: '/[communityId]/encyclopedia/[entryId]',
      params: { communityId: String(communityId), entryId: String(entry.id), name: entry.japanese_name },
    });
  };

  return (
    <>
      <View style={styles.root}>
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
        {canEdit ? (
          <Pressable
            onPress={() => setCreating(true)}
            accessibilityRole="button"
            accessibilityLabel="図鑑に登録"
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          >
            <Ionicons name="camera-outline" size={24} color={colors.white} />
          </Pressable>
        ) : null}
      </View>

      <Modal
        visible={creating}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreating(false)}
      >
        <CreateEntrySheet
          communityId={communityId}
          onClose={() => setCreating(false)}
          onCreated={onCreated}
        />
      </Modal>
    </>
  );
}

function CreateEntrySheet({
  communityId,
  onClose,
  onCreated,
}: {
  communityId: number;
  onClose: () => void;
  onCreated: (entry: EncyclopediaEntryDetail) => void;
}) {
  const { handleApiError } = useSession();
  const [japaneseName, setJapaneseName] = useState('');
  const [scientificName, setScientificName] = useState('');
  const [creatureId, setCreatureId] = useState<number | null>(null);
  const [creatureSuggestions, setCreatureSuggestions] = useState<{ id: number; name: string; scientific_name: string | null }[]>([]);
  const [showCreatureSuggestions, setShowCreatureSuggestions] = useState(false);
  const [pointName, setPointName] = useState('');
  const [pointId, setPointId] = useState<number | null>(null);
  const [pointSuggestions, setPointSuggestions] = useState<DivingPoint[]>([]);
  const [showPointSuggestions, setShowPointSuggestions] = useState(false);
  const [cameraQuery, setCameraQuery] = useState('');
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [cameraSuggestions, setCameraSuggestions] = useState<Camera[]>([]);
  const [housings, setHousings] = useState<Housing[]>([]);
  const [selectedHousing, setSelectedHousing] = useState<Housing | null>(null);
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [selectedLens, setSelectedLens] = useState<Lens | null>(null);
  const [activeField, setActiveField] = useState<'creature' | 'point' | 'camera' | null>(null);
  const [myEquipment, setMyEquipment] = useState<MyEquipmentSet[]>([]);
  const [imageAsset, setImageAsset] = useState<{ uri: string; mimeType: string; ext: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creatureDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadMyEquipment().then(setMyEquipment); }, []);

  const applyMyEquipment = (set: MyEquipmentSet) => {
    handleCameraSelect(set.camera);
    setSelectedHousing(set.housing);
    setSelectedLens(set.lens);
    if (set.housing) {
      fetchLensesForCameraHousing(set.camera.id, set.housing.id).then(setLenses);
    }
  };

  // カメラ選択時にハウジングを取得
  const handleCameraSelect = (cam: Camera) => {
    setSelectedCamera(cam);
    setCameraQuery(cam.display_name ?? `${cam.brand ?? ''} ${cam.model}`.trim());
    setCameraSuggestions([]);
    setActiveField(null);
    setSelectedHousing(null); setLenses([]); setSelectedLens(null);
    fetchHousingsForCamera(cam.id).then(setHousings);
  };

  const clearCamera = () => {
    setSelectedCamera(null); setCameraQuery(''); setCameraSuggestions([]);
    setHousings([]); setSelectedHousing(null); setLenses([]); setSelectedLens(null);
  };

  const onCameraChange = (text: string) => {
    setCameraQuery(text); setSelectedCamera(null); setActiveField('camera');
    if (cameraDebounce.current) clearTimeout(cameraDebounce.current);
    cameraDebounce.current = setTimeout(async () => {
      setCameraSuggestions(await searchCameras(text));
    }, 300);
  };

  const onJaChange = (text: string) => {
    setJapaneseName(text);
    setCreatureId(null);
    setActiveField('creature');
    setShowCreatureSuggestions(true);
    if (creatureDebounce.current) clearTimeout(creatureDebounce.current);
    creatureDebounce.current = setTimeout(async () => {
      setCreatureSuggestions(await searchCreatures(text));
    }, 400);
  };

  const selectCreature = (item: { id: number; name: string; scientific_name: string | null }) => {
    setJapaneseName(item.name);
    setScientificName(item.scientific_name ?? '');
    setCreatureId(item.id);
    setCreatureSuggestions([]);
    setShowCreatureSuggestions(false);
    setActiveField(null);
  };

  const onPointChange = (text: string) => {
    setPointName(text);
    setPointId(null);
    setActiveField('point');
    setShowPointSuggestions(true);
    if (pointDebounce.current) clearTimeout(pointDebounce.current);
    pointDebounce.current = setTimeout(async () => {
      setPointSuggestions(await searchDivingPoints(text));
    }, 400);
  };

  const selectPoint = (point: DivingPoint) => {
    setPointName(point.name);
    setPointId(point.id);
    setPointSuggestions([]);
    setShowPointSuggestions(false);
    setActiveField(null);
  };

  const handleHousingSelect = (h: Housing | null) => {
    setSelectedHousing(h);
    setSelectedLens(null); setLenses([]);
    if (selectedCamera && h) fetchLensesForCameraHousing(selectedCamera.id, h.id).then(setLenses);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      quality: 0.85,
      exif: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    setImageAsset({ uri: asset.uri, mimeType, ext });
    // EXIFからカメラをモデル名でファジーマッチして自動選択
    const { make: exifMake, model: exifModel } = parseExifCamera(asset.exif);
    if ((exifMake || exifModel) && !selectedCamera) {
      matchCameraByExif(exifMake, exifModel).then((cam) => {
        if (cam) {
          handleCameraSelect(cam);
        } else {
          setCameraQuery([exifMake, exifModel].filter(Boolean).join(' '));
        }
      });
    }
  };

  const submit = async () => {
    const jName = japaneseName.trim();
    const sName = scientificName.trim();
    if (!jName) { setError('和名を入力してください'); return; }
    if (!sName) { setError('学名を入力してください'); return; }
    if (!imageAsset) { setError('写真を選んでください'); return; }
    setSaving(true);
    setError(null);
    try {
      const entry = await api.createEncyclopediaEntry(communityId, {
        japaneseName: jName,
        scientificName: sName,
        creatureId,
        pointName: pointName.trim() || undefined,
        pointId,
        cameraMake: selectedCamera?.brand ?? undefined,
        cameraModel: selectedCamera ? (selectedCamera.display_name ?? selectedCamera.model) : undefined,
        housingId: selectedHousing?.id ?? undefined,
        lensId: selectedLens?.id ?? undefined,
        fileUri: imageAsset.uri,
        mimeType: imageAsset.mimeType,
        ext: imageAsset.ext,
      });
      onCreated(entry);
    } catch (e) {
      if (handleApiError(e)) return;
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>図鑑に登録</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="閉じる" hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>


      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.sheetBody}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={pickImage}
            accessibilityRole="button"
            accessibilityLabel="写真を選ぶ"
            style={({ pressed }) => [styles.imagePicker, pressed && styles.imagePickerPressed]}
          >
            {imageAsset ? (
              <Image source={{ uri: imageAsset.uri }} style={styles.imagePreview} accessibilityIgnoresInvertColors />
            ) : (
              <View style={styles.imagePickerPlaceholder}>
                <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
                <Text style={styles.imagePickerText}>写真を選ぶ（必須）</Text>
              </View>
            )}
          </Pressable>

          <View style={styles.createField}>
            <Text style={styles.createLabel}>和名{creatureId ? '　✓ 生き物データと連携済み' : ''}</Text>
            <TextInput
              style={styles.createInput}
              value={japaneseName}
              onChangeText={onJaChange}
              onFocus={() => { setActiveField('creature'); setShowCreatureSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowCreatureSuggestions(false), 200)}
              placeholder="例: クマノミ"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              returnKeyType="next"
            />
            {showCreatureSuggestions && creatureSuggestions.length > 0 ? (
              <View style={[styles.inlineSugg, { marginTop: 6 }]}>
                <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="always" bounces={false} nestedScrollEnabled>
                  {creatureSuggestions.map((item) => (
                    <Pressable key={item.id} style={styles.suggRow} onPress={() => selectCreature(item)}>
                      <Text style={styles.suggName}>{item.name}</Text>
                      {item.scientific_name ? <Text style={styles.suggSci}>{item.scientific_name}</Text> : null}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          <View style={styles.createField}>
            <Text style={styles.createLabel}>学名</Text>
            <TextInput
              style={styles.createInput}
              value={scientificName}
              onChangeText={(v) => { setScientificName(v); setCreatureId(null); }}
              placeholder="例: Amphiprion clarkii"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.createField}>
            <Text style={styles.createLabel}>撮影ポイント（任意）{pointId ? '　✓ ポイントDBと連携済み' : ''}</Text>
            <TextInput
              style={styles.createInput}
              value={pointName}
              onChangeText={onPointChange}
              onFocus={() => { setActiveField('point'); setShowPointSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowPointSuggestions(false), 200)}
              placeholder="例: 石垣島 川平石崎"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            {showPointSuggestions && pointSuggestions.length > 0 ? (
              <View style={[styles.inlineSugg, { marginTop: 6 }]}>
                <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="always" bounces={false} nestedScrollEnabled>
                  {pointSuggestions.map((point) => (
                    <Pressable key={point.id} style={styles.suggRow} onPress={() => selectPoint(point)}>
                      <Text style={styles.suggName}>{point.name}</Text>
                      {point.prefecture ? <Text style={styles.suggSci}>{point.prefecture}</Text> : null}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>撮影機材（任意）</Text>

          {/* カメラ */}
          {selectedCamera ? (
            <View style={styles.selectedEquip}>
              <Text style={styles.selectedEquipText} numberOfLines={1}>
                {selectedCamera.brand ? `${selectedCamera.brand} ` : ''}{selectedCamera.display_name ?? selectedCamera.model}
              </Text>
              <Pressable onPress={clearCamera} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.createField}>
              <Text style={styles.createLabel}>カメラ</Text>
              <TextInput
                style={styles.createInput}
                value={cameraQuery}
                onChangeText={onCameraChange}
                onFocus={() => setActiveField('camera')}
                onBlur={() => setTimeout(() => { if (activeField === 'camera') setActiveField(null); }, 200)}
                placeholder="例: TG-6, OM-5"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                returnKeyType="next"
              />
              {activeField === 'camera' && cameraSuggestions.length > 0 ? (
                <View style={[styles.inlineSugg, { marginTop: 6 }]}>
                  <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="always" bounces={false} nestedScrollEnabled>
                    {cameraSuggestions.map((cam) => (
                      <Pressable key={cam.id} style={styles.suggRow} onPress={() => handleCameraSelect(cam)}>
                        <Text style={styles.suggName}>{cam.display_name ?? `${cam.brand ?? ''} ${cam.model}`.trim()}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          )}

          {/* マイ機材クイック選択（カメラ確定後、一致するセットのみ） */}
          {(() => {
            if (!selectedCamera) return null;
            const matched = myEquipment.filter((s) => s.camera.id === selectedCamera.id);
            if (matched.length === 0) return null;
            return (
              <View style={styles.createField}>
                <Text style={styles.myEquipLabel}>マイ機材から選ぶ</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                  {matched.map((set) => {
                    const active = selectedHousing?.id === set.housing?.id && selectedLens?.id === set.lens?.id;
                    return (
                      <Pressable
                        key={set.id}
                        style={[styles.chip, active && styles.chipOn]}
                        onPress={() => applyMyEquipment(set)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextOn]} numberOfLines={1}>
                          {equipmentSetLabel(set)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            );
          })()}

          {/* ハウジング（カメラ選択後） */}
          {selectedCamera && housings.length > 0 ? (
            <View style={styles.createField}>
              <Text style={styles.createLabel}>ハウジング</Text>
              {selectedHousing ? (
                <View style={styles.selectedEquip}>
                  <Text style={styles.selectedEquipText} numberOfLines={1}>
                    {selectedHousing.brand ? `${selectedHousing.brand} ` : ''}{selectedHousing.model}
                  </Text>
                  <Pressable onPress={() => handleHousingSelect(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.inlineSugg}>
                  <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" bounces={false} nestedScrollEnabled>
                    {housings.map((h) => (
                      <Pressable key={h.id} style={styles.suggRow} onPress={() => handleHousingSelect(h)}>
                        <Text style={styles.suggName}>{h.brand ? `${h.brand} ` : ''}{h.model}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          ) : null}

          {/* レンズ（ハウジング選択後） */}
          {selectedCamera && selectedHousing && lenses.length > 0 ? (
            <View style={styles.createField}>
              <Text style={styles.createLabel}>レンズ</Text>
              {selectedLens ? (
                <View style={styles.selectedEquip}>
                  <Text style={styles.selectedEquipText} numberOfLines={1}>
                    {selectedLens.brand ? `${selectedLens.brand} ` : ''}{selectedLens.model}
                  </Text>
                  <Pressable onPress={() => setSelectedLens(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.inlineSugg}>
                  <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" bounces={false} nestedScrollEnabled>
                    {lenses.map((l) => (
                      <Pressable key={l.id} style={styles.suggRow} onPress={() => setSelectedLens(l)}>
                        <Text style={styles.suggName}>{l.brand ? `${l.brand} ` : ''}{l.model}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          ) : null}

          <FormError message={error} />
          <Button title="登録する" onPress={submit} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
  imagePicker: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    height: 200,
  },
  imagePickerPressed: { opacity: 0.7 },
  imagePreview: { width: '100%', height: '100%' },
  imagePickerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  imagePickerText: { fontSize: 14, color: colors.textMuted },
  suggestions: {
    maxHeight: 200,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
  suggName: { fontSize: 14, fontWeight: '600', color: colors.text },
  suggSci: { fontSize: 12, color: colors.textSub, fontStyle: 'italic' },
  createField: { gap: 6 },
  createLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  createInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  inlineSugg: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  selectedEquip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.primaryBg,
  },
  selectedEquipText: { fontSize: 15, color: colors.primary, fontWeight: '500', flex: 1 },
  chipsRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  chipText: { fontSize: 13, color: colors.textSub },
  chipTextOn: { color: colors.primary, fontWeight: '600' },
  myEquipLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  list: { padding: PADDING, paddingBottom: 96 },
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
