import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';

export default function SettingsScreen() {
  const { user, signOut } = useSession();
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
        <InfoRow label="メールアドレス" value={user.email ?? '未登録'} />
        <View style={styles.divider} />
        <InfoRow label="ランク" value={user.rank ?? '未設定'} />
      </View>

      <Button title="ログアウト" variant="secondary" onPress={confirmSignOut} />

      <Pressable onPress={() => router.push('/withdraw')} accessibilityRole="button" style={styles.withdraw}>
        <Text style={styles.withdrawText}>退会する</Text>
      </Pressable>
    </ScrollView>
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
  withdraw: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  withdrawText: { fontSize: 14, color: colors.danger },
});
