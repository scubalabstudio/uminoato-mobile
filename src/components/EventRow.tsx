import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { CommunityEvent } from '@/types';
import { formatDateRange } from '@/utils/date';

export type EventTag = 'invited' | 'joined' | 'organizer';

const TAG_LABEL: Record<EventTag, string> = { invited: '招待中', joined: '参加中', organizer: '主催' };

// イベント1件の行。タップでイベント詳細を開く。
// my-events（自分のイベント）とコミュニティのイベント一覧のどちらの形でも使えるよう、必要な項目だけを受け取る
export function EventRow({
  event,
  communityId,
  sub,
  tags = [],
}: {
  event: Pick<CommunityEvent, 'id' | 'name' | 'start_date' | 'end_date' | 'status'>;
  communityId: number;
  // 日付の後ろに続ける補足（コミュニティ名、写真の枚数など）
  sub?: string;
  tags?: EventTag[];
}) {
  const date = formatDateRange(event.start_date, event.end_date);

  const open = () => {
    router.push({
      pathname: '/[communityId]/events/[eventId]',
      params: { communityId: String(communityId), eventId: String(event.id), name: event.name },
    });
  };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.icon}>
        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
      </View>
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text style={styles.name} numberOfLines={1}>
            {event.name}
          </Text>
          {tags.map((t) => (
            <Text key={t} style={[styles.chip, chipStyles[t]]}>
              {TAG_LABEL[t]}
            </Text>
          ))}
          {event.status === 'closed' ? <Text style={[styles.chip, styles.chipClosed]}>終了</Text> : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {[date || '日付未定', sub].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 12 },
  rowPressed: { backgroundColor: colors.primaryBg },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text, flexShrink: 1 },
  meta: { fontSize: 12, color: colors.textSub },
  chip: { fontSize: 11, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  chipClosed: { color: colors.textSub, backgroundColor: colors.border },
});

const chipStyles = StyleSheet.create({
  invited: { color: '#b45309', backgroundColor: '#fffbeb' },
  joined: { color: colors.primary, backgroundColor: colors.primaryLight },
  organizer: { color: colors.white, backgroundColor: colors.primary },
});
