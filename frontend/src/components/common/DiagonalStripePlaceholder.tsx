import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

interface Props {
  height: number;
  label?: string;
  style?: ViewStyle;
}

/**
 * The "no photo yet" diagonal-stripe fill used across the design wherever a
 * real photo isn't available (Welcome hero, Garage header, Verify preview).
 * Ports the source CSS: repeating-linear-gradient(112deg,#131317 0 9px,#1b1b21 9px 18px)
 */
export function DiagonalStripePlaceholder({ height, label, style }: Props) {
  return (
    <View style={[{ height, backgroundColor: '#131317', overflow: 'hidden' }, style]}>
      <Svg width="100%" height="100%">
        <Rect x={0} y={0} width="100%" height="100%" fill="#131317" />
        <Rect x={0} y={0} width="100%" height="100%" fill="#1b1b21" opacity={0.5} />
      </Svg>
      {label && (
        <View style={styles.labelWrap} pointerEvents="none">
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labelWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  label: {
    fontSize: 11,
    lineHeight: 18,
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.28)',
    textAlign: 'center',
  },
});
