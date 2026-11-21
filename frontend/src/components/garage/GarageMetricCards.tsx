import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, Circle } from 'react-native-svg';
import { colors } from '@/theme/colors';
import { SpeedUnit } from '@/components/hud/FloatingSpeedWidget';

interface Props {
  topSpeed: number;
  topSpeedUnit: SpeedUnit;
  topSpeedContext: string;
  maxLeanDeg: number;
  maxLeanSide: 'LEFT' | 'RIGHT';
  maxLeanContext: string;
  onPress?: () => void;
}

export function GarageMetricCards({
  topSpeed,
  topSpeedUnit,
  topSpeedContext,
  maxLeanDeg,
  maxLeanSide,
  maxLeanContext,
  onPress,
}: Props) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.cardWrap}>
        <BlurView intensity={30} tint="dark" style={styles.cardBlur}>
          <LinearGradient colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />
          <Text style={styles.label}>TOP SPEED</Text>
          <Text style={styles.value}>{Math.round(topSpeed)}</Text>
          <Text style={styles.context}>{topSpeedUnit.toUpperCase()} · {topSpeedContext}</Text>
        </BlurView>
      </View>

      <View style={styles.cardWrap}>
        <BlurView intensity={30} tint="dark" style={styles.cardBlur}>
          <LinearGradient colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFill} />
          <View style={styles.leanHeader}>
            <Text style={styles.label}>MAX LEAN</Text>
            <LeanGlyph deg={maxLeanDeg} />
          </View>
          <Text style={styles.value}>{Math.round(maxLeanDeg)}°</Text>
          <Text style={styles.context}>{maxLeanSide} · {maxLeanContext}</Text>
        </BlurView>
      </View>
    </Pressable>
  );
}

function LeanGlyph({ deg }: { deg: number }) {
  const clamped = Math.max(0, Math.min(60, deg));
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      <Line x1={0} y1={20} x2={22} y2={20} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
      <Line
        x1={11}
        y1={20}
        x2={11 + 13 * Math.sin((clamped * Math.PI) / 180)}
        y2={20 - 13 * Math.cos((clamped * Math.PI) / 180)}
        stroke={colors.white}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle
        cx={11 + 13 * Math.sin((clamped * Math.PI) / 180)}
        cy={20 - 13 * Math.cos((clamped * Math.PI) / 180)}
        r={3.5}
        fill={colors.white}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  cardWrap: { flex: 1, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#111214' },
  cardBlur: { padding: 20 },
  label: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, letterSpacing: 1.54, color: 'rgba(255,255,255,0.45)' },
  value: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 32, letterSpacing: -1.6, color: '#fff', marginTop: 12, marginBottom: 2 },
  context: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, letterSpacing: 1.2, color: '#63FF4D' },
  leanHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -2 },
});
