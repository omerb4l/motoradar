import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line } from 'react-native-svg';
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  FadeIn, 
  FadeOut 
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { useRidingStore } from '@/store/useRidingStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { colors } from '@/theme/colors';

export interface NavigationRouteInfo {
  isNavigating: boolean;
  partnerName?: string;
  etaText?: string | null;
  distanceKm?: number;
}

interface Props {
  visible: boolean;
  onExitRide?: () => void;
  navigationInfo?: NavigationRouteInfo;
}

export function RiderCockpitHUD({ visible, onExitRide, navigationInfo }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const speedUnit = useSettingsStore((s) => s.speedUnit);
  const speedMultiplier = speedUnit === 'km/h' ? 3.6 : 2.23694;

  const speedMps = useRidingStore((s) => s.speedMps);
  const headingDeg = useRidingStore((s) => s.headingDeg);
  const currentLeanDeg = useRidingStore((s) => s.currentLeanDeg);
  const currentGForce = useRidingStore((s) => s.currentGForce);
  const sessionMaxGForce = useRidingStore((s) => s.sessionMaxGForce);
  const sessionStartTime = useRidingStore((s) => s.sessionStartTime);
  const sessionTopSpeedKmh = useRidingStore((s) => s.sessionTopSpeedKmh);
  const sessionMaxLeanDeg = useRidingStore((s) => s.sessionMaxLeanDeg);
  const endRide = useRidingStore((s) => s.endRide);

  // If navigating to a partner, default to split/map mode so the route is clearly visible
  const isNavigating = !!navigationInfo?.isNavigating;
  const [hudMode, setHudMode] = useState<'MAP_SPLIT' | 'FULL_COCKPIT'>('FULL_COCKPIT');

  useEffect(() => {
    if (isNavigating) {
      setHudMode('MAP_SPLIT');
    }
  }, [isNavigating]);

  const displaySpeed = Math.round(speedMps * speedMultiplier);
  const displayTopSpeed = Math.round(sessionTopSpeedKmh * (speedUnit === 'km/h' ? 1 : 0.621371));

  // Ride Timer
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!visible || !sessionStartTime) {
      setElapsedSec(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, sessionStartTime]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const h = Math.floor(m / 60);
    if (h > 0) {
      return `${h}:${(m % 60).toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getHeadingCompass = (deg: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 45) % 8;
    return `${directions[index]} ${Math.round(deg)}°`;
  };

  const containerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(visible ? 1 : 0, { duration: 300 }),
    };
  }, [visible]);

  const handleEndRide = () => {
    const summary = endRide();
    onExitRide?.();
    if (summary) {
      navigation.navigate('RideSummary', { summaryData: summary });
    }
  };

  if (!visible) return null;

  const speedPercentage = Math.min(100, Math.max(0, (displaySpeed / (speedUnit === 'km/h' ? 180 : 110)) * 100));

  // ==========================================
  // 1. MAP + NAVIGATION SPLIT COCKPIT MODE
  // ==========================================
  if (hudMode === 'MAP_SPLIT') {
    return (
      <Animated.View 
        entering={FadeIn.duration(300)} 
        exiting={FadeOut.duration(200)} 
        style={[styles.container, containerAnimatedStyle]}
        pointerEvents="box-none"
      >
        {/* TOP FLOATING NAVIGATION BANNER (Over the live map) */}
        <View style={[styles.navTopBannerWrap, { top: Math.max(insets.top + 8, 48) }]}>
          <BlurView intensity={45} tint="dark" style={styles.navTopBannerBlur}>
            <LinearGradient colors={['rgba(99,255,77,0.18)', 'rgba(99,255,77,0.04)']} style={StyleSheet.absoluteFill} />
            <View style={styles.navTopRow}>
              <View style={styles.navTargetInfo}>
                <View style={styles.navStatusDot} />
                <Text style={styles.navTargetTitle}>
                  {navigationInfo?.partnerName ? `ROUTING TO ${navigationInfo.partnerName.toUpperCase()}` : 'ACTIVE NAVIGATION'}
                </Text>
              </View>
              {navigationInfo?.etaText && (
                <View style={styles.navEtaBadge}>
                  <Text style={styles.navEtaText}>ETA {navigationInfo.etaText}</Text>
                </View>
              )}
            </View>

            {/* Quick Switch to Full Cockpit */}
            <Pressable 
              style={styles.modeTogglePill} 
              onPress={() => setHudMode('FULL_COCKPIT')}
              hitSlop={8}
            >
              <Text style={styles.modeToggleText}>SWITCH TO FULL COCKPIT ↗</Text>
            </Pressable>
          </BlurView>
        </View>

        {/* BOTTOM DOCKED COCKPIT CARD */}
        <View style={[styles.navBottomDockWrap, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
          <BlurView intensity={55} tint="dark" style={styles.navBottomDockBlur}>
            <LinearGradient 
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.02)']} 
              style={StyleSheet.absoluteFill} 
            />

            {/* Tachometer line */}
            <View style={styles.miniTachoTrack}>
              <View style={[styles.miniTachoFill, { width: `${speedPercentage}%` }]} />
            </View>

            <View style={styles.navDockContent}>
              {/* Giant Digital Speed */}
              <View style={styles.navDockSpeedRow}>
                <Text style={styles.navDockSpeedValue}>{displaySpeed}</Text>
                <View style={styles.navDockSpeedUnitCol}>
                  <Text style={styles.navDockSpeedUnitText}>{speedUnit.toUpperCase()}</Text>
                  <Text style={styles.navDockHeadingText}>{getHeadingCompass(headingDeg)}</Text>
                </View>
              </View>

              {/* Live Lean Angle */}
              <View style={styles.navDockLeanCol}>
                <Text style={styles.navDockLabel}>LEAN</Text>
                <View style={styles.leanRow}>
                  <LeanVisualizer deg={currentLeanDeg} />
                  <Text style={styles.navDockLeanVal}>{Math.abs(Math.round(currentLeanDeg))}°</Text>
                </View>
              </View>

              {/* Live G-Force */}
              <View style={styles.navDockLeanCol}>
                <Text style={styles.navDockLabel}>G-LOAD</Text>
                <Text style={[styles.navDockLeanVal, { color: colors.speedGreen }]}>{currentGForce.toFixed(2)}G</Text>
              </View>

              {/* Session Timer & Exit */}
              <View style={styles.navDockTimerCol}>
                <Text style={styles.navDockLabel}>TIME</Text>
                <Text style={styles.navDockTimerVal}>{formatTimer(elapsedSec)}</Text>
                <Pressable 
                  style={styles.miniExitBtn} 
                  onPress={handleEndRide}
                >
                  <Text style={styles.miniExitText}>END</Text>
                </Pressable>
              </View>
            </View>
          </BlurView>
        </View>
      </Animated.View>
    );
  }

  // ==========================================
  // 2. FULL SCREEN TELEMETRY COCKPIT MODE
  // ==========================================
  return (
    <Animated.View 
      entering={FadeIn.duration(350)} 
      exiting={FadeOut.duration(250)} 
      style={[styles.container, containerAnimatedStyle]}
      pointerEvents="box-none"
    >
      <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill}>
        <LinearGradient 
          colors={['rgba(7,9,11,0.85)', 'rgba(7,9,11,0.92)']} 
          style={StyleSheet.absoluteFill} 
        />

        {/* TOP STATUS BAR */}
        <View style={[styles.topHeader, { paddingTop: Math.max(insets.top + 8, 48) }]}>
          <View style={styles.pillBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.pillText}>RIDING LIVE</Text>
          </View>

          <View style={styles.pillBadge}>
            <Text style={styles.compassText}>{getHeadingCompass(headingDeg)}</Text>
          </View>

          {/* Quick Toggle to Map / Navigation Mode */}
          <Pressable 
            style={[styles.pillBadge, { backgroundColor: 'rgba(99,255,77,0.15)', borderColor: 'rgba(99,255,77,0.4)' }]} 
            onPress={() => setHudMode('MAP_SPLIT')}
            hitSlop={8}
          >
            <Text style={[styles.pillText, { color: colors.speedGreen }]}>VIEW MAP ↗</Text>
          </Pressable>
        </View>

        {/* Navigation Alert Banner inside Full Cockpit if routing */}
        {isNavigating && (
          <Pressable 
            style={styles.fullCockpitNavBanner} 
            onPress={() => setHudMode('MAP_SPLIT')}
          >
            <Text style={styles.fullCockpitNavText}>
              Active route to {navigationInfo?.partnerName || 'Rider'} · ETA {navigationInfo?.etaText || '--'} (Tap to see map)
            </Text>
          </Pressable>
        )}

        {/* CENTER SPEED HERO */}
        <View style={styles.centerHero}>
          {/* Dynamic Tachometer */}
          <View style={styles.tachoWrap}>
            <View style={styles.tachoTrack}>
              <View style={[styles.tachoFill, { width: `${speedPercentage}%` }]} />
            </View>
            <View style={styles.tachoTicks}>
              {[0, 20, 40, 60, 80, 100].map((tick) => (
                <View key={tick} style={styles.tickMark} />
              ))}
            </View>
          </View>

          {/* Huge Speed Digital Readout */}
          <View style={styles.speedDisplayRow}>
            <Text style={styles.speedLargeText}>{displaySpeed}</Text>
            <View style={styles.speedUnitCol}>
              <Text style={styles.speedUnitText}>{speedUnit.toUpperCase()}</Text>
              <Text style={styles.speedContextText}>GPS TELEMETRY</Text>
            </View>
          </View>
        </View>

        {/* TELEMETRY METRIC TILES (4 TILES) */}
        <View style={styles.telemetryGrid}>
          {/* Tile 1: Lean Angle */}
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>LEAN ANGLE</Text>
            <View style={styles.leanRow}>
              <LeanVisualizer deg={currentLeanDeg} />
              <Text style={styles.tileValue}>
                {Math.abs(Math.round(currentLeanDeg))}°
              </Text>
            </View>
            <Text style={styles.tileSub}>PEAK: {Math.round(sessionMaxLeanDeg)}°</Text>
          </View>

          {/* Tile 2: Live G-Force */}
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>G-FORCE LOAD</Text>
            <Text style={[styles.tileValue, { color: colors.speedGreen }]}>
              {currentGForce.toFixed(2)} G
            </Text>
            <Text style={styles.tileSub}>PEAK: {sessionMaxGForce.toFixed(2)} G</Text>
          </View>

          {/* Tile 3: Top Speed */}
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>TOP SPEED</Text>
            <Text style={styles.tileValue}>{displayTopSpeed}</Text>
            <Text style={styles.tileSub}>{speedUnit.toUpperCase()} RECORD</Text>
          </View>

          {/* Tile 4: Session Duration */}
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>RIDE TIME</Text>
            <Text style={styles.tileValue}>{formatTimer(elapsedSec)}</Text>
            <Text style={styles.tileSub}>ACTIVE CRUISE</Text>
          </View>
        </View>

        {/* BOTTOM ACTION BAR */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom + 12, 28) }]}>
          <Pressable 
            style={styles.exitBtn} 
            onPress={handleEndRide}
          >
            <LinearGradient 
              colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)']} 
              style={StyleSheet.absoluteFill} 
            />
            <Text style={styles.exitBtnText}>END RIDE SESSION</Text>
          </Pressable>
        </View>

      </BlurView>
    </Animated.View>
  );
}

function LeanVisualizer({ deg }: { deg: number }) {
  const clamped = Math.max(-55, Math.min(55, deg));
  
  return (
    <View style={styles.leanVisualizerWrap}>
      <Svg width={28} height={28} viewBox="0 0 28 28">
        <Line x1={4} y1={24} x2={24} y2={24} stroke="rgba(255,255,255,0.2)" strokeWidth={2} strokeLinecap="round" />
        <Line 
          x1={14} 
          y1={24} 
          x2={14 + 14 * Math.sin((clamped * Math.PI) / 180)} 
          y2={24 - 14 * Math.cos((clamped * Math.PI) / 180)} 
          stroke={Math.abs(clamped) > 35 ? colors.speedGreen : '#fff'} 
          strokeWidth={2.5} 
          strokeLinecap="round" 
        />
        <Circle 
          cx={14 + 14 * Math.sin((clamped * Math.PI) / 180)} 
          cy={24 - 14 * Math.cos((clamped * Math.PI) / 180)} 
          r={3} 
          fill={colors.speedGreen} 
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },

  // 1. SPLIT NAVIGATION HUD STYLES
  navTopBannerWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    zIndex: 25,
  },
  navTopBannerBlur: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  navTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navTargetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.speedGreen,
  },
  navTargetTitle: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 12,
    color: '#fff',
    letterSpacing: 1,
  },
  navEtaBadge: {
    backgroundColor: colors.speedGreen,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  navEtaText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 11,
    color: '#04120a',
  },
  modeTogglePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modeToggleText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },

  navBottomDockWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(10,12,16,0.92)',
    zIndex: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
  },
  navBottomDockBlur: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  miniTachoTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  miniTachoFill: {
    height: '100%',
    backgroundColor: colors.speedGreen,
    borderRadius: 2,
  },
  navDockContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navDockSpeedRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  navDockSpeedValue: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 54,
    lineHeight: 56,
    letterSpacing: -2.5,
    color: '#ffffff',
    textShadowColor: 'rgba(99,255,77,0.3)',
    textShadowRadius: 16,
  },
  navDockSpeedUnitCol: {
    gap: 2,
  },
  navDockSpeedUnitText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 13,
    color: colors.speedGreen,
  },
  navDockHeadingText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
  navDockLeanCol: {
    alignItems: 'center',
    gap: 2,
  },
  navDockLabel: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.4)',
  },
  navDockLeanVal: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 18,
    color: '#fff',
  },
  navDockTimerCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  navDockTimerVal: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 13,
    color: '#fff',
  },
  miniExitBtn: {
    backgroundColor: 'rgba(255,45,70,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,45,70,0.4)',
  },
  miniExitText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    color: '#FF6070',
  },

  // 2. FULL COCKPIT STYLES
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.speedGreen,
  },
  pillText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    color: colors.speedGreen,
  },
  compassText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.8,
  },

  fullCockpitNavBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(99,255,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99,255,77,0.3)',
    alignItems: 'center',
  },
  fullCockpitNavText: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 11,
    color: colors.speedGreen,
  },

  centerHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  tachoWrap: {
    width: '100%',
    marginBottom: 10,
  },
  tachoTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  tachoFill: {
    height: '100%',
    backgroundColor: colors.speedGreen,
    borderRadius: 3,
  },
  tachoTicks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 2,
  },
  tickMark: {
    width: 2,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  speedDisplayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  speedLargeText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 130,
    lineHeight: 136,
    letterSpacing: -7,
    color: '#ffffff',
    textShadowColor: 'rgba(99,255,77,0.4)',
    textShadowRadius: 32,
  },
  speedUnitCol: {
    gap: 4,
  },
  speedUnitText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 20,
    letterSpacing: 2,
    color: colors.speedGreen,
  },
  speedContextText: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.4)',
  },

  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  tile: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  tileLabel: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 6,
  },
  tileValue: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 24,
    color: '#ffffff',
    marginVertical: 2,
  },
  tileSub: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    color: colors.speedGreen,
    letterSpacing: 0.8,
  },
  leanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leanVisualizerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomBar: {
    paddingHorizontal: 18,
  },
  exitBtn: {
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitBtnText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 12,
    letterSpacing: 1.5,
    color: '#ffffff',
  },
});
