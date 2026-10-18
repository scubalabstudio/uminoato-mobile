import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/constants/theme';
import * as api from '@/services/apiService';
import type { ReportPlatform } from '@/services/apiService';
import type { CommunityEventDetail } from '@/types';

type CharCount = 100 | 200 | 350 | 500;
type Focus = 'balance' | 'creatures' | 'conditions' | 'story';

const PLATFORMS: { value: ReportPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter',   label: 'X' },
  { value: 'line',      label: 'LINE' },
  { value: 'facebook',  label: 'Facebook' },
];

const CHAR_COUNTS: { value: CharCount; label: string; sub: string }[] = [
  { value: 100, label: 'コンパクト', sub: '〜100文字' },
  { value: 200, label: '短め',       sub: '〜200文字' },
  { value: 350, label: '標準',       sub: '〜350文字' },
  { value: 500, label: '詳細',       sub: '〜500文字' },
];

const FOCUS_OPTIONS: { value: Focus; label: string }[] = [
  { value: 'balance',    label: 'バランス' },
  { value: 'creatures',  label: '生き物メイン' },
  { value: 'conditions', label: '海況メイン' },
  { value: 'story',      label: 'ストーリー' },
];

const DEFAULT_CHAR_COUNT: Record<ReportPlatform, CharCount> = {
  instagram: 350,
  twitter:   350,
  line:      200,
  facebook:  100,
};

