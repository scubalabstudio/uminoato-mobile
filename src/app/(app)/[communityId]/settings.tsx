import Ionicons from '@expo/vector-icons/Ionicons';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { OwnerOnly } from '@/components/OwnerOnly';
import { Button, Field, FormError, errorMessage } from '@/components/ui';
import { WEB_URL } from '@/config/api';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import type { Community } from '@/types';

// コミュニティ設定（管理者のみ）。Web版の設定画面と同じく、アイコン・図鑑の公開・レポートの末尾テキスト・削除
export default function CommunitySettingsScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const { communities } = useCommunity();
  const community = communities.find((c) => c.id === Number(communityId));

  return (
    <OwnerOnly community={community} feature="コミュニティの設定">
      {(c) => <SettingsForm key={c.id} community={c} />}
    </OwnerOnly>
  );
}

function SettingsForm({ community }: { community: Community }) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <IconSection community={community} />
        <PublicSection community={community} />
        <SuffixSection community={community} />
        <DeleteSection community={community} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// 403（他の管理者に降格された等）なら一覧を取り直す。取り直すと管理者でなくなった画面は OwnerOnly の案内に切り替わる
function useSettingsError() {
  const { handleApiError } = useSession();
  const { reload } = useCommunity();
  return (e: unknown, setError: (m: string) => void) => {
    if (handleApiError(e)) return;
    if (e instanceof api.ApiError && e.status === 403) reload();
    setError(errorMessage(e));
  };
}

// ── アイコン ─────────────────────────────────────────────────────────────

function IconSection({ community }: { community: Community }) {
  const { replaceCommunity } = useCommunity();
  const onError = useSettingsError();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('写真へのアクセスが許可されていません。設定アプリから許可してください');
      return;
    }
    // 正方形に切り抜いてもらう（サーバーも正方形にクロップするが、どこを残すかを本人が選べるように）
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      // HEIC のままだと扱えない環境があり、5MB 制限もあるので、JPEG に変換して縮小してから送る（サーバーで 512px になる）
      const image = await ImageManipulator.manipulate(result.assets[0].uri).resize({ width: 1024, height: null }).renderAsync();
      const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
      replaceCommunity(await api.uploadCommunityIcon(community.id, saved.uri));
    } catch (e) {
      onError(e, setError);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Section title="アイコン">
      <View style={styles.iconRow}>
        <Pressable onPress={pick} disabled={uploading} accessibilityRole="button" accessibilityLabel="アイコンを変更">
          <Avatar name={community.name} uri={community.icon_url} size={72} />
          <View style={styles.iconBadge}>
            {uploading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="camera" size={14} color={colors.white} />
            )}
          </View>
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.body}>{community.name}</Text>
          <Text style={styles.sub}>タップして写真を選び、正方形に切り抜いて設定します</Text>
        </View>
      </View>
      <FormError message={error} />
    </Section>
  );
}

// ── 図鑑の公開 ───────────────────────────────────────────────────────────

