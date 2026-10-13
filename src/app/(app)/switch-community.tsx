import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { CommunityInvitationList } from '@/components/CommunityInvitationList';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';

// コミュニティ切り替えシート（Instagram のアカウント切り替えに相当）
export default function SwitchCommunityScreen() {
  const { communities, invitedEvents, current, select } = useCommunity();

  const choose = (communityId: number) => {
    select(communityId);
    router.back();
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.title}>コミュニティを切り替え</Text>

      <View style={styles.list}>
        {communities.map((c) => {
          const selected = c.id === current?.id;
          // 他のコミュニティで届いているイベント招待の件数
          const pending = invitedEvents.filter((ev) => ev.community_id === c.id).length;
          return (
            <Pressable
              key={c.id}
              onPress={() => choose(c.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Avatar name={c.name} uri={c.icon_url} size={44} />
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={styles.rowMeta}>
                  {c.role} · {c.member_count}人
                </Text>
              </View>
              {pending > 0 ? (
                <View style={styles.count}>
                  <Text style={styles.countText}>{pending}</Text>
                </View>
              ) : null}
              {selected ? (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              ) : (
                <View style={styles.unchecked} />
              )}
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => router.push('/create-community')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <View style={styles.addIcon}>
            <Ionicons name="add" size={24} color={colors.text} />
          </View>
          <Text style={styles.rowName}>コミュニティを作成</Text>
        </Pressable>
      </View>

      {/* 参加すると、そのコミュニティに切り替わった状態でシートを閉じる */}
      <CommunityInvitationList onAccepted={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 48, gap: 16 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  list: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 12 },
  rowPressed: { backgroundColor: colors.bg },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowMeta: { fontSize: 12, color: colors.textSub },
  count: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  unchecked: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border, margin: 1 },
  addIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
