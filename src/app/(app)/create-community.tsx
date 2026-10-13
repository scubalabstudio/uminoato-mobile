import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { Button, Field, FormError, errorMessage } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import { useSession } from '@/context/SessionContext';
import { createCommunity } from '@/services/apiService';

export default function CreateCommunityScreen() {
  const { handleApiError } = useSession();
  const { reload, select } = useCommunity();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      setError('コミュニティ名を入力してください');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const created = await createCommunity({
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      // 作ったコミュニティに入った状態でホームへ戻る（切り替えシートから来た場合はシートも閉じる）
      await reload();
      select(created.id);
      router.dismissAll();
    } catch (e) {
      if (!handleApiError(e)) setError(errorMessage(e));
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>作成したあなたがコミュニティ管理者になります。メンバーは後から招待できます。</Text>
        <Field label="コミュニティ名" value={name} onChangeText={setName} maxLength={50} hint={`${name.length} / 50`} />
        <Field
          label="説明（任意）"
          value={description}
          onChangeText={setDescription}
          maxLength={200}
          multiline
          hint={`${description.length} / 200`}
        />
        <FormError message={error} />
        <Button title="コミュニティを作成" onPress={submit} loading={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 24, gap: 16 },
  lead: { fontSize: 14, color: colors.textSub, lineHeight: 20 },
});
