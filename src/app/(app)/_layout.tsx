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
        <Stack.Screen name="[communityId]/events/new" options={{ title: '新規イベント作成' }} />
        <Stack.Screen name="[communityId]/events/[eventId]" options={{ title: '' }} />
        <Stack.Screen name="[communityId]/events/[eventId]/edit" options={{ title: 'イベントを編集' }} />
        <Stack.Screen name="[communityId]/events/[eventId]/dive" options={{ title: 'ダイブ情報' }} />
        <Stack.Screen name="[communityId]/events/[eventId]/invite" options={{ title: 'メンバーを招待' }} />
        <Stack.Screen name="[communityId]/encyclopedia/[entryId]" options={{ title: '' }} />
        <Stack.Screen name="[communityId]/settings" options={{ title: 'コミュニティ設定' }} />
        <Stack.Screen name="[communityId]/members" options={{ title: 'メンバー管理' }} />
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
