import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function AppLayout() {
  return (
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
      <Stack.Screen name="index" options={{ title: 'うみのあと' }} />
      <Stack.Screen name="create-community" options={{ title: 'コミュニティを作成', presentation: 'modal' }} />
      <Stack.Screen name="[communityId]/index" options={{ title: '' }} />
    </Stack>
  );
}
