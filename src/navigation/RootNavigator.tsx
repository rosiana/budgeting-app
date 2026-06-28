import { Ionicons } from '@expo/vector-icons';
import {
  BottomTabNavigationOptions,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import BalancesScreen from '../screens/BalancesScreen';
import BudgetsScreen from '../screens/BudgetsScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ScanReceiptScreen from '../screens/ScanReceiptScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import { colors } from '../theme';
import { RootStackParamList, TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'pie-chart',
  Transactions: 'list',
  Budgets: 'wallet',
  Saldo: 'cash',
};

function Tabs() {
  const insets = useSafeAreaInsets();
  // Add the bottom safe-area inset so the Android nav bar doesn't overlap.
  const tabBarBottom = Math.max(insets.bottom, 6);
  return (
    <Tab.Navigator
      screenOptions={({ route }): BottomTabNavigationOptions => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 60 + tabBarBottom,
          paddingBottom: tabBarBottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          fontFamily: 'Fredoka_600SemiBold',
        },
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={
              focused
                ? ICONS[route.name]
                : (`${String(ICONS[route.name])}-outline` as keyof typeof Ionicons.glyphMap)
            }
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Ringkasan' }} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'Transaksi' }} />
      <Tab.Screen name="Budgets" component={BudgetsScreen} options={{ title: 'Anggaran' }} />
      <Tab.Screen name="Saldo" component={BalancesScreen} options={{ title: 'Saldo' }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen
        name="ScanReceipt"
        component={ScanReceiptScreen}
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="AddTransaction"
        component={AddTransactionScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
