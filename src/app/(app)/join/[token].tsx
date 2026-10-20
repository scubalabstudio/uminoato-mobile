import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, FormError, errorMessage } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';

// 招待リンクからのコミュニティ参加の確認（Web版の /umi-no-ato/invite/{token} と同じ）
export default function JoinByInviteLinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { handleApiError } = useSession();
  const { reload, select } = useCommunity();
  const [resolved, setResolved] = useState<api.ResolvedInviteLink | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    api
      .resolveInviteLink(token)
      .then((res) => active && setResolved(res))
      .catch((e) => {
        if (active && !handleApiError(e)) setLoadError(errorMessage(e, 'この招待リンクは無効です'));
      });
    return () => {
      active = false;
    };
  }, [token, handleApiError]);

  // 参加したコミュニティに切り替えて、ホームへ戻る
  const openCommunity = useCallback(
    async (communityId: number) => {
      await reload();
      select(communityId);
      router.dismissTo('/');
    },
    [reload, select],
  );

  const join = async () => {
    if (!token) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await api.joinByInviteLink(token);
      await openCommunity(res.community_id);
    } catch (e) {
      if (!handleApiError(e)) setJoinError(errorMessage(e, 'コミュニティへの参加に失敗しました'));
      setJoining(false);
    }
  };

  if (loadError) {
    return (
      <View style={styles.container}>
        <Ionicons name="alert-circle-outline" size={44} color={colors.textMuted} />
        <Text style={styles.body}>{loadError}</Text>
        <View style={styles.buttons}>
          <Button title="ホームへ" variant="secondary" onPress={() => router.dismissTo('/')} />
        </View>
      </View>
    );
  }

  if (!resolved) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Ionicons name="people-outline" size={28} color={colors.primary} />
      </View>
      <Text style={styles.label}>招待されたコミュニティ</Text>
      <Text style={styles.name}>{resolved.community_name}</Text>
      <FormError message={joinError} />
      <View style={styles.buttons}>
        {resolved.already_member ? (
          <>
            <Text style={styles.body}>すでに参加しています。</Text>
            <Button title="コミュニティを見る" onPress={() => openCommunity(resolved.community_id)} />
          </>
        ) : (
          <>
            <Button title="このコミュニティに参加する" onPress={join} loading={joining} />
            <Button title="参加しない" variant="secondary" onPress={() => router.dismissTo('/')} disabled={joining} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 48, alignItems: 'center', gap: 12 },
  icon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  label: { fontSize: 13, color: colors.textSub },
  name: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  body: { fontSize: 14, color: colors.textSub, lineHeight: 21, textAlign: 'center' },
  buttons: { alignSelf: 'stretch', gap: 12, marginTop: 12 },
});
