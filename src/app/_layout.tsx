import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SessionProvider, useSession } from '@/context/SessionContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SessionProvider>
      <SplashScreenController />
      <RootNavigator />
      <StatusBar style="dark" />
    </SessionProvider>
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
