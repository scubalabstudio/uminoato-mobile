import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';
import { savePendingLink } from '@/utils/pendingLink';

// 招待リンク（https://www.scubalab.net/umi-no-ato/invite/{token}）から開いた画面。
// ログイン済みなら参加の確認画面へ。未ログインならリンクを覚えておき、ログイン・新規登録のあとに参加の確認画面を開く
export default function InviteLinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user } = useSession();
  const joinHref = `/join/${encodeURIComponent(token ?? '')}`;

  useEffect(() => {
    if (!user && token) savePendingLink(joinHref);
  }, [user, token, joinHref]);

  if (user) return <Redirect href={joinHref as never} />;

  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Ionicons name="people-outline" size={28} color={colors.primary} />
      </View>
      <Text style={styles.title}>コミュニティに招待されています</Text>
      <Text style={styles.body}>
        参加するには、ログインしてください。アカウントがない場合は新規登録してください。終わると参加の確認画面が開きます。
      </Text>
      {/* ログイン画面へは置き換えで移る。この画面が履歴に残ると、ログイン後に参加画面が二重に開くため */}
      <View style={styles.buttons}>
        <Button title="ログイン" onPress={() => router.replace('/login')} />
        <Button title="新規登録" variant="secondary" onPress={() => router.replace('/register')} />
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
  title: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  body: { fontSize: 14, color: colors.textSub, lineHeight: 21, textAlign: 'center' },
  buttons: { alignSelf: 'stretch', gap: 12, marginTop: 12 },
});