export function ReportTab({
  event,
  communityId,
  onEventUpdated,
}: {
  event: CommunityEventDetail;
  communityId: number;
  onEventUpdated: (e: CommunityEventDetail) => void;
}) {
  const savedReports = event.reports ?? {};

  const [platform, setPlatform] = useState<ReportPlatform>('instagram');
  const [charCount, setCharCount] = useState<CharCount>(350);
  const [focus, setFocus] = useState<Focus>('balance');
  const [emoji, setEmoji] = useState(true);
  const [feeling, setFeeling] = useState('');
  const [includeThanks, setIncludeThanks] = useState(false);

  const [generatedText, setGeneratedText] = useState(() => savedReports['instagram'] ?? '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingReported, setIsTogglingReported] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedText = savedReports[platform] ?? '';
  const isUnsaved = generatedText.length > 0 && generatedText !== savedText;

  const changePlatform = (p: ReportPlatform) => {
    setPlatform(p);
    setGeneratedText(savedReports[p] ?? '');
    setCharCount(DEFAULT_CHAR_COUNT[p]);
    setError(null);
  };

  const generate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const params: Parameters<typeof api.generateEventReport>[2] = {
        platform,
        feeling: feeling || undefined,
      };
      if (platform !== 'twitter') {
        params.char_count = charCount;
        params.focus = focus;
        params.emoji = emoji;
      }
      if (platform === 'line') {
        params.include_thanks = includeThanks;
      }
      const res = await api.generateEventReport(communityId, event.id, params);
      setGeneratedText(res.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'レポートの生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await api.saveEventReport(communityId, event.id, platform, generatedText);
      onEventUpdated({ ...event, reports: { ...savedReports, [platform]: generatedText } });
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const copy = async () => {
    await Clipboard.setStringAsync(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleReported = async () => {
    setIsTogglingReported(true);
    try {
      if (event.reported_at) {
        await api.unmarkEventReported(communityId, event.id);
        onEventUpdated({ ...event, reported_at: null });
      } else {
        await api.markEventReported(communityId, event.id);
        onEventUpdated({ ...event, reported_at: new Date().toISOString() });
      }
    } catch {
      Alert.alert('操作に失敗しました');
    } finally {
      setIsTogglingReported(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

      {/* プラットフォーム */}
      <View style={styles.section}>
        <Text style={styles.label}>投稿先</Text>
        <View style={styles.chips}>
          {PLATFORMS.map(p => (
            <Pressable
              key={p.value}
              onPress={() => changePlatform(p.value)}
              style={[styles.chip, platform === p.value && styles.chipActive]}
            >
              <Text style={[styles.chipText, platform === p.value && styles.chipTextActive]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* オプション（X 以外） */}
      {platform !== 'twitter' ? (
        <>
          <View style={styles.section}>
            <Text style={styles.label}>文字数</Text>
            <View style={styles.chips}>
              {CHAR_COUNTS.map(opt => (
                <Pressable
                  key={opt.value}
                  onPress={() => setCharCount(opt.value)}
                  style={[styles.chip, charCount === opt.value && styles.chipActive]}
                >
                  <Text style={[styles.chipText, charCount === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.chipSub, charCount === opt.value && styles.chipSubActive]}>
                    {opt.sub}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>フォーカス</Text>
            <View style={styles.chips}>
              {FOCUS_OPTIONS.map(opt => (
                <Pressable
                  key={opt.value}
                  onPress={() => setFocus(opt.value)}
                  style={[styles.chip, focus === opt.value && styles.chipActive]}
                >
                  <Text style={[styles.chipText, focus === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>絵文字</Text>
            <View style={styles.chips}>
              {([{ value: true, label: 'あり' }, { value: false, label: 'なし' }] as const).map(opt => (
                <Pressable
                  key={String(opt.value)}
                  onPress={() => setEmoji(opt.value)}
                  style={[styles.chip, emoji === opt.value && styles.chipActive]}
                >
                  <Text style={[styles.chipText, emoji === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      ) : null}

      {/* LINE: 感謝の文 */}
      {platform === 'line' ? (
        <Pressable onPress={() => setIncludeThanks(v => !v)} style={styles.toggleRow}>
          <View style={[styles.toggleBox, includeThanks && styles.toggleBoxActive]}>
            {includeThanks ? <Ionicons name="checkmark" size={13} color={colors.white} /> : null}
          </View>
          <Text style={styles.toggleLabel}>感謝の文を冒頭に含める</Text>
          <Text style={styles.toggleSub}>（ショップ向け）</Text>
        </Pressable>
      ) : null}

      {/* 感想 */}
      <View style={styles.section}>
        <Text style={styles.label}>感想・ひとこと（任意）</Text>
        <TextInput
          value={feeling}
          onChangeText={setFeeling}
          placeholder="例: 透明度が良くて最高でした！ウミガメが近くまで来てくれた"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          style={styles.feelingInput}
          maxLength={500}
        />
      </View>

      {/* 生成ボタン */}
      <Pressable
        onPress={generate}
        disabled={isGenerating}
        style={[styles.generateBtn, isGenerating && styles.generateBtnDisabled]}
      >
        {isGenerating ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Ionicons name="sparkles" size={16} color={colors.white} />
        )}
        <Text style={styles.generateBtnText}>
          {isGenerating ? '生成中...' : generatedText ? '再生成' : '生成する'}
        </Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* 生成結果 */}
      {generatedText.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.resultHeader}>
            <Text style={styles.label}>生成されたテキスト</Text>
            <View style={styles.resultActions}>
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : isUnsaved ? (
                <Pressable onPress={save} style={styles.actionBtn}>
                  <Ionicons name="save-outline" size={14} color={colors.primary} />
                  <Text style={styles.actionBtnText}>保存</Text>
                </Pressable>
              ) : (
                <View style={styles.savedLabel}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                  <Text style={styles.savedText}>保存済み</Text>
                </View>
              )}
              <Pressable onPress={copy} style={styles.actionBtn}>
                <Ionicons name={copied ? 'checkmark-circle-outline' : 'copy-outline'} size={14} color={colors.primary} />
                <Text style={styles.actionBtnText}>{copied ? 'コピー済み' : 'コピー'}</Text>
              </Pressable>
            </View>
          </View>
          <TextInput
            value={generatedText}
            onChangeText={setGeneratedText}
            multiline
            style={styles.resultInput}
          />
          <Text style={styles.charCount}>{generatedText.length} 文字</Text>
        </View>
      ) : null}

      {/* 報告済みボタン */}
      <View style={styles.reportedSection}>
        <Pressable
          onPress={toggleReported}
          disabled={isTogglingReported}
          style={[styles.reportedBtn, event.reported_at && styles.reportedBtnActive]}
        >
          {isTogglingReported ? (
            <ActivityIndicator size="small" color={event.reported_at ? colors.primary : colors.textSub} />
          ) : (
            <Ionicons
              name={event.reported_at ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={16}
              color={event.reported_at ? colors.primary : colors.textSub}
            />
          )}
          <Text style={[styles.reportedBtnText, event.reported_at && styles.reportedBtnTextActive]}>
            {event.reported_at ? '報告済み（タップで解除）' : '報告済みにする'}
          </Text>
        </Pressable>
        {event.reported_at ? (
          <Text style={styles.reportedDate}>
            報告日: {new Date(event.reported_at).toLocaleDateString('ja-JP')}
          </Text>
        ) : null}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 20, paddingBottom: 48 },
  section: { gap: 8 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSub },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
  chipText: { fontSize: 13, color: colors.textSub },
  chipTextActive: { color: colors.primary, fontWeight: '600' },
  chipSub: { fontSize: 10, color: colors.textMuted },
  chipSubActive: { color: colors.primary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleBox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleBoxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleLabel: { fontSize: 14, color: colors.text },
  toggleSub: { fontSize: 12, color: colors.textMuted },
  feelingInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.card,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  generateBtnDisabled: { opacity: 0.6 },
  generateBtnText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  errorText: { fontSize: 13, color: colors.danger, textAlign: 'center' },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  savedLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  savedText: { fontSize: 13, color: colors.textMuted },
  resultInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.card,
    minHeight: 200,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 12, color: colors.textMuted, textAlign: 'right' },
  reportedSection: { gap: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  reportedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportedBtnActive: { backgroundColor: colors.primaryBg, borderColor: colors.primary },
  reportedBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSub },
  reportedBtnTextActive: { color: colors.primary },
  reportedDate: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
