import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// ── Setup ─────────────────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Permission ────────────────────────────────────────────────────────────────
export const requestNotificationPermission = async (): Promise<boolean> => {
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

const scheduleAt = async (
  date: Date,
  title: string,
  body: string,
  data: object = {},
  channelId = 'studyhub',
) => {
  if (date <= new Date()) return; // don't schedule past notifications
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true, ...(Platform.OS === 'android' ? { channelId } : {}) },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
};

// ── Main scheduler ────────────────────────────────────────────────────────────
export const scheduleAllNotifications = async (
  tasks: any[],
  events: any[],
) => {
  const permitted = await requestNotificationPermission();
  if (!permitted) return;

  // Cancel all existing scheduled notifications before rescheduling
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now   = new Date();
  const today = toISO(now);

  // ── 1. Task deadline notifications ─────────────────────────────────────────
  for (const task of tasks) {
    if (task.completed || !task.dueDate) continue;

    const dueDate = new Date(task.dueDate + 'T23:59:00');
    const label   = task.course ? `${task.name} (${task.course})` : task.name;

    const msUntilDue  = dueDate.getTime() - now.getTime();
    const daysUntilDue = Math.ceil(msUntilDue / 86400000);

    // 7 days before
    if (daysUntilDue === 7) {
      const t = new Date(dueDate);
      t.setHours(9, 0, 0, 0);
      await scheduleAt(t, '📚 שבוע עד הגשה', `${label} — עוד 7 ימים`);
    }

    // 3 days before at 9:00
    if (daysUntilDue <= 3 && daysUntilDue > 1) {
      const t = new Date(now);
      t.setDate(t.getDate() + 1);
      t.setHours(9, 0, 0, 0);
      await scheduleAt(t, '⚠️ קרוב להגשה', `${label} — עוד ${daysUntilDue} ימים`);
    }

    // 24 hours before
    const alert24h = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000);
    await scheduleAt(alert24h, '🚨 מחר אחרון להגשה!', label);

    // 1 hour before (same day)
    if (task.dueDate === today) {
      const alert1h = new Date(dueDate.getTime() - 60 * 60 * 1000);
      await scheduleAt(alert1h, '🔴 שעה אחרונה!', label);
    }
  }

  // ── 2. Event notifications ──────────────────────────────────────────────────
  // Notify for events in the next 7 days
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const iso = toISO(d);

    const dayEvents = events.filter(e => occursOnISO(e, iso));
    if (!dayEvents.length) continue;

    for (const ev of dayEvents) {
      if (!ev.startTime) continue;
      const [h, m] = ev.startTime.split(':').map(Number);

      // 30 minutes before the event
      const eventStart = new Date(d);
      eventStart.setHours(h, m, 0, 0);
      const alert30m = new Date(eventStart.getTime() - 30 * 60 * 1000);
      await scheduleAt(
        alert30m,
        '📅 עוד 30 דקות',
        `${ev.title} — ${ev.startTime}${ev.endTime ? ` עד ${ev.endTime}` : ''}`,
      );

      // Morning reminder (8:00) for same-day events
      if (i === 0) {
        const morning = new Date(d);
        morning.setHours(8, 0, 0, 0);
        await scheduleAt(morning, '☀️ תזכורת בוקר', `היום יש לך: ${ev.title} בשעה ${ev.startTime}`);
      }
    }
  }

  // ── 3. Daily morning summary (every day at 8:00) ────────────────────────────
  const pendingCount = tasks.filter(t => !t.completed).length;
  if (pendingCount > 0) {
    const tomorrowMorning = new Date(now);
    tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
    tomorrowMorning.setHours(8, 0, 0, 0);

    const tomorrowISO  = toISO(tomorrowMorning);
    const tomorrowEvts = events.filter(e => occursOnISO(e, tomorrowISO)).length;

    await scheduleAt(
      tomorrowMorning,
      '📖 בוקר טוב! מה יש היום?',
      `${pendingCount} מטלות פתוחות${tomorrowEvts > 0 ? ` • ${tomorrowEvts} אירועים היום` : ''}`,
    );
  }
};
