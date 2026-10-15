import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, errorMessage } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useSession } from '@/context/SessionContext';
import * as api from '@/services/apiService';
import type { Dive } from '@/types';

type DiveForm = {
  sort_order: number;
  dive_site: string;
  point_detail: string;
  water_temp: string;
  visibility: string;
  max_depth: string;
  dive_time: string;
};

function toDiveForm(d: Dive, idx: number): DiveForm {
  return {
    sort_order: idx + 1,
    dive_site: d.dive_site ?? '',
    point_detail: d.point_detail ?? '',
    water_temp: d.water_temp != null ? String(d.water_temp) : '',
    visibility: d.visibility != null ? String(d.visibility) : '',
    max_depth: d.max_depth != null ? String(d.max_depth) : '',
    dive_time: d.dive_time != null ? String(d.dive_time) : '',
  };
}

function fromDiveForm(f: DiveForm, idx: number): Dive {
  return {
    sort_order: idx + 1,
    dive_site: f.dive_site.trim() || null,
    point_detail: f.point_detail.trim() || null,
    water_temp: f.water_temp !== '' ? parseFloat(f.water_temp) : null,
    visibility: f.visibility !== '' ? parseFloat(f.visibility) : null,
    max_depth: f.max_depth !== '' ? parseFloat(f.max_depth) : null,
    dive_time: f.dive_time !== '' ? parseInt(f.dive_time, 10) : null,
  };
}

export default function DiveInfoScreen() {
  const params = useLocalSearchParams<{
    communityId: string; eventId: string;
    weather?: string; notes?: string; dives?: string;
  }>();
  const communityId = Number(params.communityId);
  const eventId = Number(params.eventId);
  const { handleApiError } = useSession();

  const parsedDives: Dive[] = (() => {
    try { return params.dives ? JSON.parse(params.dives) : []; } catch { return []; }
  })();

  const [weather, setWeather] = useState(params.weather ?? '');
  const [notes, setNotes] = useState(params.notes ?? '');
  const [dives, setDives] = useState<DiveForm[]>(
    parsedDives.length > 0
      ? parsedDives.map((d, i) => toDiveForm(d, i))
      : [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDive = (idx: number, field: keyof DiveForm, value: string) => {
    setDives(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const addDive = () => {
    setDives(prev => [...prev, {
      sort_order: prev.length + 1,
      dive_site: '', point_detail: '',
      water_temp: '', visibility: '', max_depth: '', dive_time: '',
    }]);
  };

  const removeDive = (idx: number) => {
    setDives(prev => prev.filter((_, i) => i !== idx).map((d, i) => ({ ...d, sort_order: i + 1 })));
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.updateEventDiveInfo(communityId, eventId, {
        weather: weather.trim() || null,
        notes: notes.trim() || null,
        dives: dives.map((d, i) => fromDiveForm(d, i)),
      });
      router.back();
    } catch (e) {
      if (!handleApiError(e)) setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'ダイブ情報' }} />
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.field}>
          <Text style={styles.label}>天気</Text>
          <TextInput
            style={styles.input}
            value={weather}
            onChangeText={setWeather}
            placeholder="例: 晴れ"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>メモ</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="全体的なメモや感想"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {dives.map((dive, idx) => (
          <View key={idx} style={styles.diveCard}>
            <View style={styles.diveCardHeader}>
              <Text style={styles.diveCardTitle}>{idx + 1}本目</Text>
              <Pressable onPress={() => removeDive(idx)} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>ポイント名</Text>
              <TextInput style={styles.input} value={dive.dive_site} onChangeText={v => updateDive(idx, 'dive_site', v)} placeholder="例: 大物根" placeholderTextColor={colors.textMuted} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>エリア詳細</Text>
              <TextInput style={styles.input} value={dive.point_detail} onChangeText={v => updateDive(idx, 'point_detail', v)} placeholder="例: 北側" placeholderTextColor={colors.textMuted} />
            </View>

            <View style={styles.numRow}>
              <View style={[styles.field, styles.numField]}>
                <Text style={styles.label}>最大水深（m）</Text>
                <TextInput style={styles.input} value={dive.max_depth} onChangeText={v => updateDive(idx, 'max_depth', v)} placeholder="例: 25" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
              </View>
              <View style={[styles.field, styles.numField]}>
                <Text style={styles.label}>水温（℃）</Text>
                <TextInput style={styles.input} value={dive.water_temp} onChangeText={v => updateDive(idx, 'water_temp', v)} placeholder="例: 26" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
              </View>
            </View>
            <View style={styles.numRow}>
              <View style={[styles.field, styles.numField]}>
                <Text style={styles.label}>透明度（m）</Text>
                <TextInput style={styles.input} value={dive.visibility} onChangeText={v => updateDive(idx, 'visibility', v)} placeholder="例: 15" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
              </View>
              <View style={[styles.field, styles.numField]}>
                <Text style={styles.label}>潜水時間（分）</Text>
                <TextInput style={styles.input} value={dive.dive_time} onChangeText={v => updateDive(idx, 'dive_time', v)} placeholder="例: 50" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
              </View>
            </View>
          </View>
        ))}

        <Pressable style={styles.addDiveBtn} onPress={addDive}>
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.addDiveText}>ダイブを追加</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title="保存" onPress={submit} loading={submitting} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, gap: 20 },

  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },

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
  textarea: { height: 80, paddingTop: 10 },

  diveCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    backgroundColor: colors.card,
  },
  diveCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  diveCardTitle: { fontSize: 14, fontWeight: '700', color: colors.primary },

  numRow: { flexDirection: 'row', gap: 10 },
  numField: { flex: 1 },

  addDiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    borderStyle: 'dashed',
  },
  addDiveText: { fontSize: 14, color: colors.primary, fontWeight: '600' },

  error: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 10,
  },
});
