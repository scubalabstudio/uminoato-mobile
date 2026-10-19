import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors } from '@/constants/theme';

interface Props {
  message?: string | null;
  onRetry: () => void;
  loading?: boolean;
}

export function NetworkErrorView({ message, onRetry, loading = false }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={44} color={colors.textMuted} />
      <View style={styles.texts}>
        <Text style={styles.title}>読み込みに失敗しました</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
      <Button title="再読み込み" variant="secondary" loading={loading} onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 20,
    padding: 32,
  },
  texts: {
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: colors.textSub,
    textAlign: 'center',
    lineHeight: 19,
  },
});
