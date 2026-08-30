import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import ToroloomLogo from '../../components/ui/ToroloomLogo';
import { SPACING, FONTS, BORDER_RADIUS} from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useT } from '../../hooks/useT';
import AppScreen from '../../components/ui/AppScreen';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';

type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError(t('errors.fieldRequired'));
      return;
    }
    setError('');
    const success = await login(email, password);
    if (!success) {
      setError(t('auth.invalidCredentials'));
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AppScreen scroll={false} padded={false}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <LinearGradient
            colors={colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoContainer}
          >
            <ToroloomLogo size={44} />
          </LinearGradient>
          <Text style={styles.appName}>{t('app.name')}</Text>
          <Text style={styles.tagline}>{t('app.tagline')}</Text>
        </View>

        {/* Login Form */}
        <View
          style={styles.formSection}
        >
          <Text style={styles.welcomeBack} testID="login-welcome-back">{t('auth.welcomeBack')}</Text>
          <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label={t('auth.email')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            icon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
            id="login-email"
            name="email"
            testID="login-email-input"
          />

          <Input
            label={t('auth.password')}
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            icon="lock-closed-outline"
            id="login-password"
            name="password"
            onSubmitEditing={handleLogin}
            testID="login-password-input"
          />

          <Pressable style={styles.forgotPassword}>
            <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
          </Pressable>

          <Button
            title={t('auth.login')}
            onPress={handleLogin}
            loading={isLoading}
            size="large"
            testID="login-btn"
          />


        </View>

        {/* Sign Up Link */}
        <View style={styles.signupSection}>
          <Text style={styles.noAccount} testID="login-no-account">{t('auth.noAccount')}</Text>
          <Pressable onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.signupLink} testID="login-signup-link">{t('auth.signup')}</Text>
          </Pressable>
        </View>
      </ScrollView>
      </AppScreen>
    </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: SPACING.xxxl,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  appName: {
    ...FONTS.bold,
    fontSize: FONTS.size.hero,
    color: colors.text,
    marginBottom: SPACING.xs,
  },
  tagline: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
  },
  formSection: {
    paddingHorizontal: SPACING.xxl,
  },
  welcomeBack: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxxl,
    color: colors.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
    marginBottom: SPACING.xxl,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.xxl,
  },
  forgotText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },

  signupSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xxxl,
  },
  noAccount: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
  },
  signupLink: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.primary,
  },
});
