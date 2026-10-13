import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppLogo } from '@/components/AppLogo';
import { Avatar } from '@/components/Avatar';
import { NoCommunity } from '@/components/NoCommunity';
import { SettingsButton } from '@/components/SettingsButton';
import { ROLE_OWNER } from '@/constants/roles';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';

// 選択中のコミュニティの中を移動する下部タブ。右端のコミュニティアイコンを長押しすると切り替えシートを開く（Instagram と同じ）
export default function TabsLayout() {
  const { current, invitations, invitedEvents, isLoading } = useCommunity();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!current) return <NoCommunity />;

  const eventInvitations = invitedEvents.filter((ev) => ev.community_id === current.id).length;

  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: 'left',
        // 上部はロゴ。どのタブにいるかは下のタブバーで分かる（コミュニティタブだけはコミュニティ名に差し替える）
        headerTitle: () => <AppLogo />,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerRight: () => <SettingsButton />,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSub,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '図鑑',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'book' : 'book-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'イベント',
          tabBarBadge: eventInvitations > 0 ? eventInvitations : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="unidentified"
        options={{
          title: '未同定',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'help-circle' : 'help-circle-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="invite"
        options={{
          title: '招待',
          // メンバーの招待はコミュニティ管理者だけ（Web版と同じ）
          href: current.role === ROLE_OWNER ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person-add' : 'person-add-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'コミュニティ',
          tabBarBadge: invitations.length > 0 ? '' : undefined,
          tabBarBadgeStyle: styles.dot,
          tabBarIcon: ({ focused }) => (
            <View style={[styles.ring, focused && styles.ringActive]}>
              <Avatar name={current.name} uri={current.icon_url} size={24} />
            </View>
          ),
        }}
        listeners={{
          tabLongPress: () => router.push('/switch-community'),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  ring: { padding: 1.5, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent' },
  ringActive: { borderColor: colors.text },
  dot: { minWidth: 10, maxHeight: 10, borderRadius: 5, backgroundColor: colors.danger, fontSize: 1 },
});
