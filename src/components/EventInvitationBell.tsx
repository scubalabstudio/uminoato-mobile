import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EventInvitationCard } from '@/components/EventInvitationCard';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import type { MyInvitedEvent } from '@/types';

// 届いているイベント招待のベル。押すと一覧のシートを開き、その場で参加・辞退できる。
// どの招待を出すかは呼び出し側が決める（コミュニティのイベントタブ＝そのコミュニティの招待、ゲスト＝ゲスト参加の招待）
export function EventInvitationBell({ events }: { events: MyInvitedEvent[] }) {
  const { respondEventInvitation } = useCommunity();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const invited = events.filter((ev) => ev.member_status === 'invited');

  const respond = async (ev: MyInvitedEvent, accept: boolean) => {
    setBusyId(ev.id);
    await respondEventInvitation(ev, accept);
    setBusyId(null);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`イベントの招待が${invited.length}件あります`}
        style={({ pressed }) => [styles.bell, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="notifications-outline" size={22} color={colors.text} />
        {invited.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{invited.length}</Text>
          </View>
        )}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>イベントの招待</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textSub} />
            </Pressable>
          </View>
          {invited.length === 0 ? (
            <Text style={styles.empty}>招待はありません</Text>
          ) : (
            <ScrollView contentContainerStyle={styles.list} bounces={false}>
              {invited.map((ev) => (
                <EventInvitationCard
                  key={ev.id}
                  event={ev}
                  busy={busyId === ev.id}
                  onAccept={() => respond(ev, true)}
                  onDecline={() => respond(ev, false)}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bell: {
    marginRight: 16,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '75%',
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  empty: {
    paddingVertical: 32,
    textAlign: 'center',
    fontSize: 14,
    color: colors.textSub,
  },
});
