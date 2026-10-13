import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ComingSoon } from '@/components/ComingSoon';
import { InvitationRow } from '@/components/InvitationRow';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import type { MyInvitedEvent } from '@/types';
import { formatDateRange } from '@/utils/date';

export default function EventsTab() {
  const { current, invitedEvents, respondEventInvitation } = useCommunity();
  const [busyId, setBusyId] = useState<number | null>(null);

  const invited = invitedEvents.filter((ev) => ev.community_id === current?.id);

  const respond = async (ev: MyInvitedEvent, accept: boolean) => {
    setBusyId(ev.id);
    await respondEventInvitation(ev, accept);
    setBusyId(null);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      {invited.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>届いているイベントの招待</Text>
          {invited.map((ev) => (
            <InvitationRow
              key={ev.id}
              text={`イベント「${ev.name}」に招待されています`}
              sub={formatDateRange(ev.start_date, ev.end_date)}
              busy={busyId === ev.id}
              onAccept={() => respond(ev, true)}
              onDecline={() => respond(ev, false)}
            />
          ))}
        </View>
      ) : null}
      <ComingSoon icon="calendar-outline" title="イベント" description="ダイビングの記録を見たり、レポートを作ったりできます" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textSub },
});
