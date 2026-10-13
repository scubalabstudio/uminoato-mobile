import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '@/constants/theme';

// 右上の設定ボタン（アカウント情報・ログアウト）
export function SettingsButton() {
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="設定"
      style={styles.button}
    >
      <Ionicons name="settings-outline" size={24} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 16 },
});
