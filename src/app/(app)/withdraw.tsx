import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Field, FormError, errorMessage } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';

// 退会（アカウントの削除）。Web版のプロフィールと同じく、消えるものの説明 → パスワードで本人確認の2段階
export default function WithdrawScreen() {
  const { deleteAccount } = useSession();
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withdraw = async () => {
    if (!password) {
      setError('パスワードを入力してください');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await deleteAccount(password);
      // ログイン情報が消えるとログイン画面に切り替わる
      Alert.alert('退会が完了しました', 'これまでご利用いただきありがとうございました。');
    } catch (e) {
      // 401（ログイン切れ）も含め、メッセージをそのまま出す。パスワード違い・オーナーで退会できない場合は 422
      setError(e instanceof api.ApiError ? e.message : errorMessage(e));
      setSubmitting(false);
    }
  };

  if (step === 1) {
    return (
      <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.warning}>
          <Ionicons name="warning-outline" size={20} color={colors.danger} />
          <Text style={styles.warningText}>退会すると元に戻せません</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>削除されるデータ</Text>
          {['プロフィール情報', '本棚データ（評価・ブックマーク等）', 'イベント参加記録', '自分が唯一のメンバーのコミュニティ'].map(
            (item) => (
              <Text key={item} style={styles.bullet}>
                ・{item}
              </Text>
            ),
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>残るもの</Text>
          <Text style={styles.body}>
            アップロードした写真・図鑑の記録は、コミュニティの記録として残ります（投稿者は「退会したユーザー」と表示されます）。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>コミュニティのオーナーの方へ</Text>
          <Text style={styles.body}>
            自分が作ったコミュニティにほかのメンバーがいる場合は退会できません。先にオーナーを別のメンバーに移譲してください。
          </Text>
        </View>

        <View style={styles.actions}>
          <Button title="次へ" variant="danger" onPress={() => setStep(2)} />
          <Button title="キャンセル" variant="secondary" onPress={() => router.back()} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.section}>
        <Text style={styles.heading}>パスワードを確認</Text>
        <Text style={styles.body}>本人確認のため、パスワードを入力してください。</Text>
      </View>

      <Field
        label="パスワード"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        autoComplete="current-password"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={withdraw}
        editable={!submitting}
      />
      <FormError message={error} />

      <View style={styles.actions}>
        <Button title="退会する" variant="danger" onPress={withdraw} loading={submitting} disabled={!password} />
        <Button title="キャンセル" variant="secondary" onPress={() => router.back()} disabled={submitting} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 20 },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  warningText: { fontSize: 15, fontWeight: '700', color: colors.danger },
  section: { gap: 6 },
  heading: { fontSize: 15, fontWeight: '700', color: colors.text },
  bullet: { fontSize: 14, color: colors.text, lineHeight: 22 },
  body: { fontSize: 14, color: colors.textSub, lineHeight: 21 },
  actions: { gap: 10, marginTop: 4 },
});
