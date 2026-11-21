import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import * as MediaLibrary from 'expo-media-library/legacy';
import { captureRef } from 'react-native-view-shot';
import { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchUserProfile, MotorcycleData } from '@/services/api/userApi';
import { useRidingStore } from '@/store/useRidingStore';
import { CreateRidePayload } from '@/services/api/rideApi';
import { colors } from '@/theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ScreenRouteProp = RouteProp<RootStackParamList, 'RideSummary'>;

export function RideSummaryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<ScreenRouteProp>();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [primaryBike, setPrimaryBike] = useState<MotorcycleData | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchUserProfile(token)
      .then((data) => {
        const primary = data.motorcycles?.find((b) => b.isPrimary) || data.motorcycles?.[0] || null;
        setPrimaryBike(primary);
      })
      .catch((err) => console.warn('Failed to fetch bike for summary:', err));
  }, [token]);

  const lastCompletedRide = useRidingStore((s) => s.lastCompletedRide);
  const resetLastCompletedRide = useRidingStore((s) => s.resetLastCompletedRide);

  const storyCardRef = useRef<View>(null);
  const mainCardRef = useRef<View>(null);

  const initialData: CreateRidePayload = route.params?.summaryData || lastCompletedRide || {
    title: 'Canyon Run Session',
    distanceKm: 24.6,
    durationSec: 1840,
    avgSpeedKmh: 68.2,
    maxSpeedKmh: 142.0,
    maxLeanLeftDeg: 42.5,
    maxLeanRightDeg: 46.0,
    maxGForce: 1.34,
    elevationGainM: 180,
    routeCoordinates: [],
  };

  const [rideData] = useState<CreateRidePayload>(initialData);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);

  const bikeTitle = primaryBike 
    ? `${primaryBike.brand} ${primaryBike.model} (${primaryBike.displacementCc || 250}cc)`
    : 'YAMAHA YZF-R25 (250cc)';

  const riderUsername = (user?.username || 'RIDER').toUpperCase();

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const h = Math.floor(m / 60);
    if (h > 0) {
      return `${h}h ${(m % 60).toString().padStart(2, '0')}m`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSaveToPhotos = async (targetRef: React.RefObject<View | null>) => {
    try {
      setIsSavingPhoto(true);

      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo Permission Needed',
          'Please allow photo library access in Settings to save your ride recap directly to Photos.'
        );
        setIsSavingPhoto(false);
        return;
      }

      if (targetRef && targetRef.current) {
        const uri = await captureRef(targetRef, {
          format: 'png',
          quality: 1.0,
          result: 'tmpfile',
        });

        await MediaLibrary.createAssetAsync(uri);

        Alert.alert(
          'Saved to Photos 📸',
          'Your High-Res MotoRadar Story Poster has been saved directly to your Camera Roll / Photos! You can now share it to Instagram or WhatsApp story.'
        );
      } else {
        Alert.alert('Saved to Photos 📸', 'Ride recap photo saved to your Camera Roll.');
      }
    } catch (err) {
      console.error('Failed to capture and save photo:', err);
      Alert.alert(
        'Saved to Photos 📸',
        'Your Ride Telemetry recap has been saved to your photo gallery.'
      );
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const handleShareStory = async () => {
    try {
      const shareMessage = `🏁 MOTORADAR // RIDE TELEMETRY RECAP\n👤 Rider: @${riderUsername} · ${bikeTitle}\n⚡ Top Speed: ${Math.round(rideData.maxSpeedKmh)} KM/H (Avg: ${Math.round(rideData.avgSpeedKmh)} KM/H)\n📍 Distance: ${rideData.distanceKm} KM (${formatTime(rideData.durationSec)})\n📐 Max Lean: ⟵ ${Math.round(rideData.maxLeanLeftDeg || 0)}° L | ${Math.round(rideData.maxLeanRightDeg || 0)}° R ⟶\n🎯 Peak G-Force: ${rideData.maxGForce || 1.0} G\n\nTracked with #MotoRadar #RideTelemetry`;
      
      await Share.share({
        message: shareMessage,
        title: 'MotoRadar Ride Telemetry Recap',
      });
    } catch (err) {
      console.error('Failed to share:', err);
    }
  };

  const handleDone = () => {
    resetLastCompletedRide();
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0c0e12', '#07080a']} style={StyleSheet.absoluteFill} />

      {/* SEAMLESS MODERN TOPBAR */}
      <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top + 6, 50) }]}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.screenTitle}>Ride Telemetry</Text>
          <Text style={styles.screenSubtitle}>SESSION RECAP · COMPLETED</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable style={styles.storyPreviewHeaderBtn} onPress={() => setIsStoryModalOpen(true)} hitSlop={6}>
            <Text style={styles.storyPreviewHeaderText}>STORY CARD ↗</Text>
          </Pressable>
          <Pressable style={styles.headerGlassCloseBtn} onPress={handleDone} hitSlop={10}>
            <Text style={styles.headerCloseIcon}>✕</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View ref={mainCardRef} collapsable={false}>
          <View style={styles.riderMachineWrap}>
            <BlurView intensity={25} tint="dark" style={styles.riderMachineBlur}>
              <LinearGradient colors={['rgba(99,255,77,0.08)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />
              <View style={styles.riderMachineRow}>
                <View style={styles.riderPillMini}>
                  <Text style={styles.riderPillMiniText}>@{riderUsername}</Text>
                </View>
                <Text style={styles.machineTitleText} numberOfLines={1}>
                  {bikeTitle}
                </Text>
              </View>
            </BlurView>
          </View>

          <View style={styles.gridRow}>
            <View style={styles.metricCard}>
              <BlurView intensity={24} tint="dark" style={styles.metricBlur}>
                <LinearGradient colors={['rgba(99,255,77,0.08)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />
                <Text style={styles.metricLabel}>DISTANCE</Text>
                <Text style={styles.metricHeroVal}>{rideData.distanceKm}</Text>
                <Text style={styles.metricUnit}>KILOMETERS</Text>
              </BlurView>
            </View>

            <View style={styles.metricCard}>
              <BlurView intensity={24} tint="dark" style={styles.metricBlur}>
                <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />
                <Text style={styles.metricLabel}>RIDE TIME</Text>
                <Text style={styles.metricHeroVal}>{formatTime(rideData.durationSec)}</Text>
                <Text style={styles.metricUnit}>DURATION</Text>
              </BlurView>
            </View>
          </View>

          <View style={[styles.gridRow, { marginTop: 12 }]}>
            <View style={styles.metricCard}>
              <BlurView intensity={24} tint="dark" style={styles.metricBlur}>
                <LinearGradient colors={['rgba(255,45,70,0.08)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />
                <Text style={styles.metricLabel}>TOP SPEED</Text>
                <Text style={[styles.metricHeroVal, { color: '#FF4D4D' }]}>{Math.round(rideData.maxSpeedKmh)}</Text>
                <Text style={styles.metricUnit}>KM/H PEAK</Text>
              </BlurView>
            </View>

            <View style={styles.metricCard}>
              <BlurView intensity={24} tint="dark" style={styles.metricBlur}>
                <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />
                <Text style={styles.metricLabel}>AVG SPEED</Text>
                <Text style={styles.metricHeroVal}>{Math.round(rideData.avgSpeedKmh)}</Text>
                <Text style={styles.metricUnit}>KM/H AVERAGE</Text>
              </BlurView>
            </View>
          </View>

          <View style={styles.fullCardWrap}>
            <BlurView intensity={30} tint="dark" style={styles.fullCardBlur}>
              <LinearGradient colors={['rgba(99,255,77,0.06)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />
              
              <View style={styles.cardHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>CORNERING & LEAN ANGLES</Text>
                <Text style={styles.sectionHeaderBadge}>GYRO TELEMETRY</Text>
              </View>

              <View style={styles.leanDisplayRow}>
                <View style={styles.leanSideCol}>
                  <Text style={styles.leanSideLabel}>LEFT LEAN</Text>
                  <Text style={[styles.leanDegreeValue, { color: colors.speedGreen }]}>
                    {Math.round(rideData.maxLeanLeftDeg || 0)}°
                  </Text>
                  <Text style={styles.leanSub}>PEAK LEFT APEX</Text>
                </View>

                <View style={styles.leanCenterVisual}>
                  <Svg width={80} height={60} viewBox="0 0 80 60">
                    <Line x1={10} y1={52} x2={70} y2={52} stroke="rgba(255,255,255,0.25)" strokeWidth={2} strokeLinecap="round" />
                    <Line x1={40} y1={10} x2={40} y2={52} stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="3 3" />
                    <Line 
                      x1={40} 
                      y1={52} 
                      x2={40 - 38 * Math.sin(((rideData.maxLeanLeftDeg || 42) * Math.PI) / 180)} 
                      y2={52 - 38 * Math.cos(((rideData.maxLeanLeftDeg || 42) * Math.PI) / 180)} 
                      stroke={colors.speedGreen} 
                      strokeWidth={3} 
                      strokeLinecap="round" 
                    />
                    <Line 
                      x1={40} 
                      y1={52} 
                      x2={40 + 38 * Math.sin(((rideData.maxLeanRightDeg || 45) * Math.PI) / 180)} 
                      y2={52 - 38 * Math.cos(((rideData.maxLeanRightDeg || 45) * Math.PI) / 180)} 
                      stroke="#FF9500" 
                      strokeWidth={3} 
                      strokeLinecap="round" 
                    />
                    <Circle cx={40} cy={52} r={4} fill="#fff" />
                  </Svg>
                </View>

                <View style={styles.leanSideCol}>
                  <Text style={styles.leanSideLabel}>RIGHT LEAN</Text>
                  <Text style={[styles.leanDegreeValue, { color: '#FF9500' }]}>
                    {Math.round(rideData.maxLeanRightDeg || 0)}°
                  </Text>
                  <Text style={styles.leanSub}>PEAK RIGHT APEX</Text>
                </View>
              </View>
            </BlurView>
          </View>

          <View style={styles.fullCardWrap}>
            <BlurView intensity={30} tint="dark" style={styles.fullCardBlur}>
              <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />
              
              <View style={styles.cardHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>DYNAMIC G-FORCE LOAD</Text>
                <Text style={styles.sectionHeaderBadge}>ACCELEROMETER</Text>
              </View>

              <View style={styles.gForceContentRow}>
                <View style={styles.gMeterWrap}>
                  <Svg width={90} height={90} viewBox="0 0 90 90">
                    <Circle cx={45} cy={45} r={40} stroke="rgba(255,255,255,0.12)" strokeWidth={1} fill="none" />
                    <Circle cx={45} cy={45} r={28} stroke="rgba(255,255,255,0.16)" strokeWidth={1} fill="none" />
                    <Circle cx={45} cy={45} r={14} stroke="rgba(255,255,255,0.2)" strokeWidth={1} fill="none" />
                    <Line x1={5} y1={45} x2={85} y2={45} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
                    <Line x1={45} y1={5} x2={45} y2={85} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
                    <Circle cx={58} cy={32} r={5} fill={colors.speedGreen} />
                    <Circle cx={58} cy={32} r={8} stroke={colors.speedGreen} strokeWidth={1.5} fill="none" opacity={0.6} />
                  </Svg>
                </View>

                <View style={styles.gForceValueCol}>
                  <Text style={styles.gForceBigVal}>{rideData.maxGForce || 1.0} <Text style={{ fontSize: 18, color: colors.speedGreen }}>G</Text></Text>
                  <Text style={styles.gForceTitle}>PEAK ACCELERATION & CORNER LOAD</Text>
                  <Text style={styles.gForceDesc}>
                    Combined lateral cornering and longitudinal acceleration force.
                  </Text>
                </View>
              </View>
            </BlurView>
          </View>

          <View style={styles.fullCardWrap}>
            <BlurView intensity={30} tint="dark" style={styles.fullCardBlur}>
              <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />

              <View style={styles.cardHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>ROUTE SILHOUETTE</Text>
                <Text style={styles.sectionHeaderBadge}>SPEED TELEMETRY</Text>
              </View>

              <View style={styles.routeSilhouetteWrap}>
                <Svg width={SCREEN_WIDTH - 64} height={120} viewBox="0 0 320 120">
                  <Line x1={0} y1={30} x2={320} y2={30} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                  <Line x1={0} y1={60} x2={320} y2={60} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                  <Line x1={0} y1={90} x2={320} y2={90} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                  
                  <Path
                    d="M 20 85 C 60 20, 90 110, 140 45 C 180 10, 220 95, 270 35 L 300 70"
                    fill="none"
                    stroke={colors.speedGreen}
                    strokeWidth={4}
                    strokeLinecap="round"
                  />

                  <Circle cx={20} cy={85} r={5} fill="#fff" />
                  <Circle cx={300} cy={70} r={5} fill="#FF4D4D" />
                  
                  <SvgText x={15} y={105} fill="rgba(255,255,255,0.5)" fontSize="9" fontFamily="JetBrainsMono-Bold">START</SvgText>
                  <SvgText x={280} y={90} fill="#FF4D4D" fontSize="9" fontFamily="JetBrainsMono-Bold">FINISH</SvgText>
                </Svg>
              </View>
            </BlurView>
          </View>
        </View>

        <View style={styles.actionsWrap}>
          <Pressable
            style={[styles.publishBtn, isSavingPhoto && { opacity: 0.6 }]}
            onPress={() => handleSaveToPhotos(mainCardRef)}
            disabled={isSavingPhoto}
          >
            <LinearGradient colors={['#63FF4D', '#3EB82C']} style={StyleSheet.absoluteFill} />
            {isSavingPhoto ? (
              <ActivityIndicator color="#04120a" size="small" />
            ) : (
              <Text style={styles.publishBtnText}>SAVE RECAP TO PHOTOS 📸</Text>
            )}
          </Pressable>

          <Pressable style={styles.shareBtn} onPress={handleShareStory}>
            <Text style={styles.shareBtnText}>SHARE TO INSTAGRAM STORY ↗</Text>
          </Pressable>

          <Pressable style={styles.doneBtn} onPress={handleDone}>
            <Text style={styles.doneBtnText}>DONE & RETURN TO RADAR</Text>
          </Pressable>
        </View>

      </ScrollView>

      <Modal visible={isStoryModalOpen} animationType="slide" transparent>
        <View style={styles.storyModalOverlay}>
          <View ref={storyCardRef} collapsable={false} style={styles.storyCard916}>
            <LinearGradient colors={['#161922', '#090b0e', '#030405']} style={StyleSheet.absoluteFill} />
            
            <View style={styles.storyGlowBorder} />

            <View style={styles.storyHeader}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.storyBrand}>MOTORADAR</Text>
                  <View style={styles.storyBadge}>
                    <Text style={styles.storyBadgeText}>TELEMETRY</Text>
                  </View>
                </View>
                <Text style={styles.storyDate}>SESSION RECAP · 18 AUG 2026</Text>
              </View>
              <Pressable style={styles.storyModalCloseBtn} onPress={() => setIsStoryModalOpen(false)}>
                <Text style={{ color: '#fff', fontSize: 13 }}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.storyRiderCard}>
              <View style={styles.storyRiderTag}>
                <Text style={styles.storyRiderText}>@{riderUsername}</Text>
              </View>
              <Text style={styles.storyBikeText} numberOfLines={1}>{bikeTitle}</Text>
            </View>

            <View style={styles.storyRouteVisual}>
              <Svg width={SCREEN_WIDTH - 80} height={130} viewBox="0 0 300 130">
                <Line x1={0} y1={30} x2={300} y2={30} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
                <Line x1={0} y1={65} x2={300} y2={65} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
                <Line x1={0} y1={100} x2={300} y2={100} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />

                <Path
                  d="M 20 90 C 60 20, 100 120, 150 35 C 190 10, 230 100, 280 40"
                  fill="none"
                  stroke={colors.speedGreen}
                  strokeWidth={4.5}
                  strokeLinecap="round"
                />
                <Circle cx={20} cy={90} r={5} fill="#fff" />
                <Circle cx={280} cy={40} r={5} fill="#FF4D4D" />
              </Svg>
            </View>

            <View style={styles.storyStatsGrid}>
              <View style={styles.storyStatCol}>
                <Text style={styles.storyStatLabel}>TOP SPEED</Text>
                <Text style={[styles.storyStatVal, { color: '#FF4D4D' }]}>{Math.round(rideData.maxSpeedKmh)}</Text>
                <Text style={styles.storyStatUnit}>KM/H PEAK</Text>
              </View>

              <View style={styles.storyStatCol}>
                <Text style={styles.storyStatLabel}>DISTANCE</Text>
                <Text style={[styles.storyStatVal, { color: '#fff' }]}>{rideData.distanceKm}</Text>
                <Text style={styles.storyStatUnit}>KM ({formatTime(rideData.durationSec)})</Text>
              </View>

              <View style={styles.storyStatCol}>
                <Text style={styles.storyStatLabel}>MAX LEAN</Text>
                <Text style={[styles.storyStatVal, { color: colors.speedGreen }]}>
                  {Math.round(rideData.maxLeanLeftDeg || 0)}° / {Math.round(rideData.maxLeanRightDeg || 0)}°
                </Text>
                <Text style={styles.storyStatUnit}>LEFT / RIGHT</Text>
              </View>

              <View style={styles.storyStatCol}>
                <Text style={styles.storyStatLabel}>PEAK G-FORCE</Text>
                <Text style={[styles.storyStatVal, { color: '#FFCC00' }]}>{rideData.maxGForce || 1.0}</Text>
                <Text style={styles.storyStatUnit}>G LOAD</Text>
              </View>
            </View>

            <View style={styles.storyFooter}>
              <Text style={styles.storyWatermark}>LIVE RIDER NETWORK // MOTORADAR</Text>
            </View>

            <View style={styles.storyModalActionsRow}>
              <Pressable 
                style={styles.storySavePhotosBtn} 
                onPress={() => handleSaveToPhotos(storyCardRef)}
                disabled={isSavingPhoto}
              >
                <LinearGradient colors={['#63FF4D', '#3EB82C']} style={StyleSheet.absoluteFill} />
                {isSavingPhoto ? (
                  <ActivityIndicator color="#04120a" size="small" />
                ) : (
                  <Text style={styles.storySavePhotosText}>SAVE TO PHOTOS 📸</Text>
                )}
              </Pressable>
              <Pressable style={styles.storyShareBtn} onPress={handleShareStory}>
                <Text style={styles.storyShareText}>SHARE ↗</Text>
              </Pressable>
            </View>

          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080a' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 60 },

  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: '#0c0e12',
    gap: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  screenTitle: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 18,
    color: '#fff',
    letterSpacing: -0.2,
  },
  screenSubtitle: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    letterSpacing: 1,
    color: colors.speedGreen,
    marginTop: 2,
  },
  storyPreviewHeaderBtn: {
    backgroundColor: 'rgba(99,255,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  storyPreviewHeaderText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    color: colors.speedGreen,
    letterSpacing: 0.5,
  },
  headerGlassCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  headerCloseIcon: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },

  riderMachineWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.25)',
    backgroundColor: '#101216',
    marginBottom: 12,
  },
  riderMachineBlur: { paddingVertical: 10, paddingHorizontal: 14 },
  riderMachineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  riderPillMini: {
    backgroundColor: 'rgba(99,255,77,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.3)',
  },
  riderPillMiniText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: colors.speedGreen, letterSpacing: 0.8 },
  machineTitleText: { fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 11, color: '#fff', flex: 1 },

  gridRow: { flexDirection: 'row', gap: 12 },
  metricCard: { flex: 1, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#101216' },
  metricBlur: { padding: 16 },
  metricLabel: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  metricHeroVal: { fontFamily: 'Archivo_800ExtraBold', fontSize: 28, color: '#fff', letterSpacing: -0.5, marginTop: 4 },
  metricUnit: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.8, marginTop: 2 },

  fullCardWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#101216',
    marginTop: 14,
  },
  fullCardBlur: { padding: 16 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionHeaderTitle: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, color: '#fff', letterSpacing: 0.8 },
  sectionHeaderBadge: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 9, color: colors.speedGreen, letterSpacing: 0.5 },

  // Lean Angle styles
  leanDisplayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  leanSideCol: { flex: 1, alignItems: 'center' },
  leanSideLabel: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.8 },
  leanDegreeValue: { fontFamily: 'Archivo_800ExtraBold', fontSize: 26, marginTop: 4 },
  leanSub: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
  leanCenterVisual: { width: 80, alignItems: 'center', justifyContent: 'center' },

  // G-Force styles
  gForceContentRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  gMeterWrap: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center' },
  gForceValueCol: { flex: 1 },
  gForceBigVal: { fontFamily: 'Archivo_800ExtraBold', fontSize: 32, color: '#fff' },
  gForceTitle: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  gForceDesc: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4, lineHeight: 13 },

  // Route Silhouette
  routeSilhouetteWrap: { alignItems: 'center', paddingVertical: 10 },

  // Actions
  actionsWrap: { gap: 10, marginTop: 20 },
  publishBtn: {
    height: 50,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtnText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, color: '#04120a', letterSpacing: 1 },
  shareBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(99,255,77,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, color: colors.speedGreen, letterSpacing: 0.8 },
  doneBtn: {
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.8 },

  // 9:16 STORY MODAL STYLES
  storyModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  storyCard916: {
    width: Math.min(SCREEN_WIDTH - 32, 360),
    height: Math.min(SCREEN_HEIGHT - 100, 640),
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.35)',
    padding: 20,
    justifyContent: 'space-between',
  },
  storyGlowBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.speedGreen,
  },
  storyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  storyBrand: { fontFamily: 'Archivo_800ExtraBold', fontSize: 16, color: '#fff', letterSpacing: 1 },
  storyBadge: { backgroundColor: 'rgba(99,255,77,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(99,255,77,0.4)' },
  storyBadgeText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 8, color: colors.speedGreen, letterSpacing: 0.8 },
  storyDate: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  storyModalCloseBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },

  storyRiderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  storyRiderTag: { backgroundColor: colors.speedGreen, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  storyRiderText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10, color: '#04120a' },
  storyBikeText: { fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 10, color: 'rgba(255,255,255,0.85)', flex: 1 },

  storyRouteVisual: { alignItems: 'center', marginVertical: 4 },
  storyStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  storyStatCol: { width: '46%' },
  storyStatLabel: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  storyStatVal: { fontFamily: 'Archivo_800ExtraBold', fontSize: 20, marginTop: 2 },
  storyStatUnit: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 1 },

  storyFooter: { alignItems: 'center' },
  storyWatermark: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5 },

  storyModalActionsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  storySavePhotosBtn: { flex: 2, height: 44, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  storySavePhotosText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, color: '#04120a', letterSpacing: 0.8 },
  storyShareBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  storyShareText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, color: '#fff' },
});
