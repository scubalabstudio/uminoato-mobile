import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Field, FormError, errorMessage } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';

// メールアドレスの変更。確認メールのリンクを開くと変わる（Web版と同じ）
export default function EmailChangeScreen() {
  const { user, updateProfile, handleApiError } = useSession();
  const currentEmail = user?.email ?? null;
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
        router.back();
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
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 12 },
  current: { fontSize: 14, color: colors.textSub },
  notice: { padding: 12, borderRadius: 10, backgroundColor: colors.primaryBg },
  noticeText: { fontSize: 13, color: colors.primary, lineHeight: 19 },
});
