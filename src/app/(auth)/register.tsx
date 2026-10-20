import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Field, FormError, errorMessage } from '@/components/ui';
import { WEB_URL } from '@/config/api';
import { RANK_OPTIONS } from '@/constants/ranks';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';
import { sendRegisterCode } from '@/services/apiService';

const RESEND_COOLDOWN_SEC = 30;

// 2段階: 1) 登録情報を入力して確認コードをメールで受け取る 2) コードを入力してアカウントを作成（Web版と同じ流れ）
export default function RegisterScreen() {
  const { completeRegistration } = useSession();
  const [step, setStep] = useState<1 | 2>(1);

  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [rank, setRank] = useState<string | null>(null);
  const [code, setCode] = useState('');
  // 利用規約・プライバシーポリシーへの同意（App Store 審査ガイドライン 1.2）
  const [agreed, setAgreed] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // サーバーと同じ検証を先に行い、通信せずに分かる誤りはその場で知らせる
  const validate = (): string | null => {
    if (!userId || !email || !password || !name) return 'すべての必須項目を入力してください';
    if (!/^[a-zA-Z0-9_]+$/.test(userId)) return 'ユーザーIDは半角英数字と _ のみ使用できます';
    if (password.length < 8 || password.length > 72) return 'パスワードは8〜72文字で入力してください';
    if (!agreed) return '利用規約とプライバシーポリシーに同意してください';
    return null;
  };

  const send = async () => {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await sendRegisterCode({ user_id: userId, email: email.trim(), password, name, rank });
      setStep(2);
      setCode('');
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setError(null);
    setCooldown(RESEND_COOLDOWN_SEC);
    try {
      await sendRegisterCode({ user_id: userId, email: email.trim(), password, name, rank });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  // 成功すると user が入り、ルートの Stack.Protected がダッシュボードへ切り替える
  const verify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('確認コードは6桁の数字で入力してください');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await completeRegistration(email.trim(), code);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <>
            <Field
              label="ユーザーID"
              value={userId}
              onChangeText={setUserId}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={50}
              hint="半角英数字と _ のみ。ログインに使います"
              autoComplete="username-new"
              textContentType="username"
            />
            <Field
              label="メールアドレス"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              maxLength={254}
              autoComplete="email"
              textContentType="emailAddress"
            />
            <Field
              label="パスワード"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              maxLength={72}
              hint="8〜72文字"
              autoComplete="new-password"
              textContentType="newPassword"
            />
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

            <View style={styles.agreeRow}>
              <Pressable
                onPress={() => setAgreed((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed }}
                accessibilityLabel="利用規約とプライバシーポリシーに同意する"
                hitSlop={8}
              >
                <Ionicons
                  name={agreed ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={agreed ? colors.primary : colors.textMuted}
                />
              </Pressable>
              <Text style={styles.agreeText}>
                <Text style={styles.agreeLink} onPress={() => Linking.openURL(`${WEB_URL}/umi-no-ato/terms`)}>
                  利用規約
                </Text>
                と
                <Text style={styles.agreeLink} onPress={() => Linking.openURL(`${WEB_URL}/umi-no-ato/privacy`)}>
                  プライバシーポリシー
                </Text>
                に同意する。不適切な投稿や迷惑行為は禁止されており、違反した投稿は削除されます。
              </Text>
            </View>

            <FormError message={error} />
            <Button title="確認コードを送信する" onPress={send} loading={loading} disabled={!agreed} />
          </>
        ) : (
          <>
            <Text style={styles.lead}>
              {email} に6桁の確認コードを送信しました。メールに記載されたコードを入力してください（10分間有効）。
            </Text>
            <Field
              label="確認コード（6桁）"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              returnKeyType="done"
              onSubmitEditing={verify}
            />
            <FormError message={error} />
            <Button title="アカウントを作成する" onPress={verify} loading={loading} />
            <Button
              title={cooldown > 0 ? `コードを再送信（${cooldown}秒後）` : 'コードを再送信'}
              onPress={resend}
              disabled={cooldown > 0}
              variant="secondary"
            />
            <Text
              style={styles.link}
              onPress={() => {
                setStep(1);
                setError(null);
              }}
            >
              登録情報を修正する
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 24, gap: 16 },
  lead: { fontSize: 14, color: colors.text, lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
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
  link: { color: colors.primary, textAlign: 'center', fontSize: 14, paddingVertical: 4 },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  agreeText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },
  agreeLink: { color: colors.primary, textDecorationLine: 'underline' },
});
