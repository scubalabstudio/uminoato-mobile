import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

// まだ実装していないタブの中身
export function ComingSoon({
  icon,
  title,
  description,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
}) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={40} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <Text style={styles.badge}>準備中</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 4 },
  description: { fontSize: 14, color: colors.textSub, textAlign: 'center', lineHeight: 20 },
  badge: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
});
