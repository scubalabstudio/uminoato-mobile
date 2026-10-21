import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { useUpload } from '@/context/UploadContext';

// タブバーの上あたりに浮かべる（タブバーの高さ＋余白）
const ABOVE_TAB_BAR = 64;

// まとめてアップロード中の進み具合。どの画面にいても出す。押すとそのイベントを開く
export function UploadBanner() {
  const { job } = useUpload();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  if (!job) return null;

  const eventPath = `/${job.communityId}/events/${job.eventId}`;
  // イベント画面の中では写真タブに進み具合を出しているので、重ねない
  if (pathname === eventPath) return null;

  const succeeded = job.done - job.failed;
  const label = !job.finished
    ? `写真をアップロード中 ${job.done}/${job.total}`
    : job.failed === 0
      ? `${job.total}枚の写真をアップロードしました`
      : `${succeeded}枚をアップロード・${job.failed}枚は失敗しました`;

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + ABOVE_TAB_BAR }]} pointerEvents="box-none">
      <Pressable
        onPress={() => router.push(eventPath as never)}
        accessibilityRole="button"
        accessibilityLabel={`${label}。「${job.eventName}」を開く`}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      >
        {job.finished ? (
          <Ionicons
            name={job.failed === 0 ? 'checkmark-circle' : 'alert-circle'}
            size={18}
            color={job.failed === 0 ? '#4ADE80' : '#FCA5A5'}
          />
        ) : (
          <ActivityIndicator size="small" color="#fff" />
        )}
        <View style={styles.texts}>
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {job.finished ? job.eventName : `${job.eventName}・アプリを閉じないでください`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 9998 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 480,
    alignSelf: 'stretch',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.text,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  pressed: { opacity: 0.85 },
  texts: { flex: 1, gap: 1 },
  label: { fontSize: 13, fontWeight: '600', color: '#fff', fontVariant: ['tabular-nums'] },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
});
