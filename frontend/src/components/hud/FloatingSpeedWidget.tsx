import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';

export type SpeedUnit = 'mph' | 'km/h';

interface Props {
  speed: number;
  unit: SpeedUnit;
  visible: boolean;
}

export function FloatingSpeedWidget({ speed, unit, visible }: Props) {
  const insets = useSafeAreaInsets();
  const containerStyle = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, { duration: 200 }),
    transform: [{ translateY: withTiming(visible ? 0 : -10, { duration: 200 }) }],
  }));

  return (
    <Animated.View
      style={[styles.wrap, { top: Math.max(insets.top + 8, 50) }, containerStyle]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <BlurView intensity={30} tint="dark" style={styles.blur}>
        <LinearGradient 
          colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.03)']} 
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.contentWrap}>
          <View style={styles.speedCol}>
            <Text style={styles.speedValue}>{Math.round(speed)}</Text>
            <View style={styles.unitCol}>
              <Text style={styles.unitLabel}>{unit.toUpperCase()}</Text>
              <View style={styles.gpsRow}>
                <View style={styles.gpsDot} />
                <Text style={styles.gpsLabel}>GPS LIVE</Text>
              </View>
            </View>
          </View>
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(10,12,16,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
    zIndex: 5,
  },
  blur: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  contentWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speedCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  speedValue: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.5,
    color: '#ffffff',
  },
  unitCol: {
    gap: 3,
    justifyContent: 'center',
  },
  unitLabel: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.speedGreen,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gpsDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.speedGreen,
  },
  gpsLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 9,
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.45)',
  },
});
