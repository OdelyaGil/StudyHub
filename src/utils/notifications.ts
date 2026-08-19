import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { toISO, occursOnISO } from './helpers';

// ── Setup handler (must be at module level) ───────────────────────────────────
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (_) {}

// ── Permission ────────────────────────────────────────────────────────────────
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    if (!Device.isDevice) return false;
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return false;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('studyhub', {
        name: 'StudyHub Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#CBD8E8',
      });
    }
    return true;
  } catch (_) { return false; }
};

// ── Timer notification ────────────────────────────────────────────────────────
export const scheduleTimerNotification = async (seconds: number): Promise<string | null> => {
  try {
    const permitted = await requestNotificationPermission();
    if (!permitted) return null;
    const fireAt = new Date(Date.now() + seconds * 1000);
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: '⏰ טיימר הלימוד הסתיים!', body: 'כל הכבוד! סיימת את פגישת הלימוד שלך.', sound: true, data: { type: 'timer' } },
      trigger: { date: fireAt } as any,
    });
    return id;
  } catch (_) { return null; }
};

export const cancelTimerNotification = async (id: string): Promise<void> => {
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch (_) {}
};

const scheduleAt = async (date: Date, title: string, body: string) => {
  try {
    if (date <= new Date()) return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { date } as any,
    });
  } catch (_) {}
};

// ── Main scheduler ────────────────────────────────────────────────────────────
export const scheduleAllNotifications = async (tasks: any[], events: any[]) => {
  try {
    const permitted = await requestNotificationPermission();
    if (!permitted) return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter(n => (n.content.data as Record<string, unknown>)?.type !== 'timer')
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );

    const now   = new Date();
    const today = toISO(now);

    // ── Task notifications ──────────────────────────────────────────────────
    for (const task of tasks) {
      if (task.completed || !task.dueDate) continue;
      const dueDate     = new Date(task.dueDate + 'T23:59:00');
      const label       = task.course ? `${task.name} (${task.course})` : task.name;
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);

      if (daysUntilDue === 7) {
        const t = new Date(dueDate); t.setHours(9, 0, 0, 0);
        await scheduleAt(t, '📚 שבוע עד הגשה', `${label} — עוד 7 ימים`);
      }
      if (daysUntilDue <= 3 && daysUntilDue > 1) {
        const t = new Date(now); t.setDate(t.getDate() + 1); t.setHours(9, 0, 0, 0);
        await scheduleAt(t, '⚠️ קרוב להגשה', `${label} — עוד ${daysUntilDue} ימים`);
      }
      await scheduleAt(new Date(dueDate.getTime() - 24 * 3600000), '🚨 מחר אחרון להגשה!', label);
      if (task.dueDate === today) {
        await scheduleAt(new Date(dueDate.getTime() - 3600000), '🔴 שעה אחרונה!', label);
      }
    }

    // ── Event notifications ─────────────────────────────────────────────────
    // reminderMinutes is per-event (set in the event editor): a number of
    // minutes before startTime, 0 for "at start time", or null for "off".
    // undefined (events saved before this field existed) falls back to the
    // old 30-minutes-before default until the user edits and picks explicitly.
    for (let i = 0; i < 7; i++) {
      const d   = new Date(now); d.setDate(d.getDate() + i);
      const iso = toISO(d);
      for (const ev of events.filter(e => occursOnISO(e, iso))) {
        if (!ev.startTime) continue;
        const reminderMinutes = ev.reminderMinutes === undefined ? 30 : ev.reminderMinutes;
        if (reminderMinutes === null) continue;
        const [h, m] = ev.startTime.split(':').map(Number);
        const start  = new Date(d); start.setHours(h, m, 0, 0);
        const timeRange = ev.endTime ? `${ev.startTime} עד ${ev.endTime}` : ev.startTime;
        const leadLabel =
          reminderMinutes === 0  ? 'מתחיל עכשיו' :
          reminderMinutes < 60   ? `עוד ${reminderMinutes} דקות` :
          reminderMinutes < 1440 ? 'עוד שעה' :
                                    'מחר';
        await scheduleAt(
          new Date(start.getTime() - reminderMinutes * 60000),
          `📅 ${leadLabel}`,
          `${ev.title} — ${timeRange}`,
        );
      }
    }

    // ── Daily summary tomorrow morning ──────────────────────────────────────
    const pending = tasks.filter(t => !t.completed).length;
    if (pending > 0) {
      const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(8, 0, 0, 0);
      const tomorrowISO  = toISO(tomorrow);
      const tomorrowEvts = events.filter(e => occursOnISO(e, tomorrowISO)).length;
      await scheduleAt(
        tomorrow,
        '📖 בוקר טוב! מה יש היום?',
        `${pending} מטלות פתוחות${tomorrowEvts > 0 ? ` • ${tomorrowEvts} אירועים היום` : ''}`,
      );
    }
  } catch { }
};
