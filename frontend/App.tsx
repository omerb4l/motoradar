import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_800ExtraBold,
} from '@expo-google-fonts/archivo';
import {
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { RootNavigator } from '@/navigation/RootNavigator';
import { AuthScreen } from '@/screens/Onboarding/AuthScreen';
import { useAuthStore } from '@/store/useAuthStore';
import { colors } from '@/theme/colors';

const navigationTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.void, card: colors.void },
};

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#08080A', padding: 24, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.sosRed} style={{ marginBottom: 16 }} />
          <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.hairline }}>
            <ActivityIndicator color={colors.speedGreen} style={{ marginBottom: 8 }} />
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_800ExtraBold,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });

  const isHydrating = useAuthStore((s) => s.isHydrating);
  const token = useAuthStore((s) => s.token);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (fontError) {
    console.warn('Font loading issue encountered:', fontError);
  }

  const isReady = (fontsLoaded || fontError) && !isHydrating;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          {!isReady ? (
            <View style={{ flex: 1, backgroundColor: colors.void, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.speedGreen} />
            </View>
          ) : token ? (
            <NavigationContainer theme={navigationTheme}>
              <RootNavigator />
            </NavigationContainer>
          ) : (
            <AuthScreen />
          )}
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
