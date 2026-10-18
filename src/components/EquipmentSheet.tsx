import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { colors } from '@/constants/theme';
import {
  fetchHousingsForCamera,
  fetchLensesForCameraHousing,
  matchCameraByExif,
  searchCameras,
  searchDivingPoints,
  type Camera,
  type DivingPoint,
  type Housing,
  type Lens,
} from '@/services/supabaseService';
import {
  equipmentSetLabel,
  loadMyEquipment,
  type MyEquipmentSet,
} from '@/services/myEquipmentService';

export interface EquipmentParams {
  cameraMake?: string;
  cameraModel?: string;
  housingId?: number | null;
  lensId?: number | null;
  pointName?: string;
  pointId?: number | null;
}

interface Props {
  /** プレビュー表示する写真のURI */
  uri: string;
  /** EXIF から取得したカメラメーカー（自動マッチングに使用） */
  exifMake?: string | null;
  /** EXIF から取得したカメラモデル（自動マッチングに使用） */
  exifModel?: string | null;
  onSubmit: (params: EquipmentParams) => void;
  onCancel: () => void;
  submitLabel?: string;
  skipLabel?: string;
}

export default function EquipmentSheet({
  uri,
  exifMake,
  exifModel,
  onSubmit,
  onCancel,
  submitLabel = '追加する',
  skipLabel = '情報なしで追加',
}: Props) {
  const { width } = useWindowDimensions();

  const [cameraQuery, setCameraQuery] = useState('');
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [cameraSuggestions, setCameraSuggestions] = useState<Camera[]>([]);
  const [showCameraSugg, setShowCameraSugg] = useState(false);
  const [housings, setHousings] = useState<Housing[]>([]);
  const [selectedHousing, setSelectedHousing] = useState<Housing | null>(null);
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [selectedLens, setSelectedLens] = useState<Lens | null>(null);

  const [pointName, setPointName] = useState('');
  const [pointId, setPointId] = useState<number | null>(null);
  const [pointSuggestions, setPointSuggestions] = useState<DivingPoint[]>([]);
  const [showPointSugg, setShowPointSugg] = useState(false);

  const [activeField, setActiveField] = useState<'camera' | 'point' | null>(null);
  const cameraDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [myEquipment, setMyEquipment] = useState<MyEquipmentSet[]>([]);

  useEffect(() => {
    loadMyEquipment().then(setMyEquipment);
  }, []);

  const applyMyEquipment = (set: MyEquipmentSet) => {
    setSelectedCamera(set.camera);
    setCameraQuery(set.camera.display_name ?? `${set.camera.brand ?? ''} ${set.camera.model}`.trim());
    setCameraSuggestions([]);
    setShowCameraSugg(false);
    setActiveField(null);
    setSelectedHousing(set.housing);
    setSelectedLens(set.lens);
    if (set.housing) {
      fetchLensesForCameraHousing(set.camera.id, set.housing.id).then(setLenses);
    } else {
      setLenses([]);
    }
    fetchHousingsForCamera(set.camera.id).then(setHousings);
  };

  // EXIF情報が渡された場合、起動時にカメラをモデル名でファジーマッチして自動選択する
  useEffect(() => {
    if (!exifMake && !exifModel) return;
    matchCameraByExif(exifMake ?? null, exifModel ?? null).then((cam) => {
      if (cam) {
        setSelectedCamera(cam);
        setCameraQuery(cam.display_name ?? `${cam.brand ?? ''} ${cam.model}`.trim());
        fetchHousingsForCamera(cam.id).then(setHousings);
      } else {
        // 候補なし → 検索欄にEXIF文字列を入れて手動選択を促す
        setCameraQuery([exifMake, exifModel].filter(Boolean).join(' '));
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onCameraChange = (text: string) => {
    setCameraQuery(text);
    setSelectedCamera(null);
    setActiveField('camera');
    setShowCameraSugg(true);
    if (cameraDebounce.current) clearTimeout(cameraDebounce.current);
    cameraDebounce.current = setTimeout(async () => {
      setCameraSuggestions(await searchCameras(text));
    }, 300);
  };

  const selectCamera = (cam: Camera) => {
    setSelectedCamera(cam);
    setCameraQuery(cam.display_name ?? `${cam.brand ?? ''} ${cam.model}`.trim());
    setCameraSuggestions([]);
    setShowCameraSugg(false);
    setActiveField(null);
    setSelectedHousing(null);
    setLenses([]);
    setSelectedLens(null);
    fetchHousingsForCamera(cam.id).then(setHousings);
  };

  const clearCamera = () => {
    setSelectedCamera(null);
    setCameraQuery('');
    setCameraSuggestions([]);
    setHousings([]);
    setSelectedHousing(null);
    setLenses([]);
    setSelectedLens(null);
  };

  const selectHousing = (h: Housing | null) => {
    setSelectedHousing(h);
    setSelectedLens(null);
    setLenses([]);
    if (selectedCamera && h) fetchLensesForCameraHousing(selectedCamera.id, h.id).then(setLenses);
  };

  const onPointChange = (text: string) => {
    setPointName(text);
    setPointId(null);
    setActiveField('point');
    setShowPointSugg(true);
    if (pointDebounce.current) clearTimeout(pointDebounce.current);
    pointDebounce.current = setTimeout(async () => {
      setPointSuggestions(await searchDivingPoints(text));
    }, 400);
  };

  const selectPoint = (p: DivingPoint) => {
    setPointName(p.name);
    setPointId(p.id);
    setPointSuggestions([]);
    setShowPointSugg(false);
    setActiveField(null);
  };

  const submit = () =>
    onSubmit({
      cameraMake: selectedCamera?.brand ?? undefined,
      cameraModel: selectedCamera ? (selectedCamera.display_name ?? selectedCamera.model) : undefined,
      housingId: selectedHousing?.id ?? undefined,
      lensId: selectedLens?.id ?? undefined,
      pointName: pointName.trim() || undefined,
      pointId: pointId ?? undefined,
    });

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Text style={styles.cancel}>キャンセル</Text>
        </Pressable>
        <Text style={styles.title}>撮影情報（任意）</Text>
        <Pressable onPress={submit} hitSlop={12}>
          <Text style={styles.done}>{submitLabel}</Text>
        </Pressable>
      </View>



      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Image
            source={{ uri }}
            style={[styles.preview, { height: Math.round(width * 0.5) }]}
            resizeMode="contain"
          />

          {/* EXIF由来のカメラ情報バナー */}
          {(exifMake || exifModel) ? (
            <View style={styles.exifBanner}>
              <Ionicons name="camera-outline" size={14} color={colors.textSub} />
              <Text style={styles.exifText}>
                EXIF: {[exifMake, exifModel].filter(Boolean).join(' ')}
              </Text>
            </View>
          ) : null}

          {/* カメラ */}
          <View style={styles.field}>
            <Text style={styles.label}>カメラ</Text>
            {selectedCamera ? (
              <View style={styles.selectedRow}>
                <Text style={styles.selectedText} numberOfLines={1}>
                  {selectedCamera.brand ? `${selectedCamera.brand} ` : ''}
                  {selectedCamera.display_name ?? selectedCamera.model}
                </Text>
                <Pressable onPress={clearCamera} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : (
              <TextInput
                style={styles.input}
                value={cameraQuery}
                onChangeText={onCameraChange}
                onFocus={() => { setActiveField('camera'); setShowCameraSugg(true); }}
                onBlur={() => setTimeout(() => setShowCameraSugg(false), 400)}
                placeholder="例: TG-6, OM-5"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                returnKeyType="next"
              />
            )}
            {!selectedCamera && showCameraSugg && cameraSuggestions.length > 0 ? (
              <View style={[styles.inlineSugg, { marginTop: 6 }]}>
                <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="always" bounces={false} nestedScrollEnabled>
                  {cameraSuggestions.map((cam) => (
                    <Pressable key={cam.id} style={styles.suggRow} onPress={() => selectCamera(cam)}>
                      <Text style={styles.suggName}>
                        {cam.display_name ?? `${cam.brand ?? ''} ${cam.model}`.trim()}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          {/* マイ機材クイック選択（カメラ確定後、一致するセットのみ） */}
          {(() => {
            if (!selectedCamera) return null;
            const matched = myEquipment.filter((s) => s.camera.id === selectedCamera.id);
            if (matched.length === 0) return null;
            return (
              <View style={styles.field}>
                <Text style={styles.myEquipLabel}>マイ機材から選ぶ</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.myEquipChips}>
                  {matched.map((set) => {
                    const active = selectedHousing?.id === set.housing?.id && selectedLens?.id === set.lens?.id;
                    return (
                      <Pressable
                        key={set.id}
                        style={[styles.myEquipChip, active && styles.myEquipChipOn]}
                        onPress={() => applyMyEquipment(set)}
                      >
                        <Text style={[styles.myEquipChipText, active && styles.myEquipChipTextOn]} numberOfLines={1}>
                          {equipmentSetLabel(set)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            );
          })()}

          {/* ハウジング */}
          {selectedCamera && housings.length > 0 ? (
            <View style={styles.field}>
              <Text style={styles.label}>ハウジング</Text>
              {selectedHousing ? (
                <View style={styles.selectedRow}>
                  <Text style={styles.selectedText} numberOfLines={1}>
                    {selectedHousing.brand ? `${selectedHousing.brand} ` : ''}{selectedHousing.model}
                  </Text>
                  <Pressable onPress={() => selectHousing(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.inlineSugg}>
                  <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" bounces={false} nestedScrollEnabled>
                    {housings.map((h) => (
                      <Pressable key={h.id} style={styles.suggRow} onPress={() => selectHousing(h)}>
                        <Text style={styles.suggName}>{h.brand ? `${h.brand} ` : ''}{h.model}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          ) : null}

          {/* レンズ */}
          {selectedCamera && selectedHousing && lenses.length > 0 ? (
            <View style={styles.field}>
              <Text style={styles.label}>レンズ</Text>
              {selectedLens ? (
                <View style={styles.selectedRow}>
                  <Text style={styles.selectedText} numberOfLines={1}>
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

          {/* 撮影ポイント */}
          <View style={styles.field}>
            <Text style={styles.label}>
              撮影ポイント{pointId ? '　✓ DB連携済み' : ''}
            </Text>
            <TextInput
              style={styles.input}
              value={pointName}
              onChangeText={onPointChange}
              onFocus={() => { setActiveField('point'); setShowPointSugg(true); }}
              onBlur={() => setTimeout(() => setShowPointSugg(false), 400)}
              placeholder="例: 石垣島 川平石崎"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            {showPointSugg && pointSuggestions.length > 0 ? (
              <View style={[styles.inlineSugg, { marginTop: 6 }]}>
                <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="always" bounces={false} nestedScrollEnabled>
                  {pointSuggestions.map((p) => (
                    <Pressable key={p.id} style={styles.suggRow} onPress={() => selectPoint(p)}>
                      <Text style={styles.suggName}>{p.name}</Text>
                      {p.prefecture ? <Text style={styles.suggSub}>{p.prefecture}</Text> : null}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          <Pressable style={styles.skipBtn} onPress={() => onSubmit({})}>
            <Text style={styles.skipText}>{skipLabel}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  cancel: { fontSize: 15, color: colors.textSub },
  done: { fontSize: 15, fontWeight: '600', color: colors.primary },
  suggestions: {
    maxHeight: 200,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  inlineSugg: {
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card, overflow: 'hidden',
  },
  suggRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
  suggName: { fontSize: 14, fontWeight: '600', color: colors.text },
  suggSub: { fontSize: 12, color: colors.textSub, fontStyle: 'italic' },
  body: { padding: 16, gap: 16, paddingBottom: 48 },
  preview: { width: '100%', borderRadius: 12, backgroundColor: '#000' },
  exifBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  exifText: { fontSize: 12, color: colors.textSub },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
  selectedRow: {
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
  selectedText: { fontSize: 15, color: colors.primary, fontWeight: '500', flex: 1 },
  skipBtn: { paddingVertical: 12, alignItems: 'center' },
  skipText: { fontSize: 14, color: colors.textMuted },
  myEquipLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  myEquipChips: { flexDirection: 'row', gap: 8 },
  myEquipChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
    maxWidth: 220,
  },
  myEquipChipOn: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  myEquipChipText: { fontSize: 13, color: colors.textSub },
  myEquipChipTextOn: { color: colors.primary, fontWeight: '600' },
});
