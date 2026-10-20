import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

export type ActionMenuOption = {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  destructive?: boolean;
  onPress: () => void;
};

// 画面の下から出る選択肢のメニュー。Android の Alert はボタンが3つまでなので、自前で出す
export function ActionMenu({
  visible,
  title,
  options,
  onClose,
}: {
  visible: boolean;
  title?: string;
  options: ActionMenuOption[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="閉じる">
        {/* カードの中のタップで閉じないよう、何もしない Pressable で受け止める */}
        <Pressable style={[styles.card, { paddingBottom: 8 + insets.bottom }]} onPress={() => {}}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {options.map((o) => (
            <Pressable
              key={o.label}
              onPress={() => {
                onClose();
                // iOS は閉じかけのモーダルの上に次のモーダル・アラートを出せないので、閉じ終わるのを待つ
                setTimeout(o.onPress, 350);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
            >
              <Ionicons name={o.icon} size={20} color={o.destructive ? colors.danger : colors.text} />
              <Text style={[styles.optionText, o.destructive && styles.optionTextDanger]}>{o.label}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.option, styles.cancel, pressed && styles.optionPressed]}
          >
            <Text style={styles.cancelText}>キャンセル</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  card: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 13,
    color: colors.textSub,
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  optionPressed: { backgroundColor: colors.bg },
  optionText: { fontSize: 16, color: colors.text },
  optionTextDanger: { color: colors.danger },
  cancel: { justifyContent: 'center', marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, borderRadius: 0 },
  cancelText: { fontSize: 16, fontWeight: '600', color: colors.textSub },
});
