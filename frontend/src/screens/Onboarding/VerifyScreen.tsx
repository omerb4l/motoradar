import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { glass } from '@/theme/glass';
import { RootStackParamList } from '@/navigation/types';

type Status = 'idle' | 'scanning' | 'verified';

const SCAN_DURATION_MS = 2200;

/**
 * Ports MotoRadarPhone.dc.html screen="verify". No backend endpoint exists
 * yet for motorcycle verification (the `motorcycles` table in
 * backend/src/db/init.sql has the columns — is_verified, verified_at — but
 * no routes), so "verified" here is local UI state only, lost on nav away.
 * Wire this to a real POST /api/motorcycles/verify once that lands.
 */
export function VerifyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  const scanProgress = useSharedValue(0);

  useEffect(() => {
    if (status !== 'scanning') return;

    scanProgress.value = withRepeat(withTiming(1, { duration: 950, easing: Easing.inOut(Easing.ease) }), -1, true);

    const timer = setTimeout(() => setStatus('verified'), SCAN_DURATION_MS);
    return () => clearTimeout(timer);
  }, [status, scanProgress]);

  const scanLineStyle = useAnimatedStyle(() => ({
    top: `${2 + scanProgress.value * 92}%`,
  }));

  const pickImage = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setStatus('scanning');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0d0e10', colors.void]} style={StyleSheet.absoluteFill} />
      <View style={styles.glowOuter} pointerEvents="none" />
      <View style={styles.glowMid} pointerEvents="none" />
      <View style={styles.glowInner} pointerEvents="none" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stepRow}>
          <View style={styles.stepBarFilled} />
          <View style={styles.stepBarFilled} />
          <View style={styles.stepBarEmpty} />
          <Text style={styles.stepLabel}>STEP 2 / 3</Text>
        </View>

        <Text style={styles.title}>GARAGE{'\n'}VERIFICATION</Text>
        <Text style={styles.subtitle}>
          One photo of your bike — or its registration — earns the verified badge. Riders trust verified garages.
        </Text>

        {status === 'idle' ? (
          <Pressable style={styles.dropZone} onPress={() => pickImage('library')}>
            <View style={styles.uploadIcon}>
              <View style={styles.uploadIconBase} />
              <View style={styles.uploadIconStem} />
              <View style={styles.uploadIconArrow} />
            </View>
            <Text style={styles.dropTitle}>Drop your bike photo</Text>
            <Text style={styles.dropHint}>
              JPG · PNG · UP TO 20MB{'\n'}VIN PLATE OR REGISTRATION ALSO WORKS
            </Text>
          </Pressable>
        ) : (
          photoUri && (
            <View style={styles.previewCard}>
              <View style={styles.previewImageWrap}>
                <Image source={{ uri: photoUri }} style={styles.previewImage} />
                {status === 'scanning' && <Animated.View style={[styles.scanLine, scanLineStyle]} />}
              </View>
              <View style={styles.previewStatusRow}>
                <View style={[styles.previewBadge, status === 'verified' && styles.previewBadgeDone]}>
                  <Text style={styles.previewBadgeIcon}>{status === 'verified' ? '✓' : '···'}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.previewTitle, status === 'verified' && styles.previewTitleDone]}>
                    {status === 'verified' ? 'Verified' : 'Scanning…'}
                  </Text>
                  <Text style={styles.previewNote}>
                    {status === 'verified' ? 'Badge unlocked — visible on your garage.' : 'Checking plate and VIN…'}
                  </Text>
                </View>
              </View>
            </View>
          )
        )}

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionButton} onPress={() => pickImage('camera')}>
            <Text style={styles.actionLabel}>TAKE PHOTO</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => pickImage('library')}>
            <Text style={styles.actionLabel}>UPLOAD FILE</Text>
          </Pressable>
        </View>

        <View style={styles.privacyRow}>
          <View style={styles.privacyIcon} />
          <Text style={styles.privacyText}>Documents are checked once, then deleted. Only the badge is stored.</Text>
        </View>

        {status === 'verified' && (
          <Pressable style={styles.ctaWrap} onPress={() => navigation.goBack()}>
            <LinearGradient
              colors={['#7BFF5C', '#3FE22A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.cta}
            >
              <Text style={styles.ctaLabel}>CONTINUE</Text>
            </LinearGradient>
          </Pressable>
        )}

        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.skipText}>SKIP FOR NOW</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.void },
  // Three concentric, decreasingly-opaque circles fake the CSS radial-gradient
  // + blur(8px) glow from the source design — RN has no backdrop blur for a
  // plain View, so a single flat circle read as a hard-edged disc instead of
  // a soft glow.
  glowOuter: {
    position: 'absolute',
    top: -170,
    right: -140,
    width: 460,
    height: 460,
    borderRadius: 230,
    backgroundColor: 'rgba(99,255,77,0.035)',
  },
  glowMid: {
    position: 'absolute',
    top: -130,
    right: -100,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(99,255,77,0.045)',
  },
  glowInner: {
    position: 'absolute',
    top: -90,
    right: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(99,255,77,0.05)',
  },
  content: { paddingTop: 64, paddingHorizontal: 18, paddingBottom: 40 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBarFilled: { width: 34, height: 4, borderRadius: 2, backgroundColor: colors.speedGreen },
  stepBarEmpty: { width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.16)' },
  stepLabel: { marginLeft: 'auto', fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.3, color: colors.textTertiary },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -0.9,
    color: colors.white,
    marginTop: 26,
  },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textSecondary, marginTop: 14 },
  dropZone: {
    marginTop: 22,
    minHeight: 224,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...glass.panel,
    borderRadius: 26,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.26)',
  },
  uploadIcon: { width: 62, height: 62, alignItems: 'center', justifyContent: 'flex-end' },
  uploadIconBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 34,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  uploadIconStem: { position: 'absolute', top: 2, width: 2.5, height: 30, borderRadius: 2, backgroundColor: colors.speedGreen },
  uploadIconArrow: {
    position: 'absolute',
    top: 3,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.speedGreen,
  },
  dropTitle: { fontFamily: fonts.displaySemibold, fontSize: 19, color: colors.white, marginTop: 20 },
  dropHint: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: 0.3,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 10,
  },
  previewCard: { marginTop: 22, padding: 18, ...glass.panel, borderRadius: 26 },
  previewImageWrap: {
    height: 132,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#181820',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  previewImage: { width: '100%', height: '100%' },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.speedGreen,
    shadowColor: colors.speedGreen,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  previewStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  flex: { flex: 1, minWidth: 0 },
  previewBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  previewBadgeDone: { backgroundColor: 'rgba(99,255,77,0.16)', borderColor: 'rgba(99,255,77,0.5)' },
  previewBadgeIcon: { fontFamily: fonts.displaySemibold, fontSize: 14, color: colors.speedGreen },
  previewTitle: { fontFamily: fonts.displaySemibold, fontSize: 15, color: colors.white },
  previewTitleDone: { color: colors.speedGreen },
  previewNote: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.4, color: colors.textTertiary, marginTop: 5 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionButton: {
    flex: 1,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  actionLabel: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.8, color: colors.white },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  privacyIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  privacyText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  ctaWrap: { marginTop: 20, borderRadius: 20 },
  cta: { height: 66, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  ctaLabel: { fontFamily: fonts.display, fontSize: 18, letterSpacing: 0.5, color: '#04120a' },
  skipText: {
    textAlign: 'center',
    marginTop: 16,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.textTertiary,
  },
});
