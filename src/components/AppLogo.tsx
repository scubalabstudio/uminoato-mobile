import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

// 画面上部のロゴ（Web版のナビゲーションと同じく、アイコン＋「うみのあと」）
export function AppLogo() {
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel="うみのあと">
      <Image source={require('../../assets/images/umi-no-ato-icon.png')} style={styles.icon} resizeMode="contain" />
      <Text style={styles.text}>うみのあと</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // 元画像は 514×362
  icon: { height: 28, width: 40 },
  text: { fontSize: 18, fontWeight: '700', color: colors.primary, letterSpacing: -0.3 },
});
