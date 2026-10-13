import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field, FormError, errorMessage } from '@/components/ui';
import { WEB_URL } from '@/config/api';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';

export default function LoginScreen() {
  const { signIn } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ログインに成功すると user が入り、ルートの Stack.Protected がダッシュボードへ切り替える
  const submit = async () => {
    if (!identifier.trim() || !password) {
      setError('ユーザーID（またはメールアドレス）とパスワードを入力してください');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(identifier.trim(), password);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.title}>うみのあと</Text>
            <Text style={styles.subtitle}>ダイビングの記録を、仲間と共有しよう。</Text>
          </View>

          <View style={styles.form}>
            <Field
              label="ユーザーID / メールアドレス"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
            />
            <Field
              label="パスワード"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <FormError message={error} />
            <Button title="ログイン" onPress={submit} loading={loading} />
            <Text style={styles.link} onPress={() => Linking.openURL(`${WEB_URL}/forgot-password`)}>
              パスワードを忘れた方はこちら
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>アカウントをお持ちでない方</Text>
            <Button title="新規登録" variant="secondary" onPress={() => router.push('/register')} />
            <Text style={styles.note}>ScubaLab のアカウントで、海の本棚・システムチャートにもログインできます。</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 32 },
  hero: { alignItems: 'center', gap: 8 },
  title: { fontSize: 32, fontWeight: '700', color: colors.primary },
  subtitle: { fontSize: 14, color: colors.textSub },
  form: { gap: 16 },
  link: { color: colors.primary, textAlign: 'center', fontSize: 14, paddingVertical: 4 },
  footer: { gap: 12 },
  footerText: { textAlign: 'center', color: colors.textSub, fontSize: 13 },
  note: { textAlign: 'center', color: colors.textMuted, fontSize: 12 },
});
