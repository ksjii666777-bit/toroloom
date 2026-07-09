import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Keyboard, TouchableWithoutFeedback } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useT } from '../../hooks/useT';

interface SignupScreenProps {
  navigation: any;
  route?: any;
}

export default function SignupScreen({ navigation, route }: SignupScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { signup, isLoading } = useAuthStore();

  // Detect referral source from navigation route params (e.g., from deep link)
  const referralSource = route?.params?.ref;

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      setError(t('errors.fieldRequired'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.passwordMinLength'));
      return;
    }
    setError('');
    await signup(name, email, phone, password, referralSource);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.createAccount')}</Text>
          <Text style={styles.subtitle}>{t('auth.signupSubtitle')}</Text>
        </View>

        {/* Referral badge — shown when arriving via deep link with ?ref= */}
        {referralSource && (
          <View style={styles.referralBanner}>
            <Ionicons name="gift" size={16} color={colors.primary} />
            <Text style={styles.referralText}>
              🎉 Referred by <Text style={styles.referralSource}>{referralSource}</Text>
            </Text>
          </View>
        )}

        {/* Form */}
        <View
          style={styles.form}
        >
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Input
            label={t('auth.fullName')}
            placeholder={t('auth.fullNamePlaceholder')}
            value={name}
            onChangeText={setName}
            icon="person-outline"
            autoCapitalize="words"
            id="signup-name"
            name="name"
          />

          <Input
            label={t('auth.email')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            icon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
            id="signup-email"
            name="email"
          />

          <Input
            label={t('auth.phone')}
            placeholder={t('auth.phonePlaceholder')}
            value={phone}
            onChangeText={setPhone}
            icon="call-outline"
            keyboardType="phone-pad"
            id="signup-phone"
            name="phone"
          />

          <Input
            label={t('auth.password')}
            placeholder={t('auth.passwordStrength')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            icon="lock-closed-outline"
            id="signup-password"
            name="password"
          />

          <Input
            label={t('auth.confirmPassword')}
            placeholder={t('auth.confirmPasswordPlaceholder')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            icon="lock-closed-outline"
            id="signup-confirm-password"
            name="confirmPassword"
            onSubmitEditing={handleSignup}
          />

          {/* Terms */}
          <View style={styles.termsContainer}>
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            <Text style={styles.termsText}>
              {t('auth.termsAndPrivacy', {
                terms: t('auth.termsOfService'),
                privacy: t('auth.privacyPolicy'),
              })}
            </Text>
          </View>

          <Button
            title={t('auth.createAccount')}
            onPress={handleSignup}
            loading={isLoading}
            size="large"
          />
        </View>

        {/* Login Link */}
        <View style={styles.loginSection}>
          <Text style={styles.hasAccount}>{t('auth.hasAccount')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>{t('auth.login')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: SPACING.xxxl,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
    marginLeft: SPACING.lg,
  },
  header: {
    paddingHorizontal: SPACING.xxl,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xxl,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
  },
  referralBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xxl,
    marginBottom: SPACING.lg,
    backgroundColor: '#6C63FF15',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#6C63FF30',
    gap: SPACING.sm,
  },
  referralText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  referralSource: {
    ...FONTS.semiBold,
    color: colors.primary,
  },
  form: {
    paddingHorizontal: SPACING.xxl,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF174415',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  errorText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.danger,
    flex: 1,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.xxl,
  },
  termsText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  termsLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  loginSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xxxl,
  },
  hasAccount: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
  },
  loginLink: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.primary,
  },
});
