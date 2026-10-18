import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EventInvitationCard } from '@/components/EventInvitationCard';
import { InvitationRow } from '@/components/InvitationRow';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import type { MyInvitedEvent, MyInvitation } from '@/types';

// イベント招待・コミュニティ招待をまとめて管理するベルアイコン
export function EventInvitationBell({ events }: { events: MyInvitedEvent[] }) {
  const { respondEventInvitation, invitations, respondInvitation } = useCommunity();
  const [open, setOpen] = useState(false);
  const [busyEventId, setBusyEventId] = useState<number | null>(null);
  const [busyInvId, setBusyInvId] = useState<number | null>(null);

  const invitedEvents = events.filter((ev) => ev.member_status === 'invited');
  const totalCount = invitedEvents.length + invitations.length;

  const respondEvent = async (ev: MyInvitedEvent, accept: boolean) => {
    setBusyEventId(ev.id);
    await respondEventInvitation(ev, accept);
    setBusyEventId(null);
  };

  const respondCommunity = async (inv: MyInvitation, accept: boolean) => {
    setBusyInvId(inv.id);
    await respondInvitation(inv, accept);
    setBusyInvId(null);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={totalCount > 0 ? `招待が${totalCount}件あります` : '通知'}
        style={({ pressed }) => [styles.bell, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="notifications-outline" size={22} color={colors.text} />
        {totalCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalCount}</Text>
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
            <Text style={styles.sheetTitle}>招待</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textSub} />
            </Pressable>
          </View>
          {totalCount === 0 ? (
            <Text style={styles.empty}>招待はありません</Text>
          ) : (
            <ScrollView contentContainerStyle={styles.list} bounces={false}>
              {invitations.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>コミュニティの招待</Text>
                  {invitations.map((inv) => (
                    <InvitationRow
                      key={inv.id}
                      text={`${inv.invited_by_name ?? '管理者'}さんから「${inv.community_name}」への招待`}
                      busy={busyInvId === inv.id}
                      onAccept={() => respondCommunity(inv, true)}
                      onDecline={() => respondCommunity(inv, false)}
                    />
                  ))}
                </>
              ) : null}
              {invitedEvents.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>イベントの招待</Text>
                  {invitedEvents.map((ev) => (
                    <EventInvitationCard
                      key={ev.id}
                      event={ev}
                      busy={busyEventId === ev.id}
                      onAccept={() => respondEvent(ev, true)}
                      onDecline={() => respondEvent(ev, false)}
                    />
                  ))}
                </>
              ) : null}
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSub,
    marginTop: 4,
    marginBottom: 4,
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
