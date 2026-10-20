import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text } from 'react-native';

import { Button, Field, FormError, errorMessage } from '@/components/ui';
import { WEB_URL } from '@/config/api';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';

// 今のパスワードで本人確認して変える。この端末のログインはそのまま、ほかの端末はログアウトされる。
// 忘れた場合は Web版の再設定（メールで届くリンク。全端末がログアウトされる）を使う
export default function PasswordChangeScreen() {
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
      router.back();
    } catch (e) {
      if (!handleApiError(e)) setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 12 },
  body: { fontSize: 13, color: colors.textSub, lineHeight: 19 },
  link: { fontSize: 14, color: colors.primary, textAlign: 'center', paddingVertical: 4 },
});
