import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';
import { CommunityProvider } from '@/context/CommunityContext';

export default function AppLayout() {
  return (
    <CommunityProvider>
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.bg },
          contentStyle: { backgroundColor: colors.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: '設定' }} />
        {/* Instagram のアカウント切り替えと同じく下から出るシート。見出しは中身側に置く（Android のシートはヘッダー非対応） */}
        <Stack.Screen
          name="switch-community"
          options={{
            headerShown: false,
            presentation: 'formSheet',
            sheetAllowedDetents: [0.5, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 16,
            contentStyle: { backgroundColor: colors.card },
          }}
        />
        <Stack.Screen name="create-community" options={{ title: 'コミュニティを作成', presentation: 'modal' }} />
      </Stack>
    </CommunityProvider>
  );
}
