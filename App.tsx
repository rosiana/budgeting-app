import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { applyRoundedFont, useAppFonts } from './src/fonts';
import RootNavigator from './src/navigation/RootNavigator';
import { RootStackParamList } from './src/navigation/types';
import { BudgetProvider, useBudget } from './src/store/BudgetContext';
import { colors, DEVICE_PERSON } from './src/theme';
import { ensureNotificationsScheduled } from './src/utils/notifications';

applyRoundedFont();

/** Route a tapped notification's data payload into the app's navigation. */
function handleNotificationTap(
  data: any,
  navRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>,
  findRecurring: (id: string) => any
) {
  if (!data || data.kind !== 'recurring' || !data.recurringId) return;
  const r = findRecurring(data.recurringId);
  if (!r) return;
  navRef.current?.navigate('AddTransaction', {
    draft: {
      type: r.txType,
      merchant: r.name,
      amount: r.amount,
      category: r.category,
      incomeCategory: r.incomeCategory,
      who: r.who,
      source: r.source,
      creditCard: r.creditCard,
      reimbursable: r.reimbursable,
      recurringId: r.id,
    },
  });
}

function Gate({
  navRef,
  children,
}: {
  navRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
  children: React.ReactNode;
}) {
  const { ready, recurring } = useBudget();
  const recurringRef = useRef(recurring);
  recurringRef.current = recurring;

  // Schedule local reminders once the app is hydrated. Re-runs when the
  // recurring list changes so paying or editing a rec tx re-plans the queue.
  useEffect(() => {
    if (ready) ensureNotificationsScheduled(DEVICE_PERSON, recurring);
  }, [ready, recurring]);

  // Deep-link: tapping a Transaksi Rutin notification opens Add Transaction
  // pre-filled with the reminder's fields. Handles both foreground taps and
  // cold-start (getLastNotificationResponseAsync).
  useEffect(() => {
    if (!ready) return;
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      handleNotificationTap(res.notification.request.content.data, navRef, (id) =>
        recurringRef.current.find((r) => r.id === id)
      );
    });
    (async () => {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last) {
        handleNotificationTap(last.notification.request.content.data, navRef, (id) =>
          recurringRef.current.find((r) => r.id === id)
        );
      }
    })();
    return () => sub.remove();
  }, [ready, navRef]);

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
  const navRef = useRef<NavigationContainerRef<RootStackParamList> | null>(null);
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
          <Gate navRef={navRef}>
            <NavigationContainer ref={navRef}>
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
