import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { InvitationRow } from '@/components/InvitationRow';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import type { MyInvitation } from '@/types';

// 自分宛のコミュニティ招待。参加するとそのコミュニティに切り替わる
export function CommunityInvitationList({ onAccepted }: { onAccepted?: () => void }) {
  const { invitations, respondInvitation } = useCommunity();
  const [busyId, setBusyId] = useState<number | null>(null);

  if (invitations.length === 0) return null;

  const respond = async (inv: MyInvitation, accept: boolean) => {
    setBusyId(inv.id);
    const ok = await respondInvitation(inv, accept);
    setBusyId(null);
    if (ok && accept) onAccepted?.();
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>届いている招待</Text>
      {invitations.map((inv) => (
        <InvitationRow
          key={inv.id}
          text={`${inv.invited_by_name ?? '管理者'} さんから「${inv.community_name}」への招待`}
          busy={busyId === inv.id}
          onAccept={() => respond(inv, true)}
          onDecline={() => respond(inv, false)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  title: { fontSize: 13, fontWeight: '600', color: colors.textSub },
});
