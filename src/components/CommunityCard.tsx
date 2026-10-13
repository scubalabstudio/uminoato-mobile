import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { Community } from '@/types';

type Props = {
  community: Pick<Community, 'id' | 'name' | 'description' | 'role' | 'member_count'> & {
    icon_url?: string | null;
  };
};

export function CommunityCard({ community }: Props) {
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/[communityId]', params: { communityId: String(community.id), name: community.name } })
      }
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && { borderColor: colors.primary }]}
    >
      <View style={styles.row}>
        <View style={styles.icon}>
          {community.icon_url ? (
            <Image source={{ uri: community.icon_url }} style={styles.iconImage} accessibilityIgnoresInvertColors />
          ) : (
            <Text style={styles.iconFallback}>{community.name.charAt(0)}</Text>
          )}
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.name} numberOfLines={1}>
            {community.name}
          </Text>
          <Text style={styles.role}>{community.role}</Text>
        </View>
      </View>
      {community.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {community.description}
        </Text>
      ) : null}
      <Text style={styles.members}>{community.member_count}人が参加</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImage: { width: '100%', height: '100%' },
  iconFallback: { fontSize: 16, fontWeight: '600', color: colors.primary },
  titleBlock: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  role: { fontSize: 12, color: colors.primary },
  description: { fontSize: 14, color: colors.textSub, lineHeight: 20 },
  members: { fontSize: 12, color: colors.textMuted },
});
