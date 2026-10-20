import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Field, FormError, errorMessage } from '@/components/ui';
import { WEB_URL } from '@/config/api';
import { RANK_OPTIONS } from '@/constants/ranks';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';

// プロフィールの編集。表示名・ランクはその場で保存。メールアドレスは確認メールを介して変える（Web版と同じ）
export default function ProfileEditScreen() {
  const { user } = useSession();
  if (!user) return null;
  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
      <ProfileSection initialName={user.name} initialRank={user.rank} />
      <EmailSection currentEmail={user.email} />
      <PasswordSection />
    </ScrollView>
  );
}

function ProfileSection({ initialName, initialRank }: { initialName: string; initialRank: string | null }) {
  const { updateProfile, handleApiError } = useSession();
  const [name, setName] = useState(initialName);
  const [rank, setRank] = useState<string | null>(initialRank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = name.trim() !== initialName || rank !== initialRank;

  const save = async () => {
    if (!name.trim()) {
      setError('ニックネームを入力してください');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ name: name.trim(), rank });
      router.back();
    } catch (e) {
      if (!handleApiError(e)) setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>プロフィール</Text>
      <Field label="ニックネーム" value={name} onChangeText={setName} maxLength={100} autoComplete="nickname" />
      <View style={styles.rankBlock}>
        <Text style={styles.label}>ダイバーランク（任意）</Text>
        <View style={styles.rankList}>
          {RANK_OPTIONS.map((option) => {
            const selected = rank === option;
            return (
              <Pressable
                key={option}
                onPress={() => setRank(selected ? null : option)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.rankChip, selected && styles.rankChipSelected]}
              >
                <Text style={[styles.rankText, selected && styles.rankTextSelected]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <FormError message={error} />
      <Button title="保存する" onPress={save} loading={saving} disabled={!changed} />
    </View>
  );
}

function EmailSection({ currentEmail }: { currentEmail: string | null }) {
  const { user, updateProfile, handleApiError } = useSession();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async () => {
    const next = email.trim();
    if (!next) {
      setError('新しいメールアドレスを入力してください');
      return;
    }
    if (next === currentEmail) {
      setError('今のメールアドレスと同じです');
      return;
    }
    setSending(true);
    setError(null);
    try {
      if (currentEmail === null && user) {
        // まだ登録していない人は、確認メールなしでそのまま設定できる（サーバーの仕様）
        await updateProfile({ name: user.name, rank: user.rank, email: next });
        setEmail('');
        Alert.alert('メールアドレスを登録しました');
      } else {
        await api.requestEmailChange(next);
        setSentTo(next);
        setEmail('');
      }
    } catch (e) {
      if (!handleApiError(e)) setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>メールアドレス</Text>
      <Text style={styles.current}>現在：{currentEmail ?? '未登録'}</Text>
      {sentTo ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {sentTo} に確認メールを送りました。メールのリンクを1時間以内に開くと、メールアドレスが変わります。
          </Text>
        </View>
      ) : null}
      <Field
        label={currentEmail ? '新しいメールアドレス' : 'メールアドレス'}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        maxLength={254}
      />
      <FormError message={error} />
      <Button
        title={currentEmail ? '確認メールを送る' : '登録する'}
        variant="secondary"
        onPress={submit}
        loading={sending}
        disabled={!email.trim()}
      />
    </View>
  );
}

// 今のパスワードで本人確認して変える。この端末のログインはそのまま、ほかの端末はログアウトされる。
// 忘れた場合は Web版の再設定（メールで届くリンク。全端末がログアウトされる）を使う
function PasswordSection() {
  const { handleApiError } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!current || !next || !confirm) {
      setError('すべての項目を入力してください');
      return;
    }
    if (next.length < 8 || next.length > 72) {
      setError('新しいパスワードは8〜72文字で入力してください');
      return;
    }
    if (next !== confirm) {
      setError('新しいパスワード（確認）が一致しません');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.changePassword({ current_password: current, password: next, password_confirmation: confirm });
      setCurrent('');
      setNext('');
      setConfirm('');
      Alert.alert('パスワードを変更しました', 'この端末はそのまま使えます。ほかの端末ではログインし直してください。');
    } catch (e) {
      if (!handleApiError(e)) setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>パスワード</Text>
      <Field
        label="今のパスワード"
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        autoCapitalize="none"
        maxLength={72}
      />
      <Field
        label="新しいパスワード"
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        autoCapitalize="none"
        maxLength={72}
        hint="8〜72文字"
      />
      <Field
        label="新しいパスワード（確認）"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        autoCapitalize="none"
        maxLength={72}
      />
      <FormError message={error} />
      <Button title="パスワードを変更する" variant="secondary" onPress={submit} loading={saving} />
      <Text style={styles.body}>変更すると、ほかの端末ではログインし直しになります。</Text>
      <Text style={styles.link} onPress={() => Linking.openURL(`${WEB_URL}/forgot-password`)}>
        今のパスワードを忘れた場合はこちら
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 32 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  current: { fontSize: 14, color: colors.textSub },
  body: { fontSize: 13, color: colors.textSub, lineHeight: 19 },
  link: { fontSize: 14, color: colors.primary, textAlign: 'center', paddingVertical: 4 },
  notice: { padding: 12, borderRadius: 10, backgroundColor: colors.primaryBg },
  noticeText: { fontSize: 13, color: colors.primary, lineHeight: 19 },
  rankBlock: { gap: 8 },
  rankList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rankChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  rankChipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  rankText: { fontSize: 13, color: colors.textSub },
  rankTextSelected: { color: colors.primary, fontWeight: '600' },
});
