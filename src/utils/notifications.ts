import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

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
        lightColor: '#00FFFF',
      });
    }
    return true;
  } catch (_) { return false; }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const toISO = (d: Date) => {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const occursOnISO = (event: any, iso: string): boolean => {
  if (!event?.date || iso < event.date) return false;
  if (event.recurrenceEndDate && iso > event.recurrenceEndDate) return false;
  switch (event.recurrence) {
    case 'none':    return iso === event.date;
    case 'daily':   return true;
    case 'weekly': {
      const diff = Math.round(
        (new Date(iso + 'T12:00:00').getTime() - new Date(event.date + 'T12:00:00').getTime()) / 86400000
      );
      return diff % 7 === 0;
    }
    case 'monthly': return iso.slice(8) === event.date.slice(8);
    case 'yearly':  return iso.slice(5) === event.date.slice(5);
    default:        return false;
  }
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

    await Notifications.cancelAllScheduledNotificationsAsync();

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
    for (let i = 0; i < 7; i++) {
      const d   = new Date(now); d.setDate(d.getDate() + i);
      const iso = toISO(d);
      for (const ev of events.filter(e => occursOnISO(e, iso))) {
        if (!ev.startTime) continue;
        const [h, m] = ev.startTime.split(':').map(Number);
        const start  = new Date(d); start.setHours(h, m, 0, 0);
        await scheduleAt(
          new Date(start.getTime() - 30 * 60000),
          '📅 עוד 30 דקות',
          `${ev.title} — ${ev.startTime}${ev.endTime ? ` עד ${ev.endTime}` : ''}`,
        );
        if (i === 0) {
          const morning = new Date(d); morning.setHours(8, 0, 0, 0);
          await scheduleAt(morning, '☀️ תזכורת בוקר', `היום יש לך: ${ev.title} בשעה ${ev.startTime}`);
        }
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
  } catch (err) { console.log('Notifications error:', err); }
};
