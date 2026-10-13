import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/constants/theme';
import type { MyInvitedEvent } from '@/types';
import { formatDateRange } from '@/utils/date';

export function EventInvitationCard({
  event,
  busy,
  onAccept,
  onDecline,
}: {
  event: MyInvitedEvent;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const dateRange = formatDateRange(event.start_date, event.end_date);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
        <Text style={styles.communityName}>{event.community_name}</Text>
      </View>

      <Text style={styles.eventName}>
        イベント <Text style={styles.bold}>「{event.name}」</Text> に招待されています
      </Text>

      {dateRange ? <Text style={styles.date}>{dateRange}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          onPress={onAccept}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [styles.btn, styles.btnAccept, (pressed || busy) && { opacity: 0.6 }]}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.btnAcceptText}>参加する</Text>
          )}
        </Pressable>
        <Pressable
          onPress={onDecline}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [styles.btn, styles.btnDecline, (pressed || busy) && { opacity: 0.6 }]}
        >
          <Text style={styles.btnDeclineText}>辞退</Text>
        </Pressable>
      </View>
    </View>
  );
}

const amber = {
  bg: '#fffbeb',
  border: '#fde68a',
  text: '#b45309',
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: amber.bg,
    borderWidth: 1,
    borderColor: amber.border,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  communityName: {
    fontSize: 12,
    color: colors.textMuted,
  },
  eventName: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
    color: amber.text,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAccept: {
    backgroundColor: colors.primary,
  },
  btnDecline: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnAcceptText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  btnDeclineText: {
    color: colors.text,
    fontSize: 13,
  },
});
