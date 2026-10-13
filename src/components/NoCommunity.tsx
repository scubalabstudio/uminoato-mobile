import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/AppLogo';
import { CommunityInvitationList } from '@/components/CommunityInvitationList';
import { SettingsButton } from '@/components/SettingsButton';
import { Button } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';

// どのコミュニティにも参加していないとき（タブの代わりに出す）。招待に答えるか、コミュニティを作成してもらう
export function NoCommunity() {
  const insets = useSafeAreaInsets();
  const { loadError, reload } = useCommunity();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <AppLogo />
        <SettingsButton />
      </View>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {loadError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{loadError}</Text>
            <Button title="再読み込み" variant="secondary" onPress={reload} />
          </View>
        ) : (
          <>
            <CommunityInvitationList />
            <View style={styles.empty}>
              <Text style={styles.emptyText}>まだ参加しているコミュニティがありません</Text>
              <Text style={styles.emptySub}>招待を受けるか、新しくコミュニティを作成してください</Text>
              <Button title="コミュニティを作成する" onPress={() => router.push('/create-community')} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, height: 52 },
  container: { padding: 16, paddingBottom: 48, gap: 16 },
  errorBox: { gap: 8 },
  errorText: { color: colors.danger, fontSize: 14 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  emptyText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  emptySub: { color: colors.textSub, fontSize: 13 },
});
