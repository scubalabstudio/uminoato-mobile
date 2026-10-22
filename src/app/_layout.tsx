import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { OfflineBanner } from '@/components/OfflineBanner';
import { SessionProvider, useSession } from '@/context/SessionContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        <SplashScreenController />
        <RootNavigator />
        <OfflineBanner />
        <StatusBar style="dark" />
      </SessionProvider>
    </GestureHandlerRootView>
  );
}

// 端末に保存したログイン情報を読み終えるまでスプラッシュを出したままにする（ログイン画面のちらつき防止）
function SplashScreenController() {
  const { isLoading } = useSession();
  if (!isLoading) SplashScreen.hide();
  return null;
}

// ログイン状態で表示できる画面を切り替える。条件を満たさない画面を開くと、表示できる最初の画面へ移る
function RootNavigator() {
  const { user } = useSession();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
