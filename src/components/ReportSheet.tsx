import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Field, FormError, errorMessage } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import type { ReportReason, ReportTargetType } from '@/types';

export type ReportTarget = {
  type: ReportTargetType;
  id: number;
  communityId?: number | null;
  // 画面の見出しに出す（「この写真」「〇〇さん」など）
  label: string;
};

// サーバーの ContentReport::REASONS と同じ並び・文言
const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'inappropriate', label: '不適切な内容（わいせつ・暴力など）' },
  { value: 'harassment', label: '嫌がらせ・誹謗中傷' },
  { value: 'spam', label: 'スパム・宣伝' },
  { value: 'rights', label: '著作権・肖像権・プライバシーの侵害' },
  { value: 'other', label: 'その他' },
];

// 不適切な写真・ユーザーを運営者に通報する画面
export function ReportSheet({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  return (
    <Modal visible={target !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {target ? <ReportForm key={`${target.type}-${target.id}`} target={target} onClose={onClose} /> : null}
    </Modal>
  );
}

function ReportForm({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const { handleApiError } = useSession();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!reason) {
      setError('通報の理由を選んでください');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api.reportContent({
        target_type: target.type,
        target_id: target.id,
        reason,
        detail: detail.trim() || null,
        community_id: target.communityId ?? null,
      });
      onClose();
      Alert.alert('通報を受け付けました', '運営者が内容を確認し、必要に応じて対応します。ご協力ありがとうございます。');
    } catch (e) {
      if (handleApiError(e)) return;
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>通報する</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="閉じる" hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Text style={styles.lead}>
          {target.label}を運営者に通報します。通報したことは相手には知らされません。
        </Text>

        <View style={styles.reasons} accessibilityRole="radiogroup">
          {REASONS.map((r) => {
            const selected = reason === r.value;
            return (
              <Pressable
                key={r.value}
                onPress={() => setReason(r.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={[styles.reason, selected && styles.reasonSelected]}
              >
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selected ? colors.primary : colors.textMuted}
                />
                <Text style={styles.reasonText}>{r.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Field
          label="詳しい内容（任意）"
          value={detail}
          onChangeText={setDetail}
          placeholder="気になった点を書いてください"
          multiline
          maxLength={1000}
        />
        <FormError message={error} />
        <Button title="通報する" variant="danger" onPress={send} loading={sending} disabled={!reason} />
        <Text style={styles.hint}>
          運営者が確認し、規約に違反している場合は写真の削除などの対応をします。
          この人の写真を見たくない場合は、ブロックもできます。
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { padding: 16, gap: 16, paddingBottom: 48 },
  lead: { fontSize: 14, color: colors.textSub, lineHeight: 21 },
  reasons: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  reasonSelected: { backgroundColor: colors.primaryBg },
  reasonText: { fontSize: 15, color: colors.text, flexShrink: 1 },
  hint: { fontSize: 12, color: colors.textSub, lineHeight: 18 },
});
