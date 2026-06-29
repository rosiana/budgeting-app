import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyRoundedFont, useAppFonts } from './src/fonts';
import RootNavigator from './src/navigation/RootNavigator';
import { BudgetProvider, useBudget } from './src/store/BudgetContext';
import { colors, DEVICE_PERSON } from './src/theme';
import { ensureNotificationsScheduled } from './src/utils/notifications';

applyRoundedFont();

function Gate({ children }: { children: React.ReactNode }) {
  const { ready } = useBudget();
  // Schedule local reminders once the app is hydrated.
  useEffect(() => {
    if (ready) ensureNotificationsScheduled(DEVICE_PERSON);
  }, [ready]);
  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  return <>{children}</>;
}

export default function App() {
  const fontsLoaded = useAppFonts();
  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BudgetProvider>
          <Gate>
            <NavigationContainer>
              <StatusBar style="dark" />
              <RootNavigator />
            </NavigationContainer>
          </Gate>
        </BudgetProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
