import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors } from '@/constants/theme';

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  // danger: 退会・削除など取り消せない操作
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const inactive = disabled || loading;
  const primary = variant === 'primary';
  const filled = primary || variant === 'danger';
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : variant === 'danger' ? styles.buttonDanger : styles.buttonSecondary,
        (pressed || inactive) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={filled ? colors.white : colors.primary} />
      ) : (
        <Text style={[styles.buttonText, !filled && { color: colors.primary }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, ...inputProps }: { label: string; hint?: ReactNode } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...inputProps}
        style={[styles.input, inputProps.multiline && styles.inputMultiline, inputProps.style]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {message}
    </Text>
  );
}

export function errorMessage(e: unknown, fallback = '通信エラーが発生しました'): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonDanger: { backgroundColor: colors.danger },
  buttonSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  inputMultiline: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: colors.textSub },
  error: { fontSize: 14, color: colors.danger },
});
