import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { RadarScreen } from '@/screens/Radar/RadarScreen';
import { CommsScreen } from '@/screens/Comms/CommsScreen';
import { GarageScreen } from '@/screens/Garage/GarageScreen';
import { useRidingStore } from '@/store/useRidingStore';
import { useRendezvousStore } from '@/store/useRendezvousStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  const isRiding = useRidingStore((s) => s.isRiding);
  const requests = useRendezvousStore((s) => s.requests);
  const chats = useChatStore((s) => s.chats);
  const user = useAuthStore((s) => s.user);

  const hasUnreadComms = requests.some(r => r.recipientId === user?.id && r.status === 'PENDING') ||
                         chats.some(c => (c.unread_count ?? 0) > 0);

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBar {...props} visible={!isRiding} hasUnreadComms={hasUnreadComms} />}
    >
      <Tab.Screen name="Radar" component={RadarScreen} />
      <Tab.Screen name="Comms" component={CommsScreen} />
      <Tab.Screen name="Garage" component={GarageScreen} />
    </Tab.Navigator>
  );
}
