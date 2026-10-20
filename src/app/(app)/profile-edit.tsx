import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Field, FormError, errorMessage } from '@/components/ui';
import { RANK_OPTIONS } from '@/constants/ranks';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';

// ニックネーム・ダイバーランクの編集
export default function ProfileEditScreen() {
  const { user } = useSession();
  if (!user) return null;
  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
      <ProfileForm initialName={user.name} initialRank={user.rank} />
    </ScrollView>
  );
}

function ProfileForm({ initialName, initialRank }: { initialName: string; initialRank: string | null }) {
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

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  section: { gap: 12 },
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
});
