import { StyleSheet, Text } from 'react-native';

import { ROLE_EDITOR, ROLE_OWNER, ROLE_TEMPORARY } from '@/constants/roles';
import { colors } from '@/constants/theme';

// ロールごとのバッジ色（Web版の roleBadge.tsx と同じ配色）
const ROLE_STYLE: Record<string, { color: string; backgroundColor: string }> = {
  [ROLE_OWNER]: { color: '#1d4ed8', backgroundColor: '#eff6ff' }, // blue-700 / blue-50
  [ROLE_EDITOR]: { color: colors.primary, backgroundColor: colors.primaryBg },
  [ROLE_TEMPORARY]: { color: colors.textSub, backgroundColor: '#f4f4f5' },
};
const DEFAULT_STYLE = { color: '#52525b', backgroundColor: '#f4f4f5' }; // zinc-600 / zinc-100

// テンポラリーは長いので、画面では「ゲスト」と表示する（アプリのゲスト表示と合わせる）
const LABEL: Record<string, string> = { [ROLE_TEMPORARY]: 'ゲスト' };

export function RoleBadge({ role }: { role: string }) {
  return <Text style={[styles.badge, ROLE_STYLE[role] ?? DEFAULT_STYLE]}>{LABEL[role] ?? role}</Text>;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
