import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors } from '@/constants/theme';

export function InvitationRow({
  text,
  sub,
  busy,
  onAccept,
  onDecline,
}: {
  text: string;
  sub?: string;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <View style={styles.invitation}>
      <Text style={styles.text}>{text}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button title="参加する" onPress={onAccept} loading={busy} />
        </View>
        <View style={styles.flex}>
          <Button title="辞退" variant="secondary" onPress={onDecline} disabled={busy} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  invitation: {
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  text: { fontSize: 14, color: colors.text, lineHeight: 20 },
  sub: { fontSize: 12, color: colors.textSub },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
});
