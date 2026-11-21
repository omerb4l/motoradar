import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Line, Rect } from 'react-native-svg';
import { colors } from '@/theme/colors';

interface IconProps {
  active: boolean;
  size?: number;
}

/**
 * 1. RADAR ICON (Ultra-clean Modern Radar / Sonar Reticle)
 */
export function RadarIcon({ active, size = 24 }: IconProps) {
  const activeGreen = colors.speedGreen;
  const inactiveStroke = 'rgba(255, 255, 255, 0.7)';

  return (
    <View style={styles.iconContainer}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {active ? (
          <>
            {/* Outer Circular Boundary */}
            <Circle 
              cx="12" 
              cy="12" 
              r="9.5" 
              stroke="#FFFFFF" 
              strokeWidth="2" 
              fill="rgba(99, 255, 77, 0.08)"
            />
            {/* Inner Sonar Wave Ring */}
            <Circle 
              cx="12" 
              cy="12" 
              r="5.5" 
              stroke={activeGreen} 
              strokeWidth="1.8" 
            />
            {/* 45° Radar Sweep Arm */}
            <Line 
              x1="12" 
              y1="12" 
              x2="18.7" 
              y2="5.3" 
              stroke={activeGreen} 
              strokeWidth="2.2" 
              strokeLinecap="round" 
            />
            {/* Detected Target Ping */}
            <Circle cx="16" cy="8" r="1.5" fill={activeGreen} />
            {/* Center Beacon */}
            <Circle cx="12" cy="12" r="2.4" fill="#FFFFFF" />
          </>
        ) : (
          <>
            {/* Clean Minimalist Radar Outline */}
            <Circle 
              cx="12" 
              cy="12" 
              r="9.5" 
              stroke={inactiveStroke} 
              strokeWidth="1.8" 
            />
            <Circle 
              cx="12" 
              cy="12" 
              r="5.5" 
              stroke={inactiveStroke} 
              strokeWidth="1.4" 
            />
            <Line 
              x1="12" 
              y1="12" 
              x2="18.7" 
              y2="5.3" 
              stroke={inactiveStroke} 
              strokeWidth="1.8" 
              strokeLinecap="round" 
            />
            <Circle cx="12" cy="12" r="2" fill={inactiveStroke} />
          </>
        )}
      </Svg>
    </View>
  );
}

/**
 * 2. COMMS ICON (Modern Motorcycle Walkie-Talkie / Telsiz)
 */
export function CommsIcon({ active, size = 24 }: IconProps) {
  const activeGreen = colors.speedGreen;
  const inactiveStroke = 'rgba(255, 255, 255, 0.7)';

  return (
    <View style={styles.iconContainer}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {active ? (
          <>
            {/* Left Top Antenna with Green Active Light */}
            <Line x1="8" y1="2.5" x2="8" y2="7" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
            <Circle cx="8" cy="2.5" r="1.5" fill={activeGreen} />
            {/* Right Top Channel Knob */}
            <Line x1="15" y1="4.5" x2="15" y2="7" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" />
            
            {/* Walkie-Talkie Body (Solid White) */}
            <Rect x="5.5" y="7" width="13" height="14.5" rx="3.5" fill="#FFFFFF" />

            {/* LCD Screen Display on Radio */}
            <Rect x="8" y="9.5" width="8" height="3.2" rx="1" fill="#0c0e12" />
            <Line x1="9.5" y1="11.1" x2="14.5" y2="11.1" stroke={activeGreen} strokeWidth="1.2" strokeLinecap="round" />

            {/* Speaker Grille Slits */}
            <Line x1="9" y1="15" x2="15" y2="15" stroke="#0c0e12" strokeWidth="1.6" strokeLinecap="round" />
            <Line x1="9" y1="17.8" x2="15" y2="17.8" stroke="#0c0e12" strokeWidth="1.6" strokeLinecap="round" />
          </>
        ) : (
          <>
            {/* Inactive Outline Walkie-Talkie / Telsiz */}
            <Line x1="8" y1="2.5" x2="8" y2="7" stroke={inactiveStroke} strokeWidth="2" strokeLinecap="round" />
            <Line x1="15" y1="4.5" x2="15" y2="7" stroke={inactiveStroke} strokeWidth="2.5" strokeLinecap="round" />
            
            <Rect x="5.5" y="7" width="13" height="14.5" rx="3.5" stroke={inactiveStroke} strokeWidth="1.8" />
            
            <Rect x="8" y="9.5" width="8" height="3" rx="1" stroke={inactiveStroke} strokeWidth="1.2" />
            
            <Line x1="9" y1="15" x2="15" y2="15" stroke={inactiveStroke} strokeWidth="1.5" strokeLinecap="round" />
            <Line x1="9" y1="17.8" x2="15" y2="17.8" stroke={inactiveStroke} strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </Svg>
    </View>
  );
}

/**
 * 3. GARAGE ICON (Modern Garage Building & Roll-up Door)
 */
export function GarageIcon({ active, size = 24 }: IconProps) {
  const activeGreen = colors.speedGreen;
  const inactiveStroke = 'rgba(255, 255, 255, 0.7)';

  return (
    <View style={styles.iconContainer}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {active ? (
          <>
            {/* Garage Roof Gable */}
            <Path 
              d="M2.5 10.5 L12 2.5 L21.5 10.5" 
              stroke="#FFFFFF" 
              strokeWidth="2.4" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            {/* Garage Body (Solid White) */}
            <Path 
              d="M4.5 9.5 V21 H19.5 V9.5" 
              fill="#FFFFFF" 
            />
            {/* Garage Roll-up Door Cutout */}
            <Rect x="7.5" y="11" width="9" height="10" rx="1.5" fill="#0c0e12" />
            {/* Shutter Slats with Green Accent */}
            <Line x1="9" y1="13.8" x2="15" y2="13.8" stroke={activeGreen} strokeWidth="1.6" strokeLinecap="round" />
            <Line x1="9" y1="16.8" x2="15" y2="16.8" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
            <Line x1="9" y1="19.8" x2="15" y2="19.8" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
          </>
        ) : (
          <>
            {/* Inactive Garage Outline */}
            <Path 
              d="M2.5 10.5 L12 2.8 L21.5 10.5" 
              stroke={inactiveStroke} 
              strokeWidth="1.8" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            <Path 
              d="M4.5 9.5 V20.5 H19.5 V9.5" 
              stroke={inactiveStroke} 
              strokeWidth="1.8" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            <Rect x="7.5" y="11.5" width="9" height="9" rx="1" stroke={inactiveStroke} strokeWidth="1.4" />
            <Line x1="9" y1="14.5" x2="15" y2="14.5" stroke={inactiveStroke} strokeWidth="1.2" strokeLinecap="round" />
            <Line x1="9" y1="17.5" x2="15" y2="17.5" stroke={inactiveStroke} strokeWidth="1.2" strokeLinecap="round" />
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
