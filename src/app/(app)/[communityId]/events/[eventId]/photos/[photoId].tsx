import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { errorMessage } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import { fetchCreatureById, fetchHousingById, fetchLensById, searchCreatures, type CreatureDetail, type Housing, type Lens } from '@/services/supabaseService';
import type { EventPhoto } from '@/types';

type DiveOption = { o: number; s: string | null };

function parseDiveOptions(raw?: string): DiveOption[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export default function PhotoDetailScreen() {
  const params = useLocalSearchParams<{
    communityId: string; eventId: string; photoId: string;
    url?: string; name?: string; sci?: string;
    uploader?: string; cid?: string; dive?: string;
    edit?: string; mine?: string;
    dso?: string; dives?: string; ename?: string;
    canpush?: string; pushed_enc?: string; pushed_com?: string; species_enc?: string;
    cam_make?: string; cam_model?: string; housing_id?: string; lens_id?: string;
  }>();

  const communityId = Number(params.communityId);
  const eventId = Number(params.eventId);
  const photoId = Number(params.photoId);
  const { handleApiError } = useSession();

  const canEdit = params.edit === '1';
  const isMine = params.mine === '1';
  const canPushInitial = params.canpush === '1';
  const initPushedEnc = params.pushed_enc === '1';
  const initPushedCom = params.pushed_com === '1';

  const initUrl = params.url;
  const initName = params.name || null;
  const initSci = params.sci || null;
  const initUploader = params.uploader || null;
  const initCreatureId = params.cid ? Number(params.cid) : null;
  const initCamMake = params.cam_make || null;
  const initCamModel = params.cam_model || null;
  const initHousingId = params.housing_id ? Number(params.housing_id) : null;
  const initLensId = params.lens_id ? Number(params.lens_id) : null;
  const initDiving = params.dive === '1';
  const initDiveSortOrder = params.dso ? Number(params.dso) : null;
  const diveOptions = parseDiveOptions(params.dives);

  const [photo, setPhoto] = useState<EventPhoto | null>(null);
  const [creature, setCreature] = useState<CreatureDetail | null>(null);
  const [creatureLoading, setCreatureLoading] = useState(
    !!(initCreatureId || (initName && initName.length >= 2)),
  );
  const [fetching, setFetching] = useState(!initUrl);

  // 同定モーダル
  const [editVisible, setEditVisible] = useState(false);
  const [editJaName, setEditJaName] = useState('');
  const [editSciName, setEditSciName] = useState('');
  const [editCreatureId, setEditCreatureId] = useState<number | null>(null);
  const [editDiveSortOrder, setEditDiveSortOrder] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<{ id: number; name: string; scientific_name: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pushedEnc, setPushedEnc] = useState(initPushedEnc);
  const [pushedCom, setPushedCom] = useState(initPushedCom);
  const [pushing, setPushing] = useState(false);
  const suggestDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [equipHousing, setEquipHousing] = useState<Housing | null>(null);
  const [equipLens, setEquipLens] = useState<Lens | null>(null);

  useEffect(() => {
    if (initHousingId) fetchHousingById(initHousingId).then(setEquipHousing);
    if (initLensId) fetchLensById(initLensId).then(setEquipLens);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 表示用（保存後に更新される）
  const [displayJaName, setDisplayJaName] = useState<string | null>(initName);
  const [displaySciName, setDisplaySciName] = useState<string | null>(initSci);
  const [displayDiveSortOrder, setDisplayDiveSortOrder] = useState<number | null>(initDiveSortOrder);

  const { width: screenWidth } = useWindowDimensions();
  const imageHeight = Math.round(screenWidth * 0.75);

  useEffect(() => {
    if (initUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await api.fetchEventPhoto(communityId, eventId, photoId);
        if (!cancelled) {
          setPhoto(p);
          setDisplayJaName(p.japanese_name);
          setDisplaySciName(p.scientific_name);
          setDisplayDiveSortOrder(p.dive_sort_order);
          setPushedEnc(p.pushed_to_encyclopedia);
          setPushedCom(p.pushed_to_community);
        }
      } catch (e) {
        if (!cancelled) handleApiError(e);
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [communityId, eventId, photoId, handleApiError, initUrl]);

  const creatureId = photo?.creature_id ?? initCreatureId;
  const jaNameForLookup = photo?.japanese_name ?? initName;

  useEffect(() => {
    let cancelled = false;
    if (creatureId) {
      setCreatureLoading(true);
      fetchCreatureById(creatureId)
        .then((c) => { if (!cancelled) { setCreature(c); setCreatureLoading(false); } })
        .catch(() => { if (!cancelled) setCreatureLoading(false); });
    } else if (jaNameForLookup && jaNameForLookup.length >= 2) {
      setCreatureLoading(true);
      searchCreatures(jaNameForLookup).then(async (results) => {
        if (cancelled) return;
        if (results.length === 0) { setCreatureLoading(false); return; }
        const match = results.find(r => r.name === jaNameForLookup) ?? results[0];
        const c = await fetchCreatureById(match.id);
        if (!cancelled) { setCreature(c); setCreatureLoading(false); }
      }).catch(() => { if (!cancelled) setCreatureLoading(false); });
    } else {
      setCreatureLoading(false);
    }
    return () => { cancelled = true; };
  }, [creatureId, jaNameForLookup]);

  const openEdit = () => {
    setEditJaName(displayJaName ?? '');
    setEditSciName(displaySciName ?? '');
    setEditCreatureId(photo?.creature_id ?? initCreatureId);
    setEditDiveSortOrder(photo?.dive_sort_order ?? initDiveSortOrder);
    setSuggestions([]);
    setSaveError(null);
    setEditVisible(true);
  };

  const onJaNameChange = (text: string) => {
    setEditJaName(text);
    setEditCreatureId(null);
    if (suggestDebounce.current) clearTimeout(suggestDebounce.current);
    suggestDebounce.current = setTimeout(async () => {
      const results = await searchCreatures(text);
      setSuggestions(results);
    }, 400);
  };

  const selectSuggestion = (item: { id: number; name: string; scientific_name: string | null }) => {
    setEditJaName(item.name);
    setEditSciName(item.scientific_name ?? '');
    setEditCreatureId(item.id);
    setSuggestions([]);
  };

  const saveEdit = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.updateEventPhoto(communityId, eventId, photoId, {
        japanese_name: editJaName.trim() || null,
        scientific_name: editSciName.trim() || null,
        creature_id: editCreatureId,
        is_identified: editJaName.trim().length > 0,
        dive_sort_order: editDiveSortOrder,
      });
      setDisplayJaName(updated.japanese_name);
      setDisplaySciName(updated.scientific_name);
      setDisplayDiveSortOrder(updated.dive_sort_order ?? null);
      setPhoto(updated);
      setEditVisible(false);
    } catch (e) {
      if (!handleApiError(e)) setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const doPush = async () => {
    setPushing(true);
    try {
      const updated = await api.pushEventPhoto(communityId, eventId, photoId);
      setPushedEnc(updated.pushed_to_encyclopedia);
      setPushedCom(updated.pushed_to_community);
      setPhoto(updated);
    } catch (e) {
      if (!handleApiError(e)) Alert.alert('Pushに失敗しました', e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setPushing(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('写真を削除', 'この写真を削除しますか？この操作は取り消せません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除', style: 'destructive', onPress: async () => {
          try {
            await api.deleteEventPhoto(communityId, eventId, photoId);
            const { router } = await import('expo-router');
            router.back();
          } catch (e) {
            handleApiError(e);
          }
        },
      },
    ]);
  };

  const displayUrl = photo?.display_url ?? initUrl ?? '';
  const isDiving = photo ? photo.is_diving_photo : initDiving;
  const uploaderName = photo ? photo.uploader_name : initUploader;
  const title = params.ename ? decodeURIComponent(params.ename) : '写真';

  const headerRight = canEdit ? () => (
    <Pressable onPress={openEdit} hitSlop={12} style={{ marginRight: 8 }}>
      <Ionicons name="create-outline" size={22} color={colors.primary} />
    </Pressable>
  ) : undefined;

  if (fetching) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: '写真' }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!displayUrl) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: '写真' }} />
        <Text style={styles.errorText}>写真が見つかりませんでした</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
        <Stack.Screen options={{ title, headerRight }} />

        <Image
          source={{ uri: displayUrl }}
          style={[styles.image, { height: imageHeight }]}
          resizeMode="cover"
        />

        <View style={styles.head}>
          {displayJaName ? (
            <>
              <Text style={styles.jaName}>{displayJaName}</Text>
              {displaySciName ? <Text style={styles.sciName}>{displaySciName}</Text> : null}
            </>
          ) : isDiving ? (
            <Text style={styles.jaName}>未同定</Text>
          ) : (
            <Text style={styles.jaName}>その他の写真</Text>
          )}
          {displayDiveSortOrder != null ? (
            <Text style={styles.diveMeta}>{displayDiveSortOrder}本目</Text>
          ) : null}
          {uploaderName ? <Text style={styles.uploader}>by {uploaderName}</Text> : null}
        </View>

        {(initCamMake || initCamModel || equipHousing || equipLens) ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="camera-outline" size={14} color={colors.primary} />
              <Text style={styles.sectionTitle}>撮影機材</Text>
            </View>
            {(initCamMake || initCamModel) ? (
              <InfoBlock label="カメラ" value={[initCamMake, initCamModel].filter(Boolean).join(' ')} />
            ) : null}
            {equipHousing ? (
              <InfoBlock label="ハウジング" value={[equipHousing.brand, equipHousing.model].filter(Boolean).join(' ')} />
            ) : null}
            {equipLens ? (
              <InfoBlock label="レンズ" value={[equipLens.brand, equipLens.model].filter(Boolean).join(' ')} />
            ) : null}
          </View>
        ) : null}

        {(creatureLoading || creature) ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="fish-outline" size={14} color={colors.primary} />
              <Text style={styles.sectionTitle}>生き物情報</Text>
            </View>
            {creatureLoading ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: 12 }} />
            ) : creature ? (
              <>
                {creature.description ? <InfoBlock label="説明" value={creature.description} multiline /> : null}
                {creature.habitat ? <InfoBlock label="生息地・場所" value={creature.habitat} multiline /> : null}
                {(creature.size || creature.depth_range || creature.rarity) ? (
                  <View style={styles.statsRow}>
                    {creature.size ? <StatCell label="大きさ" value={creature.size} /> : null}
                    {creature.depth_range ? <StatCell label="水深" value={creature.depth_range} /> : null}
                    {creature.rarity ? <StatCell label="希少度" value={creature.rarity} /> : null}
                  </View>
                ) : null}
                {(creature.category || creature.subcategory) ? (
                  <InfoBlock label="カテゴリ" value={[creature.category, creature.subcategory].filter(Boolean).join(' › ')} />
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        {canPushInitial ? (
          <PushSection
            isDiving={isDiving}
            isIdentified={!!(displayJaName || photo?.is_identified)}
            pushedEnc={pushedEnc}
            pushedCom={pushedCom}
            pushing={pushing}
            onPush={doPush}
          />
        ) : null}

        {isMine ? (
          <Pressable style={styles.deleteBtn} onPress={confirmDelete}>
            <Ionicons name="trash-outline" size={15} color={colors.danger} />
            <Text style={styles.deleteBtnText}>この写真を削除</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* 同定・編集モーダル */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setEditVisible(false)} />

        <View style={styles.sheet}>
          <View style={styles.toolbar}>
            <Pressable onPress={() => setEditVisible(false)} hitSlop={12}>
              <Text style={styles.toolbarCancel}>キャンセル</Text>
            </Pressable>
            <Text style={styles.toolbarTitle}>同定・編集</Text>
            <Pressable onPress={saveEdit} hitSlop={12} disabled={saving}>
              {saving
                ? <ActivityIndicator color={colors.primary} />
                : <Text style={styles.toolbarDone}>保存</Text>
              }
            </Pressable>
          </View>

          <View style={styles.sheetBody}>
            {/* 和名 */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>和名</Text>
              <TextInput
                style={styles.fieldInput}
                value={editJaName}
                onChangeText={onJaNameChange}
                placeholder="例: アカククリ"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
              />
              {suggestions.length > 0 ? (
                <View style={styles.inlineSugg}>
                  <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="always" bounces={false}>
                    {suggestions.map(item => (
                      <Pressable key={String(item.id)} style={styles.suggestionRow} onPress={() => selectSuggestion(item)}>
                        <Text style={styles.suggestionName}>{item.name}</Text>
                        {item.scientific_name ? <Text style={styles.suggestionSci}>{item.scientific_name}</Text> : null}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            {/* 学名 */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>学名</Text>
              <TextInput
                style={styles.fieldInput}
                value={editSciName}
                onChangeText={v => { setEditSciName(v); setEditCreatureId(null); }}
                placeholder="例: Platax pinnatus"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>

            {/* ダイブ順序（ダイビング写真かつダイブ情報がある場合のみ） */}
            {isDiving && diveOptions.length > 0 ? (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>ダイブ</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.diveChipsRow}>
                  <Pressable
                    style={[styles.diveChip, editDiveSortOrder === null && styles.diveChipSelected]}
                    onPress={() => setEditDiveSortOrder(null)}
                  >
                    <Text style={[styles.diveChipText, editDiveSortOrder === null && styles.diveChipTextSelected]}>
                      未設定
                    </Text>
                  </Pressable>
                  {diveOptions.map(d => (
                    <Pressable
                      key={d.o}
                      style={[styles.diveChip, editDiveSortOrder === d.o && styles.diveChipSelected]}
                      onPress={() => setEditDiveSortOrder(editDiveSortOrder === d.o ? null : d.o)}
                    >
                      <Text style={[styles.diveChipText, editDiveSortOrder === d.o && styles.diveChipTextSelected]}>
                        {d.o}本目{d.s ? ` · ${d.s}` : ''}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

function PushSection({
  isDiving, isIdentified, pushedEnc, pushedCom, pushing, onPush,
}: {
  isDiving: boolean;
  isIdentified: boolean;
  pushedEnc: boolean;
  pushedCom: boolean;
  pushing: boolean;
  onPush: () => void;
}) {
  if (!isDiving) return null;

  const alreadyPushed = isIdentified ? pushedEnc : pushedCom;
  const destination = isIdentified ? 'コミュニティ図鑑' : '未同定一覧';

  return (
    <View style={styles.pushSection}>
      {alreadyPushed ? (
        <View style={styles.pushedRow}>
          <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
          <Text style={styles.pushedText}>{destination}にPush済み</Text>
        </View>
      ) : (
        <Pressable style={[styles.pushBtn, pushing && styles.pushBtnDisabled]} onPress={onPush} disabled={pushing}>
          {pushing
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="arrow-up-circle-outline" size={16} color={colors.primary} />}
          <Text style={styles.pushBtnText}>{pushing ? 'Push中...' : `${destination}にPush`}</Text>
        </Pressable>
      )}
    </View>
  );
}

function InfoBlock({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, multiline && styles.infoMultiline]}>{value}</Text>
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, color: colors.textSub, textAlign: 'center' },
  container: { paddingBottom: 48, gap: 20 },
  image: { width: '100%', borderRadius: 0 },

  head: { paddingHorizontal: 16, paddingTop: 16, gap: 4, alignItems: 'center' },
  jaName: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center' },
  sciName: { fontSize: 14, color: colors.textSub, fontStyle: 'italic', textAlign: 'center' },
  diveMeta: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 2 },
  uploader: { fontSize: 12, color: colors.textMuted, marginTop: 2, textAlign: 'center' },

  section: {
    marginHorizontal: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 14,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  infoBlock: { gap: 4 },
  infoLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, color: colors.text },
  infoMultiline: { lineHeight: 22 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCell: { flex: 1, gap: 4 },
  statValue: { fontSize: 14, color: colors.text, fontWeight: '500' },

  pushSection: { marginHorizontal: 16 },
  pushedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: colors.primaryBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  pushedText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  pushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  pushBtnDisabled: { opacity: 0.6 },
  pushBtnText: { fontSize: 14, color: colors.primary, fontWeight: '600' },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
  },
  deleteBtnText: { fontSize: 14, color: colors.danger, fontWeight: '600' },

  // 同定モーダル
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  inlineSugg: {
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card, overflow: 'hidden', marginTop: 6,
  },
  suggestionRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 2,
  },
  suggestionName: { fontSize: 14, fontWeight: '600', color: colors.text },
  suggestionSci: { fontSize: 12, color: colors.textSub, fontStyle: 'italic' },

  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toolbarTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  toolbarCancel: { fontSize: 15, color: colors.textSub },
  toolbarDone: { fontSize: 15, fontWeight: '600', color: colors.primary },

  sheetBody: { padding: 16, gap: 14, paddingBottom: 40 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bg,
  },

  // ダイブチップ
  diveChipsRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  diveChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  diveChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  diveChipText: { fontSize: 13, color: colors.textSub },
  diveChipTextSelected: { color: colors.primary, fontWeight: '600' },

  saveError: { fontSize: 13, color: colors.danger },
});
