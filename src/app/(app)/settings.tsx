import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/ui';
import { WEB_URL } from '@/config/api';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';
import {
  fetchHousingsForCamera,
  fetchLensesForCameraHousing,
  searchCameras,
  type Camera,
  type Housing,
  type Lens,
} from '@/services/supabaseService';
import {
  addMyEquipmentSet,
  equipmentSetLabel,
  loadMyEquipment,
  removeMyEquipmentSet,
  type MyEquipmentSet,
} from '@/services/myEquipmentService';

export default function SettingsScreen() {
  const { user, signOut, refreshUser } = useSession();
  // Web版でメールアドレスの変更を確認して戻ってきたときなどに、最新の情報にする
  useFocusEffect(
    useCallback(() => {
      refreshUser();
    }, [refreshUser]),
  );
  if (!user) return null;

  const confirmSignOut = () => {
    Alert.alert('ログアウトしますか？', 'この端末からログアウトします。', [
      { text: 'キャンセル', style: 'cancel' },
      { text: 'ログアウト', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.head}>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.userId}>@{user.user_id}</Text>
      </View>

      <View style={styles.card}>
        <NavRow label="プロフィール" value={[user.name, user.rank ?? 'ランク未設定'].join(' ・ ')} href="/profile-edit" />
        <View style={styles.divider} />
        <NavRow label="メールアドレス" value={user.email ?? '未登録'} href="/email-change" />
        <View style={styles.divider} />
        <NavRow label="パスワード" value="変更する" href="/password-change" />
      </View>

      <MyEquipmentSection />

      <View style={styles.card}>
        <Pressable
          onPress={() => router.push('/blocked-users')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, pressed && styles.serviceRowPressed]}
        >
          <Text style={styles.linkLabel}>ブロックしたユーザー</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <OtherServicesSection />

      <AboutSection />

      <Button title="ログアウト" variant="secondary" onPress={confirmSignOut} />

      <Pressable onPress={() => router.push('/withdraw')} accessibilityRole="button" style={styles.withdraw}>
        <Text style={styles.withdrawText}>退会する</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── マイ機材 ────────────────────────────────────────────────────────────────

function MyEquipmentSection() {
  const [sets, setSets] = useState<MyEquipmentSet[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadMyEquipment().then(setSets);
  }, []);

  const handleAdd = (set: MyEquipmentSet) => {
    setSets((prev) => [...prev, set]);
    setAdding(false);
  };

  const handleRemove = (id: string) => {
    Alert.alert('機材セットを削除しますか？', undefined, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除', style: 'destructive',
        onPress: () => removeMyEquipmentSet(id).then(setSets),
      },
    ]);
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>マイ機材</Text>
        <Pressable
          onPress={() => setAdding(true)}
          accessibilityRole="button"
          accessibilityLabel="機材を追加"
          hitSlop={8}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={styles.addBtnText}>追加</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        {sets.length === 0 ? (
          <Text style={styles.empty}>登録済みの機材がありません</Text>
        ) : (
          sets.map((set, i) => (
            <View key={set.id}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.equipRow}>
                <View style={styles.equipInfo}>
                  <Text style={styles.equipCamera} numberOfLines={1}>
                    {set.camera.display_name ?? `${set.camera.brand ?? ''} ${set.camera.model}`.trim()}
                  </Text>
                  {(set.housing || set.lens) ? (
                    <Text style={styles.equipSub} numberOfLines={1}>
                      {[
                        set.housing ? (set.housing.brand ? `${set.housing.brand} ${set.housing.model}` : set.housing.model) : null,
                        set.lens ? (set.lens.brand ? `${set.lens.brand} ${set.lens.model}` : set.lens.model) : null,
                      ].filter(Boolean).join(' / ')}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => handleRemove(set.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="削除"
                >
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      <Modal
        visible={adding}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAdding(false)}
      >
        <AddEquipmentSheet onSaved={handleAdd} onCancel={() => setAdding(false)} />
      </Modal>
    </View>
  );
}

// ── Scubalab のほかのサービス ─────────────────────────────────────────────────

// Web版のトップページと同じ名前・説明。タップでブラウザを開く
const OTHER_SERVICES = [
  {
    name: 'システムチャートボード',
    tagline: '水中撮影機材のシステム構成を、選ぶだけで図に',
    url: 'https://www.scubalab.net/scuba-systemchart',
    icon: require('../../../assets/images/service-systemchart.png'),
  },
  {
    name: '海の本棚',
    tagline: 'ダイビングの本がみつかる書評プラットフォーム',
    url: 'https://www.scubalab.net/scuba-bookshelf',
    icon: require('../../../assets/images/service-bookshelf.png'),
  },
] as const;

function OtherServicesSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Scubalab のほかのサービス</Text>
      <View style={styles.card}>
        {OTHER_SERVICES.map((service, i) => (
          <View key={service.url}>
            {i > 0 ? <View style={styles.divider} /> : null}
            <Pressable
              onPress={() => Linking.openURL(service.url)}
              accessibilityRole="link"
              accessibilityLabel={`${service.name}をブラウザで開く`}
              style={({ pressed }) => [styles.serviceRow, pressed && styles.serviceRowPressed]}
            >
              <Image source={service.icon} style={styles.serviceIcon} accessibilityIgnoresInvertColors />
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.serviceTagline}>{service.tagline}</Text>
              </View>
              <Ionicons name="open-outline" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── このアプリについて ──────────────────────────────────────────────────────

function AboutSection() {
  const version = Constants.expoConfig?.version ?? '-';
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>このアプリについて</Text>
      <View style={styles.card}>
        <InfoRow label="バージョン" value={version} />
        <View style={styles.divider} />
        <LinkRow label="利用規約" url={`${WEB_URL}/umi-no-ato/terms`} />
        <View style={styles.divider} />
        <LinkRow label="プライバシーポリシー" url={`${WEB_URL}/umi-no-ato/privacy`} />
      </View>
    </View>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={`${label}をブラウザで開く`}
      style={({ pressed }) => [styles.row, pressed && styles.serviceRowPressed]}
    >
      <Text style={styles.linkLabel}>{label}</Text>
      <Ionicons name="open-outline" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

// ── 機材追加シート ───────────────────────────────────────────────────────────

function AddEquipmentSheet({
  onSaved,
  onCancel,
}: {
  onSaved: (set: MyEquipmentSet) => void;
  onCancel: () => void;
}) {
  const [cameraQuery, setCameraQuery] = useState('');
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [cameraSuggestions, setCameraSuggestions] = useState<Camera[]>([]);
  const [housings, setHousings] = useState<Housing[]>([]);
  const [loadingHousings, setLoadingHousings] = useState(false);
  const [selectedHousing, setSelectedHousing] = useState<Housing | null>(null);
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [loadingLenses, setLoadingLenses] = useState(false);
  const [selectedLens, setSelectedLens] = useState<Lens | null>(null);
  const [saving, setSaving] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onCameraChange = (text: string) => {
    setCameraQuery(text);
    setSelectedCamera(null);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setCameraSuggestions(await searchCameras(text));
    }, 300);
  };

  const selectCamera = (cam: Camera) => {
    Keyboard.dismiss();
    setSelectedCamera(cam);
    setCameraQuery(cam.display_name ?? `${cam.brand ?? ''} ${cam.model}`.trim());
    setCameraSuggestions([]);
    setSelectedHousing(null);
    setHousings([]);
    setLenses([]);
    setSelectedLens(null);
    setLoadingHousings(true);
    fetchHousingsForCamera(cam.id).then((h) => {
      setHousings(h);
      setLoadingHousings(false);
    });
  };

  const clearCamera = () => {
    setSelectedCamera(null);
    setCameraQuery('');
    setCameraSuggestions([]);
    setHousings([]);
    setLoadingHousings(false);
    setSelectedHousing(null);
    setLenses([]);
    setSelectedLens(null);
  };

  const selectHousing = (h: Housing | null) => {
    setSelectedHousing(h);
    setSelectedLens(null);
    setLenses([]);
    setLoadingLenses(false);
    if (selectedCamera && h) {
      setLoadingLenses(true);
      fetchLensesForCameraHousing(selectedCamera.id, h.id).then((l) => {
        setLenses(l);
        setLoadingLenses(false);
      });
    }
  };

  const save = async () => {
    if (!selectedCamera) return;
    setSaving(true);
    try {
      const next = await addMyEquipmentSet({
        camera: selectedCamera,
        housing: selectedHousing,
        lens: selectedLens,
      });
      onSaved(next[next.length - 1]);
    } finally {
      setSaving(false);
    }
  };

  // 候補リストは body ScrollView の中にインライン配置する。
  // こうすることで TextInput の親 ScrollView が "always" になり、
  // 候補タップが確実に onPress まで届く。
  return (
    <View style={addStyles.root}>
      <View style={addStyles.header}>
        <Pressable onPress={onCancel} hitSlop={12}>
          <Text style={addStyles.cancel}>キャンセル</Text>
        </Pressable>
        <Text style={addStyles.title}>機材を追加</Text>
        <Pressable onPress={save} disabled={!selectedCamera || saving} hitSlop={12}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[addStyles.done, !selectedCamera && addStyles.doneDisabled]}>保存</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={addStyles.body} keyboardShouldPersistTaps="always">
        {/* カメラ */}
        <View style={addStyles.field}>
          <Text style={addStyles.label}>カメラ <Text style={addStyles.required}>必須</Text></Text>
          {selectedCamera ? (
            <View style={addStyles.selectedRow}>
              <Text style={addStyles.selectedText} numberOfLines={1}>
                {selectedCamera.brand ? `${selectedCamera.brand} ` : ''}
                {selectedCamera.display_name ?? selectedCamera.model}
              </Text>
              <Pressable onPress={clearCamera} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <TextInput
              style={addStyles.input}
              value={cameraQuery}
              onChangeText={onCameraChange}
              placeholder="例: TG-6, OM-5, α7C"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              returnKeyType="search"
              autoFocus
            />
          )}
          {/* 候補リスト：TextInput と同じ ScrollView 内に置くことで確実にタップが届く */}
          {!selectedCamera && cameraSuggestions.length > 0 ? (
            <View style={addStyles.suggestions}>
              {cameraSuggestions.map((cam) => (
                <Pressable key={cam.id} style={addStyles.suggRow} onPress={() => selectCamera(cam)}>
                  <Text style={addStyles.suggName}>
                    {cam.display_name ?? `${cam.brand ?? ''} ${cam.model}`.trim()}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* ハウジング */}
        {selectedCamera ? (
          loadingHousings ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
          ) : housings.length === 0 ? (
            <View style={addStyles.field}>
              <Text style={addStyles.label}>ハウジング</Text>
              <Text style={addStyles.noData}>このカメラのハウジング情報は未登録です</Text>
            </View>
          ) : (
            <View style={addStyles.field}>
              <Text style={addStyles.label}>ハウジング <Text style={addStyles.optional}>任意</Text></Text>
              {selectedHousing ? (
                <View style={addStyles.selectedRow}>
                  <Text style={addStyles.selectedText} numberOfLines={1}>
                    {selectedHousing.brand ? `${selectedHousing.brand} ` : ''}{selectedHousing.model}
                  </Text>
                  <Pressable onPress={() => selectHousing(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              ) : (
                <View style={addStyles.suggestions}>
                  {housings.map((h) => (
                    <Pressable key={h.id} style={addStyles.suggRow} onPress={() => selectHousing(h)}>
                      <Text style={addStyles.suggName}>
                        {h.brand ? `${h.brand} ` : ''}{h.model}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )
        ) : null}

        {/* レンズ */}
        {selectedCamera && selectedHousing ? (
          loadingLenses ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
          ) : lenses.length > 0 ? (
            <View style={addStyles.field}>
              <Text style={addStyles.label}>レンズ <Text style={addStyles.optional}>任意</Text></Text>
              {selectedLens ? (
                <View style={addStyles.selectedRow}>
                  <Text style={addStyles.selectedText} numberOfLines={1}>
                    {selectedLens.brand ? `${selectedLens.brand} ` : ''}{selectedLens.model}
                  </Text>
                  <Pressable onPress={() => setSelectedLens(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              ) : (
                <View style={addStyles.suggestions}>
                  {lenses.map((l) => (
                    <Pressable key={l.id} style={addStyles.suggRow} onPress={() => setSelectedLens(l)}>
                      <Text style={addStyles.suggName}>
                        {l.brand ? `${l.brand} ` : ''}{l.model}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ) : null
        ) : null}
      </ScrollView>
    </View>
  );
}

// 押すと編集画面へ進む行（左に項目名、右に今の値）
function NavRow({ label, value, href }: { label: string; value: string; href: '/profile-edit' | '/email-change' | '/password-change' }) {
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={`${label}を変更`}
      style={({ pressed }) => [styles.row, pressed && styles.serviceRowPressed]}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.navValue}>
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 24 },
  head: { gap: 4, paddingTop: 8 },
  name: { fontSize: 22, fontWeight: '700', color: colors.text },
  userId: { fontSize: 14, color: colors.textSub },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 14 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  label: { fontSize: 14, color: colors.textSub },
  value: { fontSize: 14, color: colors.text, flexShrink: 1 },
  navValue: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  withdraw: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  withdrawText: { fontSize: 14, color: colors.danger },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  addBtnText: { fontSize: 14, color: colors.primary },
  empty: { fontSize: 14, color: colors.textMuted, paddingVertical: 14 },
  equipRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, gap: 12,
  },
  equipInfo: { flex: 1, gap: 2 },
  equipCamera: { fontSize: 14, fontWeight: '600', color: colors.text },
  equipSub: { fontSize: 12, color: colors.textSub },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  serviceRowPressed: { opacity: 0.6 },
  linkLabel: { fontSize: 14, color: colors.text },
  // Web版と同じサービスのアイコン（scubalab/public/*-icon.svg を PNG にしたもの）
  serviceIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  serviceInfo: { flex: 1, gap: 2 },
  serviceName: { fontSize: 14, fontWeight: '600', color: colors.text },
  serviceTagline: { fontSize: 12, color: colors.textSub, lineHeight: 17 },
});

const addStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  cancel: { fontSize: 15, color: colors.textSub },
  done: { fontSize: 15, fontWeight: '600', color: colors.primary },
  doneDisabled: { color: colors.textMuted },
  suggestions: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggRow: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  suggName: { fontSize: 14, fontWeight: '600', color: colors.text },
  body: { padding: 16, gap: 20, paddingBottom: 48 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  required: { fontSize: 11, color: colors.primary, fontWeight: '400' },
  optional: { fontSize: 11, color: colors.textMuted, fontWeight: '400' },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    color: colors.text, backgroundColor: colors.card,
  },
  selectedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.primary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.primaryBg,
  },
  selectedText: { fontSize: 15, color: colors.primary, fontWeight: '500', flex: 1 },
  noData: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
});
