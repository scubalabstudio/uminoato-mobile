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

export default function EditEventScreen() {
  const params = useLocalSearchParams<{
    communityId: string; eventId: string;
    name?: string; desc?: string; start?: string; end?: string; pub?: string; mce?: string;
  }>();
  const communityId = Number(params.communityId);
  const eventId = Number(params.eventId);
  const { handleApiError } = useSession();
  const { reload } = useCommunity();

  const [name, setName] = useState(params.name ?? '');
  const [description, setDescription] = useState(params.desc ?? '');
  const [startDate, setStartDate] = useState<Date | null>(params.start ? new Date(params.start) : null);
  const [endDate, setEndDate] = useState<Date | null>(params.end ? new Date(params.end) : null);
  const [isPublic, setIsPublic] = useState(params.pub === '1');
  const [membersCanEdit, setMembersCanEdit] = useState(params.mce !== '0');
  const [pickerField, setPickerField] = useState<DateField | null>(null);
  const [pickerTempDate, setPickerTempDate] = useState<Date>(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fmt = (d: Date) =>
    `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  const toApiDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const openPicker = (field: DateField) => {
    const initial = field === 'start' ? (startDate ?? new Date()) : (endDate ?? startDate ?? new Date());
    setPickerTempDate(initial);
    setPickerField(field);
  };
  const clearDate = (field: DateField) => {
    if (field === 'start') setStartDate(null);
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
      await api.updateEvent(communityId, eventId, {
        name: name.trim(),
        description: description.trim() || null,
        start_date: startDate ? toApiDate(startDate) : null,
        end_date: endDate ? toApiDate(endDate) : null,
        external_public: isPublic,
        members_can_edit: membersCanEdit,
      });
      await reload();
      router.back();
    } catch (e) {
      if (!handleApiError(e)) setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'イベントを編集' }} />
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.field}>
          <Text style={styles.label}>イベント名 <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="例: 柏島ツアー2026夏"
            placeholderTextColor={colors.textMuted}
            maxLength={255}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>説明</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="イベントの概要やメモ"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>日付（任意）</Text>
          <View style={styles.dateRow}>
            <Pressable style={[styles.dateButton, startDate && styles.dateButtonActive]} onPress={() => openPicker('start')}>
              <Ionicons name="calendar-outline" size={14} color={startDate ? colors.primary : colors.textMuted} />
              <Text style={[styles.dateButtonText, startDate && styles.dateButtonTextActive]}>{startDate ? fmt(startDate) : '開始日'}</Text>
              {startDate ? (
                <Pressable onPress={() => clearDate('start')} hitSlop={8}>
                  <Ionicons name="close-circle" size={15} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </Pressable>
            <Text style={styles.dateSep}>〜</Text>
            <Pressable style={[styles.dateButton, endDate && styles.dateButtonActive]} onPress={() => openPicker('end')}>
              <Ionicons name="calendar-outline" size={14} color={endDate ? colors.primary : colors.textMuted} />
              <Text style={[styles.dateButtonText, endDate && styles.dateButtonTextActive]}>{endDate ? fmt(endDate) : '終了日'}</Text>
              {endDate ? (
                <Pressable onPress={() => clearDate('end')} hitSlop={8}>
                  <Ionicons name="close-circle" size={15} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.toggleRow} onPress={() => setMembersCanEdit(v => !v)}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleLabel}>メンバーが写真を編集できる</Text>
            <Text style={styles.toggleDesc}>オフにすると主催者以外は閲覧のみになります</Text>
          </View>
          <Switch value={membersCanEdit} onValueChange={setMembersCanEdit} trackColor={{ true: colors.primary }} thumbColor={colors.white} />
        </Pressable>

        <Pressable style={styles.toggleRow} onPress={() => setIsPublic(v => !v)}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleLabel}>外部公開する</Text>
            <Text style={styles.toggleDesc}>コミュニティメンバー以外もレポートを閲覧できます</Text>
          </View>
          <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: colors.primary }} thumbColor={colors.white} />
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title="変更を保存" onPress={submit} loading={submitting} disabled={!name.trim()} />
      </ScrollView>

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
            <Text style={styles.pickerTitle}>{pickerField === 'start' ? '開始日' : '終了日'}</Text>
            <Pressable onPress={confirmPicker} hitSlop={12}>
              <Text style={styles.pickerDone}>完了</Text>
            </Pressable>
          </View>
          <DateTimePicker
            mode="date"
            value={pickerTempDate}
            minimumDate={pickerField === 'end' && startDate ? startDate : undefined}
            display="inline"
            onValueChange={(_e, d) => { if (d) setPickerTempDate(d); }}
            onDismiss={() => setPickerField(null)}
            locale="ja"
            style={{ width: '100%' }}
            accentColor={colors.primary}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 20 },

  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  required: { color: colors.danger },

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

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
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
});
