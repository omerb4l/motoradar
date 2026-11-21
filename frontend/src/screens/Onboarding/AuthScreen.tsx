import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/store/useAuthStore';
import { colors } from '@/theme/colors';
import { fonts, type as ty } from '@/theme/typography';
import { DiagonalStripePlaceholder } from '@/components/common/DiagonalStripePlaceholder';

/**
 * Ports MotoRadarPhone.dc.html screen="welcome" — the source design is
 * OAuth-style ("CONTINUE WITH PHONE/APPLE"), which this app can't offer
 * (no Sign in with Apple / phone-OTP backend). Same hero, wordmark, tagline
 * and glass/CTA styling; the OAuth buttons are replaced with the real
 * email+password form this backend actually supports.
 */
export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const error = useAuthStore((s) => s.error);
  const loginAction = useAuthStore((s) => s.login);
  const signupAction = useAuthStore((s) => s.signup);
  const clearError = useAuthStore((s) => s.clearError);

  const canSubmit =
    email.trim().length > 0 &&
    password.length >= (mode === 'signup' ? 8 : 1) &&
    (mode === 'login' || username.trim().length >= 3);

  const handleSubmit = async () => {
    try {
      if (mode === 'login') {
        await loginAction(email.trim(), password);
      } else {
        await signupAction(username.trim(), email.trim(), password);
      }
    } catch {
      // error already captured in the store; nothing else to do here.
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <DiagonalStripePlaceholder height={300} label={'[ NIGHT RIDE SHOT ]'} />
          <LinearGradient
            colors={['rgba(8,8,10,0.55)', 'rgba(8,8,10,0.15)', 'rgba(8,8,10,0.85)', colors.void]}
            locations={[0, 0.3, 0.78, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={styles.content}>
          <Text style={styles.eyebrow}>FOR RIDERS ONLY</Text>
          <Text style={styles.wordmark}>MOTO{'\n'}RADAR</Text>
          <Text style={styles.tagline}>See who's out riding. Get help when it goes wrong. Nothing else.</Text>

          <View style={styles.form}>
            {mode === 'signup' && (
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              style={({ pressed }) => [styles.ctaWrap, pressed && styles.ctaPressed]}
            >
              <LinearGradient
                colors={['#7BFF5C', '#3FE22A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[styles.cta, (!canSubmit || isSubmitting) && styles.ctaDisabled]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.void} />
                ) : (
                  <Text style={styles.ctaLabel}>{mode === 'login' ? 'LOG IN' : 'SIGN UP'}</Text>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => {
                clearError();
                setMode(mode === 'login' ? 'signup' : 'login');
              }}
              hitSlop={8}
            >
              <Text style={styles.switchModeText}>
                {mode === 'login' ? "DON'T HAVE AN ACCOUNT? SIGN UP" : 'ALREADY HAVE AN ACCOUNT? LOG IN'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.disclaimer}>
            NO FEED · NO FOLLOWERS · NO LIKES{'\n'}LOCATION SHARED ONLY WHILE RIDING
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.void },
  scrollContent: { flexGrow: 1 },
  hero: { height: 300 },
  content: { paddingHorizontal: 22, paddingBottom: 44, marginTop: -70 },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: colors.speedGreen,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 54,
    lineHeight: 50,
    letterSpacing: -2.4,
    color: colors.white,
    marginTop: 16,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    marginTop: 16,
    maxWidth: 300,
  },
  form: { marginTop: 32, gap: 11 },
  input: {
    height: 58,
    borderRadius: 18,
    paddingHorizontal: 18,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  error: { color: colors.sosRed, fontSize: 13, textAlign: 'center' },
  ctaWrap: { marginTop: 4, borderRadius: 20, shadowColor: colors.speedGreen, shadowOpacity: 0.3, shadowRadius: 36, shadowOffset: { width: 0, height: 14 } },
  ctaPressed: { opacity: 0.85 },
  cta: {
    height: 66,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.5 },
  ctaLabel: {
    fontFamily: fonts.display,
    fontSize: 17,
    letterSpacing: 0.5,
    color: '#04120a',
  },
  switchModeText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
  },
  disclaimer: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 18,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.32)',
    textAlign: 'center',
    marginTop: 28,
  },
});
