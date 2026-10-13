import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

// コミュニティトップ（図鑑・イベント・未同定への入口）。次の段階で実装する
export default function CommunityTopScreen() {
  const { name } = useLocalSearchParams<{ communityId: string; name?: string }>();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: name ?? '' }} />
      <Text style={styles.text}>コミュニティの画面は準備中です</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { color: colors.textSub, fontSize: 14 },
});
