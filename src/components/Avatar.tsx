import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

// 丸いアイコン。画像が無ければ名前の頭文字を出す（コミュニティ・ユーザー共通）
export function Avatar({ name, uri, size = 40 }: { name: string; uri?: string | null; size?: number }) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} accessibilityIgnoresInvertColors />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{name.charAt(0)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    overflow: 'hidden',
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  initial: { fontWeight: '600', color: colors.primary },
});
