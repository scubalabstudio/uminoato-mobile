import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { CommunityEvent } from '@/types';
import { formatDateRange } from '@/utils/date';

export type EventTag = 'invited' | 'joined' | 'organizer';

const TAG_LABEL: Record<EventTag, string> = { invited: '招待中', joined: '参加中', organizer: '主催' };
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// イベント1件のカード。タップでイベント詳細を開く。
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
  const range = formatDateRange(event.start_date, event.end_date);
  const closed = event.status === 'closed';

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
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <DateBlock date={event.start_date} closed={closed} />
      <View style={styles.body}>
        <Text style={[styles.name, closed && styles.nameClosed]} numberOfLines={2}>
          {event.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[range || '日付未定', sub].filter(Boolean).join(' · ')}
        </Text>
        {tags.length > 0 || closed ? (
          <View style={styles.chips}>
            {tags.map((t) => (
              <Text key={t} style={[styles.chip, chipStyles[t]]}>
                {TAG_LABEL[t]}
              </Text>
            ))}
            {closed ? <Text style={[styles.chip, styles.chipClosed]}>終了</Text> : null}
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

// 開始日の「月・日・曜日」を大きく出すブロック。日付未定ならカレンダーのアイコン
function DateBlock({ date, closed }: { date: string | null; closed: boolean }) {
  const parts = date?.slice(0, 10).split('-').map(Number);
  const valid = parts && parts.length === 3 && parts.every((n) => !Number.isNaN(n));
  return (
    <View style={[styles.dateBlock, closed && styles.dateBlockClosed]}>
      {valid ? (
        <>
          <Text style={[styles.dateMonth, closed && styles.dateTextClosed]}>{parts[1]}月</Text>
          <Text style={[styles.dateDay, closed && styles.dateTextClosed]}>{parts[2]}</Text>
          <Text style={[styles.dateWeek, closed && styles.dateTextClosed]}>
            {WEEKDAYS[new Date(parts[0], parts[1] - 1, parts[2]).getDay()]}
          </Text>
        </>
      ) : (
        <Ionicons name="calendar-outline" size={24} color={closed ? colors.textMuted : colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardPressed: { backgroundColor: colors.primaryBg },
  dateBlock: {
    width: 56,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBlockClosed: { backgroundColor: colors.bg },
  dateMonth: { fontSize: 11, fontWeight: '600', color: colors.primary },
  dateDay: { fontSize: 24, fontWeight: '700', color: colors.primary, lineHeight: 28 },
  dateWeek: { fontSize: 11, color: colors.primary },
  dateTextClosed: { color: colors.textSub },
  body: { flex: 1, gap: 4 },
  name: { fontSize: 17, fontWeight: '700', color: colors.text, lineHeight: 23 },
  nameClosed: { color: colors.textSub },
  meta: { fontSize: 13, color: colors.textSub },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  chip: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  chipClosed: { color: colors.textSub, backgroundColor: colors.border },
});

const chipStyles = StyleSheet.create({
  invited: { color: '#b45309', backgroundColor: '#fffbeb' },
  joined: { color: colors.primary, backgroundColor: colors.primaryLight },
  organizer: { color: colors.white, backgroundColor: colors.primary },
});
