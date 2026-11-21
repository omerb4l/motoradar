import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { SettingsScreen } from '@/screens/Settings/SettingsScreen';
import { VerifyScreen } from '@/screens/Onboarding/VerifyScreen';
import { ChatScreen } from '@/screens/Chat/ChatScreen';
import { UserProfileScreen } from '@/screens/Profile/UserProfileScreen';
import { FuelLogScreen } from '@/screens/FuelLog/FuelLogScreen';
import { MotoAlbumScreen } from '@/screens/Album/MotoAlbumScreen';
import { MotorcycleHistoryScreen } from '@/screens/Garage/MotorcycleHistoryScreen';
import { MotoRemindersScreen } from '@/screens/Reminders/MotoRemindersScreen';
import { RideSummaryScreen } from '@/screens/Ride/RideSummaryScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Verify" component={VerifyScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="FuelLog" component={FuelLogScreen} />
      <Stack.Screen name="MotoAlbum" component={MotoAlbumScreen} />
      <Stack.Screen name="MotorcycleHistory" component={MotorcycleHistoryScreen} />
      <Stack.Screen name="MotoReminders" component={MotoRemindersScreen} />
      <Stack.Screen name="RideSummary" component={RideSummaryScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
