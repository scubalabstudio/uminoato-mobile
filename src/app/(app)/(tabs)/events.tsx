import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ComingSoon } from '@/components/ComingSoon';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';

export default function EventsTab() {
  const { reload } = useCommunity();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <ComingSoon icon="calendar-outline" title="イベント" description="ダイビングの記録を見たり、レポートを作ったりできます" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
});
