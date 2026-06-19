import React, { useState, useMemo, useCallback } from 'react';
import { View, TextInput, Text, StyleSheet, Platform, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad' | 'decimal-pad';
  multiline?: boolean;
  style?: ViewStyle;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  testID?: string;
}

export default function Input({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  error,
  icon,
  keyboardType = 'default',
  multiline = false,
  style,
  autoCapitalize = 'none',
  testID,
}: InputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Compute border color from state — no animation needed
  const borderColor = error
    ? colors.danger
    : isFocused
      ? colors.primary
      : colors.border;

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, error && styles.labelError]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputContainer,
          {
            borderColor,
          },
          multiline && styles.multilineContainer,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={error ? colors.danger : isFocused ? colors.primary : colors.textMuted}
            style={styles.icon}
          />
        )}
        <TextInput
          style={[styles.input, multiline && styles.multiline]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !showPassword}
          onFocus={handleFocus}
          onBlur={handleBlur}
          keyboardType={keyboardType}
          multiline={multiline}
          autoCapitalize={autoCapitalize}
          testID={testID}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
        />
        {secureTextEntry && (
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={colors.textMuted}
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeIcon}
          />
        )}
        {!secureTextEntry && value.length > 0 && !error && isFocused && (
          <Ionicons
            name="checkmark-circle"
            size={18}
            color={colors.success}
            style={styles.validIcon}
          />
        )}
      </View>
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={14} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>        </View>
      )}</View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  label: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginBottom: SPACING.sm,
    letterSpacing: 0.3,
  },
  labelError: {
    color: colors.danger,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: SPACING.md,
  },
  multilineContainer: {
    minHeight: 80,
    alignItems: 'flex-start',
  },
  icon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: FONTS.size.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm + 2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  multiline: {
    minHeight: 60,
    textAlignVertical: 'top',
    paddingTop: SPACING.sm,
  },
  eyeIcon: {
    marginLeft: SPACING.sm,
    padding: 4,
  },
  validIcon: {
    marginLeft: SPACING.xs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
    paddingLeft: SPACING.xs,
  },
  errorText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.danger,
    flex: 1,
  },
});
