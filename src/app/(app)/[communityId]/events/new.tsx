import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, errorMessage } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useCommunity } from '@/context/CommunityContext';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';

type DateField = 'start' | 'end';

export default function NewEventScreen() {
  const params = useLocalSearchParams<{ communityId: string }>();
  const communityId = Number(params.communityId);
  const { handleApiError } = useSession();
  const { reload } = useCommunity();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [membersCanEdit, setMembersCanEdit] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [pickerField, setPickerField] = useState<DateField | null>(null);
  const [pickerTempDate, setPickerTempDate] = useState<Date>(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fmt = (d: Date) =>
    `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

  const toApiDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const openPicker = (field: DateField) => {
    const initial = field === 'start'
      ? (startDate ?? new Date())
      : (endDate ?? startDate ?? new Date());
    setPickerTempDate(initial);
    setPickerField(field);
  };
  const clearDate = (field: DateField) => {
    if (field === 'start') { setStartDate(null); if (endDate && !startDate) setEndDate(null); }
    if (field === 'end') setEndDate(null);
  };

  const confirmPicker = () => {
    if (pickerField === 'start') {
      setStartDate(pickerTempDate);
      if (endDate && pickerTempDate > endDate) setEndDate(pickerTempDate);
    } else if (pickerField === 'end') {
      setEndDate(pickerTempDate);
    }
    setPickerField(null);
  };

  const submit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const event = await api.createEvent(communityId, {
        name: name.trim(),
        description: description.trim() || undefined,
        start_date: startDate ? toApiDate(startDate) : undefined,
        end_date: endDate ? toApiDate(endDate) : undefined,
        external_public: isPublic,
        members_can_edit: membersCanEdit,
      });
      await reload();
      router.replace(`/${communityId}/events/${event.id}`);
    } catch (e) {
      if (!handleApiError(e)) setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: '新規イベント作成' }} />
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {/* イベント名 */}
        <Field label="イベント名" required>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="例: 柏島ツアー2026夏"
            placeholderTextColor={colors.textMuted}
            maxLength={255}
            returnKeyType="next"
          />
        </Field>

        {/* 説明 */}
        <Field label="説明">
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="イベントの概要やメモ"
            placeholderTextColor={colors.textMuted}
            maxLength={2000}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Field>

        {/* 日付 */}
        <Field label="日付（任意）" hint="1日のみの場合は開始日だけ入力してください">
          <View style={styles.dateRow}>
            <DateButton
              label={startDate ? fmt(startDate) : '開始日'}
              hasValue={!!startDate}
              onPress={() => openPicker('start')}
              onClear={() => clearDate('start')}
            />
            <Text style={styles.dateSep}>〜</Text>
            <DateButton
              label={endDate ? fmt(endDate) : '終了日'}
              hasValue={!!endDate}
              onPress={() => openPicker('end')}
              onClear={() => clearDate('end')}
            />
          </View>
        </Field>

        {/* メンバー編集 */}
        <ToggleRow
          label="メンバーが写真を編集できる"
          description="オフにすると主催者以外は閲覧のみになります"
          value={membersCanEdit}
          onChange={setMembersCanEdit}
        />

        {/* 外部公開 */}
        <ToggleRow
          label="外部公開する"
          description="コミュニティメンバー以外もレポートを閲覧できます"
          value={isPublic}
          onChange={setIsPublic}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title="イベントを作成"
          onPress={submit}
          loading={submitting}
          disabled={!name.trim()}
        />
      </ScrollView>

      {/* 日付ピッカー ボトムシート */}
      <Modal
        visible={pickerField !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerField(null)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setPickerField(null)} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerToolbar}>
            <Pressable onPress={() => setPickerField(null)} hitSlop={12}>
              <Text style={styles.pickerCancel}>キャンセル</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>
              {pickerField === 'start' ? '開始日' : '終了日'}
            </Text>
            <Pressable onPress={confirmPicker} hitSlop={12}>
              <Text style={styles.pickerDone}>完了</Text>
            </Pressable>
          </View>
          <DateTimePicker
            mode="date"
            value={pickerTempDate}
            minimumDate={pickerField === 'end' && startDate ? startDate : undefined}
            display="inline"
            onValueChange={(_event, date) => { if (date) setPickerTempDate(date); }}
            onDismiss={() => setPickerField(null)}
            locale="ja"
            style={styles.picker}
            accentColor={colors.primary}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Field({
  label, required, hint, children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function DateButton({
  label, hasValue, onPress, onClear,
}: {
  label: string;
  hasValue: boolean;
  onPress: () => void;
  onClear: () => void;
}) {
  return (
    <Pressable style={[styles.dateButton, hasValue && styles.dateButtonActive]} onPress={onPress}>
      <Ionicons name="calendar-outline" size={14} color={hasValue ? colors.primary : colors.textMuted} />
      <Text style={[styles.dateButtonText, hasValue && styles.dateButtonTextActive]}>{label}</Text>
      {hasValue ? (
        <Pressable onPress={onClear} hitSlop={8}>
          <Ionicons name="close-circle" size={15} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function ToggleRow({
  label, description, value, onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onChange(!value)}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary }}
        thumbColor={colors.white}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 20 },

  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  required: { color: colors.danger },
  hint: { fontSize: 12, color: colors.textMuted },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
  textarea: { height: 96, paddingTop: 10 },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateSep: { fontSize: 14, color: colors.textMuted },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  dateButtonActive: { borderColor: colors.primary },
  dateButtonText: { flex: 1, fontSize: 13, color: colors.textMuted },
  dateButtonTextActive: { color: colors.text },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  toggleDesc: { fontSize: 12, color: colors.textSub },

  error: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
  },

  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pickerSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  pickerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignSelf: 'stretch',
  },
  pickerTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  pickerCancel: { fontSize: 15, color: colors.textSub },
  pickerDone: { fontSize: 15, fontWeight: '600', color: colors.primary },
  picker: { width: '100%', alignSelf: 'center' },
});
