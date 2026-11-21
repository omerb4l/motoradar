import React, { useEffect } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { 
  Easing, 
  useAnimatedStyle, 
  useSharedValue, 
  withRepeat, 
  withSequence, 
  withSpring, 
  withTiming 
} from 'react-native-reanimated';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors } from '@/theme/colors';
import { RadarIcon, CommsIcon, GarageIcon } from './TabIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TAB_BAR_WIDTH = Math.min(SCREEN_WIDTH - 40, 310);
const TAB_BAR_HEIGHT = 56;
const TAB_COUNT = 3;
const TAB_ITEM_WIDTH = TAB_BAR_WIDTH / TAB_COUNT;

const ROUTE_ICONS: Record<string, React.ComponentType<{ active: boolean; size?: number }>> = {
  Radar: RadarIcon,
  Comms: CommsIcon,
  Garage: GarageIcon,
};

interface Props extends BottomTabBarProps {
  visible?: boolean;
  hasUnreadComms?: boolean;
}

export function BottomTabBar({ state, navigation, visible = true, hasUnreadComms = false }: Props) {
  const pulseAnim = useSharedValue(0.4);

  // Unread badge breathing pulse
  useEffect(() => {
    if (hasUnreadComms) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulseAnim.value = withTiming(0, { duration: 200 });
    }
  }, [hasUnreadComms]);

  const dotAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pulseAnim.value,
  }));

  // Liquid lens droplet sliding indicator
  const indicatorPosition = useSharedValue(state.index * TAB_ITEM_WIDTH);
  const indicatorScale = useSharedValue(1);

  useEffect(() => {
    indicatorPosition.value = withSpring(state.index * TAB_ITEM_WIDTH, {
      damping: 16,
      stiffness: 140,
      mass: 0.8,
    });
  }, [state.index]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: indicatorPosition.value },
      { scale: indicatorScale.value }
    ]
  }));

  return (
    <View 
      style={[styles.floatingWrap, !visible && styles.hidden]} 
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* 1. Base Frosted Glass Blur */}
      <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill}>
        
        {/* 2. Sleek Uniform Frosted Glass Dark Tint (No Overly Bright Glare) */}
        <LinearGradient 
          colors={['rgba(28, 34, 42, 0.72)', 'rgba(10, 13, 18, 0.88)']} 
          style={StyleSheet.absoluteFill} 
        />

        {/* 3. Tab Items & Sliding Active Liquid Droplet */}
        <View style={styles.tabContainer}>
          {/* Animated Liquid Droplet Lens with Subtle Speed Green Accent */}
          <Animated.View style={[styles.activeIndicatorWrap, indicatorStyle]}>
            <View style={styles.activeDropletPill}>
              <LinearGradient 
                colors={['rgba(99, 255, 77, 0.18)', 'rgba(99, 255, 77, 0.05)']} 
                style={StyleSheet.absoluteFill} 
              />
              <View style={styles.activeDropletBorder} />
            </View>
          </Animated.View>

          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const Icon = ROUTE_ICONS[route.name] ?? RadarIcon;

            const handlePressIn = () => {
              indicatorScale.value = withSpring(0.92, { damping: 12, stiffness: 220 });
            };

            const handlePressOut = () => {
              indicatorScale.value = withSpring(1, { damping: 12, stiffness: 220 });
            };

            const handlePress = () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              navigation.navigate(route.name);
            };

            return (
              <Pressable
                key={route.key}
                style={styles.tabItem}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handlePress}
                hitSlop={10}
              >
                <View style={styles.iconWrapper}>
                  <Icon active={focused} size={23} />
                  
                  {/* Comms Notification Red Dot */}
                  {route.name === 'Comms' && hasUnreadComms && (
                    <Animated.View style={[styles.unreadBadge, dotAnimatedStyle]} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingWrap: {
    position: 'absolute',
    alignSelf: 'center',
    width: TAB_BAR_WIDTH,
    bottom: 24,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(10, 13, 18, 0.45)',
    // Ultra-soft ambient glass drop shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.48,
    shadowRadius: 22,
    elevation: 20,
    zIndex: 100,
  },
  hidden: {
    opacity: 0,
    pointerEvents: 'none',
  },
  tabContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  // Sliding liquid lens droplet
  activeIndicatorWrap: {
    position: 'absolute',
    width: TAB_ITEM_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDropletPill: {
    width: 62,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(99, 255, 77, 0.06)',
  },
  activeDropletBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 255, 77, 0.32)',
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // Red notification dot on Direct Message / Comms icon
  unreadBadge: {
    position: 'absolute',
    bottom: -1,
    right: -4,
    width: 6.5,
    height: 6.5,
    borderRadius: 3.25,
    backgroundColor: '#FF3B30',
    borderWidth: 1,
    borderColor: '#0a0d12',
  },
});