function PublicSection({ community }: { community: Community }) {
  const { replaceCommunity } = useCommunity();
  const onError = useSettingsError();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publicUrl = `${WEB_URL}/umi-no-ato/public/${community.id}/encyclopedia`;

  // スイッチは切り替えた時点で保存する（失敗したら元の値のまま）
  const toggle = async (value: boolean) => {
    setSaving(true);
    setError(null);
    try {
      replaceCommunity(await api.updateCommunitySettings(community.id, { encyclopedia_public: value }));
    } catch (e) {
      onError(e, setError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="公開設定">
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text style={styles.body}>図鑑を外部に公開する</Text>
          <Text style={styles.sub}>コミュニティ外の人も、ログインせずに図鑑を見られるようになります（編集はできません）</Text>
        </View>
        <Switch
          value={community.encyclopedia_public}
          onValueChange={toggle}
          disabled={saving}
          trackColor={{ true: colors.primary }}
          accessibilityLabel="図鑑を外部に公開する"
        />
      </View>
      {community.encyclopedia_public ? (
        <View style={styles.linkBox}>
          <Text style={styles.sub}>公開リンク（長押しでコピー）</Text>
          <Text style={styles.link} selectable>
            {publicUrl}
          </Text>
        </View>
      ) : null}
      <FormError message={error} />
    </Section>
  );
}

// ── レポートの末尾テキスト ─────────────────────────────────────────────────

const SUFFIX_FIELDS = [
  { key: 'report_suffix_instagram', label: 'Instagram' },
  { key: 'report_suffix_facebook', label: 'Facebook' },
  { key: 'report_suffix_line', label: 'LINE' },
  { key: 'report_suffix_x', label: 'X（Twitter）' },
] as const;
type SuffixKey = (typeof SUFFIX_FIELDS)[number]['key'];
// サーバーの上限。Web版は入力欄に制限が無く、超えると保存時にエラーになる
const SUFFIX_MAX = 1000;

function SuffixSection({ community }: { community: Community }) {
  const { replaceCommunity } = useCommunity();
  const onError = useSettingsError();
  const initial = () =>
    Object.fromEntries(SUFFIX_FIELDS.map((f) => [f.key, community[f.key] ?? ''])) as Record<SuffixKey, string>;
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = SUFFIX_FIELDS.some((f) => values[f.key] !== (community[f.key] ?? ''));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // 空欄は「追加なし」として null で保存する（Web版と同じ）
      const body = Object.fromEntries(SUFFIX_FIELDS.map((f) => [f.key, values[f.key].trim() || null]));
      const updated = await api.updateCommunitySettings(community.id, body);
      replaceCommunity(updated);
      // 前後の空白を除いた保存後の値に揃える（そのままだと「変更あり」のままになる）
      setValues(Object.fromEntries(SUFFIX_FIELDS.map((f) => [f.key, updated[f.key] ?? ''])) as Record<SuffixKey, string>);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      onError(e, setError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="レポートの末尾テキスト">
      <Text style={styles.sub}>
        イベントのレポートを作るとき、各SNS向けの文章の最後に自動で付け加えます（アカウント名・ハッシュタグなど）
      </Text>
      {SUFFIX_FIELDS.map((f) => (
        <Field
          key={f.key}
          label={f.label}
          value={values[f.key]}
          onChangeText={(text) => {
            setSaved(false);
            setValues((v) => ({ ...v, [f.key]: text }));
          }}
          multiline
          maxLength={SUFFIX_MAX}
          placeholder="追加なし"
          hint={values[f.key].length > SUFFIX_MAX * 0.9 ? `${values[f.key].length} / ${SUFFIX_MAX}` : undefined}
        />
      ))}
      <FormError message={error} />
      <Button title={saved ? '保存しました' : '保存する'} onPress={save} loading={saving} disabled={!dirty} />
    </Section>
  );
}

// ── 削除 ─────────────────────────────────────────────────────────────────

function DeleteSection({ community }: { community: Community }) {
  const { reload } = useCommunity();
  const onError = useSettingsError();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Web版と同じく「削除」または「delete」（大文字小文字は区別しない）を入力すると押せる
  const typed = confirmText.trim();
  const confirmed = typed === '削除' || typed.toLowerCase() === 'delete';

  const remove = () => {
    Alert.alert(`「${community.name}」を削除しますか？`, 'メンバー・図鑑・イベント・写真もすべて削除され、元に戻せません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除する',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          setError(null);
          try {
            await api.deleteCommunity(community.id);
            // 先に画面を閉じてから一覧を取り直す。選択中のコミュニティは、残っている別のコミュニティ
            // （無ければゲスト／未所属の画面）に切り替わる
            router.back();
            await reload();
          } catch (e) {
            onError(e, setError);
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <Section title="コミュニティの削除" danger>
      <Text style={styles.sub}>
        メンバー・招待・図鑑・イベント・写真をすべて削除します。この操作は取り消せません。
      </Text>
      <Field
        label="確認のため「削除」と入力してください"
        value={confirmText}
        onChangeText={setConfirmText}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <FormError message={error} />
      <Pressable
        onPress={remove}
        disabled={!confirmed || deleting}
        accessibilityRole="button"
        accessibilityState={{ disabled: !confirmed || deleting }}
        style={({ pressed }) => [styles.danger, (!confirmed || deleting || pressed) && { opacity: 0.5 }]}
      >
        {deleting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.dangerText}>コミュニティを削除する</Text>
        )}
      </Pressable>
    </Section>
  );
}

function Section({ title, danger = false, children }: { title: string; danger?: boolean; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, danger && { color: colors.danger }]}>{title}</Text>
      <View style={[styles.card, danger && { borderColor: '#fecaca' }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, paddingBottom: 48, gap: 24 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textSub },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  body: { fontSize: 15, color: colors.text, fontWeight: '500' },
  sub: { fontSize: 12, color: colors.textSub, lineHeight: 18 },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkBox: { backgroundColor: colors.bg, borderRadius: 8, padding: 10, gap: 4 },
  link: { fontSize: 13, color: colors.primary },
  danger: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: { color: colors.white, fontSize: 15, fontWeight: '600' },
});
