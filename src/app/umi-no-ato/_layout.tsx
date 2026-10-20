import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { Pressable } from 'react-native';

import { colors } from '@/constants/theme';

// Web版と同じ URL（https://www.scubalab.net/umi-no-ato/...）をリンクから開いたときの画面。ログインしていなくても見られる
export default function WebLinkLayout() {
  return (
    <Stack
      screenOptions={({ navigation, route }) => ({
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: 'minimal',
        // リンクから直接開いた最初の画面には戻るボタンが出ないので、アプリの画面へ出るボタンを置く
        headerLeft: navigation.getState().routes[0]?.key === route.key ? () => <LeaveButton /> : undefined,
      })}
    >
      {/* イベントはログイン後の画面へ移るだけなので、ヘッダーを出さない */}
      <Stack.Screen name="[communityId]/events/[eventId]" options={{ headerShown: false }} />
      <Stack.Screen name="invite/[token]" options={{ title: 'コミュニティへの招待' }} />
    </Stack>
  );
}

function LeaveButton() {
  const canGoBack = router.canGoBack();
  return (
    <Pressable
      onPress={() => (canGoBack ? router.back() : router.replace('/' as never))}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={canGoBack ? '戻る' : 'ホームへ'}
    >
      <Ionicons name={canGoBack ? 'chevron-back' : 'home-outline'} size={canGoBack ? 26 : 22} color={colors.primary} />
    </Pressable>
  );
}
