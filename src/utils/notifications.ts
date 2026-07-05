import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { RecurringTx } from '../types';
import { isUnpaidThisPeriod, nextActivePeriodDate } from './recurring';

/**
 * Recurring local-notification setup for MoMoney:
 * - 20:00 every day on both phones: "Beli apa aja hari ini? 🤔"
 * - 09:00 on the 26th, only on Rizal's Android: "Sudahkah kamu transfer Rosi? 🥹"
 *
 * Idempotent: we re-schedule from scratch each app launch so changes to the
 * times/copy here actually take effect.
 */

const DAILY_ID = 'momoney-daily-2000';
const MONTHLY_RIZAL_ID = 'momoney-rizal-26-0900';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationsScheduled(
  person: 'rosi' | 'rizal',
  recurring: RecurringTx[] = []
): Promise<void> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted;
    if (!granted && settings.canAskAgain) {
      const res = await Notifications.requestPermissionsAsync();
      granted = res.granted;
    }
    if (!granted) return;

    // Cancel anything previously scheduled by us so we don't pile up duplicates.
    await Notifications.cancelAllScheduledNotificationsAsync();

    // 20:00 daily — both phones.
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_ID,
      content: { title: 'MoMoney 🐒', body: 'Beli apa aja hari ini? 🤔' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 20,
        minute: 0,
        repeats: true,
      } as any,
    });

    // 09:00 on the 26th — only on Rizal's device.
    if (person === 'rizal') {
      await Notifications.scheduleNotificationAsync({
        identifier: MONTHLY_RIZAL_ID,
        content: {
          title: 'MoMoney 🐒',
          body: 'Sudahkah kamu transfer Rosi? 🥹',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          day: 26,
          hour: 9,
          minute: 0,
          repeats: true,
        } as any,
      });
    }

    // 09:00 on the LAST day of each month — both phones. expo-notifications
    // can't natively express "last day of month", so we schedule one-shot
    // reminders for this month and next month at app launch; the next launch
    // re-fills the queue.
    const now = new Date();
    for (let offset = 0; offset <= 1; offset++) {
      const m = now.getMonth() + offset;
      const ref = new Date(now.getFullYear(), m + 1, 0, 9, 0, 0); // last day, 09:00
      if (ref.getTime() <= now.getTime()) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `momoney-eom-${ref.getFullYear()}-${ref.getMonth() + 1}`,
        content: {
          title: 'MoMoney 🐒',
          body: 'Sudah investasi bulan ini belum? 🤔',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: ref,
        } as any,
      });
    }

    // Transaksi Rutin — one-shot notification per enabled rec tx at 09:00
    // on the next due date. Only if the PIC (rec.who) matches this device.
    // Rescheduled on every app launch (and every state change via the effect
    // in BudgetProvider), so paying one drops its next firing correctly.
    // iOS caps scheduled notifications at 64, so we intentionally schedule
    // only the SINGLE NEXT firing per rec tx — leaves headroom for the
    // built-in daily / month-end / Rizal-26 reminders.
    for (const r of recurring) {
      if (!r.enabled || r.deleted) continue;
      if (r.who !== 'rumah' && r.who !== person) continue;
      // Skip if it's already been paid for this period.
      if (!isUnpaidThisPeriod(r)) continue;
      const target = nextActivePeriodDate(r);
      // If today past 09:00 on the due day AND still unpaid, fire in 1 min
      // so the user gets a nudge instead of waiting a full period.
      const now = new Date();
      const trigger = target.getTime() > now.getTime()
        ? target
        : new Date(now.getTime() + 60 * 1000);
      await Notifications.scheduleNotificationAsync({
        identifier: `momoney-rec-${r.id}`,
        content: {
          title: `Transaksi Rutin: ${r.name}`,
          body: r.amount
            ? `Rp ${r.amount.toLocaleString('id-ID')} · tap untuk bayar sekarang`
            : 'Tap untuk bayar sekarang',
          data: { kind: 'recurring', recurringId: r.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: trigger,
        } as any,
      });
    }

    // Android needs a channel so non-default-importance notifications appear.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'MoMoney',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#B07D56',
      });
    }
  } catch (e) {
    // Best-effort — notifications shouldn't crash the app.
    console.warn('Notifications setup failed', e);
  }
}
