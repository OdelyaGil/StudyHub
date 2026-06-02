import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, TextInput, Vibration, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadField } from '../utils/firestore';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { scheduleAllNotifications, scheduleTimerNotification, cancelTimerNotification } from '../utils/notifications';
import { useCustomAlert } from '../hooks/useCustomAlert';

// ── Constants ─────────────────────────────────────────────────────────────────
const STUDY_TIPS = [
  'תלמדי בסביבה שקטה ללא הפרעות — הריכוז עולה ב-40%',
  'שיטת פומודורו: 25 דקות לימוד, 5 דקות הפסקה',
  'חזרה על חומר לפני השינה משפרת שינון לטווח ארוך',
  'הסבירי את החומר בקול רם — זה מחזק הבנה עמוקה',
  'חלקי חומר קשה למנות קטנות ובדקי את עצמך בסוף',
  'שמרי על לחות — שתיית מים משפרת ריכוז וזיכרון',
  'לימוד בקבוצות קטנות יכול להאיר זוויות חדשות',
];

const HEB_DAYS    = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEB_MONTHS  = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const toISO = (d: Date) => {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso + 'T23:59:59').getTime() - Date.now()) / 86400000);

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

const calcWeightedAvg = (grades: any[]) => {
  const valid = grades.filter(g => g.value > 0 && g.credits > 0);
  if (!valid.length) return null;
  return +(valid.reduce((s, g) => s + g.value * g.credits, 0) /
           valid.reduce((s, g) => s + g.credits, 0)).toFixed(1);
};

// ── Component ─────────────────────────────────────────────────────────────────
const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const HomeScreen = () => {
  const theme      = useTheme();
  const navigation = useNavigation<any>();
  const { showAlert, alertNode } = useCustomAlert(theme.accent);

  const [grades,          setGrades]         = useState<any[]>([]);
  const [tasks,           setTasks]          = useState<any[]>([]);
  const [events,          setEvents]         = useState<any[]>([]);
  const [topics,          setTopics]         = useState<any[]>([]);
  const [requiredCredits, setRequiredCredits]= useState(0);
  const [refreshing,      setRefreshing]     = useState(false);

  // ── Timer ─────────────────────────────────────────────────────────────────
  const [timerRunning,  setTimerRunning]  = useState(false);
  const [timerLeft,     setTimerLeft]     = useState(0);
  const [timerTotal,    setTimerTotal]    = useState(0);
  const [timerDone,     setTimerDone]     = useState(false);
  const [timerInput,    setTimerInput]    = useState('25');
  const doneRef        = useRef(false);
  const timerNotifId   = useRef<string | null>(null);
  const timerLeftRef   = useRef(0);
  const timerEndTime   = useRef<number | null>(null);   // exact ms timestamp when timer should finish
  const webTimeout     = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { timerLeftRef.current = timerLeft; }, [timerLeft]);

  // Register service worker + request notification permission (web only)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const N = (globalThis as any).Notification;
    if (N && N.permission === 'default') N.requestPermission().catch(() => {});
  }, []);

  // Fire a desktop notification via Service Worker (shows as OS popup even in background tab)
  const fireWebNotif = () => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    const title = '⏰ טיימר הלימוד הסתיים!';
    const body  = 'כל הכבוד! סיימת את פגישת הלימוד שלך.';
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(reg => reg.showNotification(title, { body }))
        .catch(() => {
          const N = (globalThis as any).Notification;
          if (N && N.permission === 'granted') new N(title, { body });
        });
    } else {
      const N = (globalThis as any).Notification;
      if (N && N.permission === 'granted') new N(title, { body });
    }
  };

  // visibilitychange: catch "timer ended while tab was hidden" when user returns
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = () => {
      if ((document as any).visibilityState !== 'visible') return;
      if (!timerEndTime.current || doneRef.current) return;
      if (Date.now() >= timerEndTime.current) {
        doneRef.current    = true;
        timerEndTime.current = null;
        if (webTimeout.current) { clearTimeout(webTimeout.current); webTimeout.current = null; }
        setTimerRunning(false);
        setTimerLeft(0);
        setTimerDone(true);
      } else {
        // Sync display with real elapsed time (setInterval may have drifted)
        setTimerLeft(Math.ceil((timerEndTime.current - Date.now()) / 1000));
      }
    };
    (document as any).addEventListener('visibilitychange', handler);
    return () => (document as any).removeEventListener('visibilitychange', handler);
  }, []);

  // Countdown tick — clock-based so it stays accurate even when throttled in bg
  useEffect(() => {
    if (!timerRunning) return;
    doneRef.current = false;
    const id = setInterval(() => {
      if (!timerEndTime.current) return;
      const remaining = Math.ceil((timerEndTime.current - Date.now()) / 1000);
      if (remaining <= 0 && !doneRef.current) {
        doneRef.current = true;
        clearInterval(id);
        timerEndTime.current = null;
        setTimerRunning(false);
        setTimerLeft(0);
        setTimerDone(true);
      } else if (remaining > 0) {
        setTimerLeft(remaining);
      }
    }, 500);
    return () => clearInterval(id);
  }, [timerRunning]);

  // On done: vibrate + in-app alert (web notification already scheduled via setTimeout)
  useEffect(() => {
    if (!timerDone) return;
    timerNotifId.current = null;
    Vibration.vibrate([0, 400, 200, 400, 200, 400]);
    showAlert('⏰ הזמן הסתיים!', 'כל הכבוד! סיימת את פגישת הלימוד שלך.');
    // Fallback web notification in case setTimeout didn't fire
    fireWebNotif();
  }, [timerDone]);

  const handleTimerStart = async () => {
    const secs = timerLeft > 0
      ? timerLeftRef.current
      : Math.max(1, parseInt(timerInput) || 25) * 60;
    if (timerLeft === 0) {
      setTimerLeft(secs);
      setTimerTotal(secs);
    }
    timerEndTime.current = Date.now() + secs * 1000;
    setTimerDone(false);
    setTimerRunning(true);

    // Mobile: schedule native push (works even when app is closed / screen locked)
    const id = await scheduleTimerNotification(secs);
    if (id) timerNotifId.current = id;

    // Web: schedule setTimeout — fires in background tab at approximately the right time
    if (Platform.OS === 'web') {
      if (webTimeout.current) clearTimeout(webTimeout.current);
      webTimeout.current = setTimeout(() => { fireWebNotif(); }, secs * 1000);
    }
  };

  const handleTimerPause = () => {
    setTimerRunning(false);
    if (timerNotifId.current) { cancelTimerNotification(timerNotifId.current); timerNotifId.current = null; }
    if (webTimeout.current)   { clearTimeout(webTimeout.current); webTimeout.current = null; }
    // Keep timerEndTime so resume knows exactly how much is left
    if (timerEndTime.current) {
      timerLeftRef.current  = Math.max(0, Math.ceil((timerEndTime.current - Date.now()) / 1000));
      setTimerLeft(timerLeftRef.current);
      timerEndTime.current  = null;
    }
  };

  const handleTimerReset = () => {
    setTimerRunning(false);
    setTimerLeft(0);
    setTimerTotal(0);
    setTimerDone(false);
    timerEndTime.current = null;
    if (timerNotifId.current) { cancelTimerNotification(timerNotifId.current); timerNotifId.current = null; }
    if (webTimeout.current)   { clearTimeout(webTimeout.current); webTimeout.current = null; }
  };

  const timerPct = timerTotal > 0 ? Math.round(((timerTotal - timerLeft) / timerTotal) * 100) : 0;

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  const loadAll = async () => {
    try {
      const [g, t, e, tp] = await Promise.all([
        loadField('grades'),
        loadField('tasks'),
        loadField('schedule'),
        loadField('topics'),
      ]);
      const gr = g  ?? [];
      const tk = t  ?? [];
      const ev = e  ?? [];
      const tp2 = tp ?? [];
      setGrades(gr);
      setTasks(tk);
      setEvents(ev);
      setTopics(tp2);
      scheduleAllNotifications(tk, ev);
      const user = auth.currentUser;
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          setRequiredCredits(+(d.requiredCredits ?? 0));
        }
      }
    } catch (err) { console.log(err); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };

  // ── Derived ───────────────────────────────────────────────────────────────
  const today     = new Date();
  const todayISO  = toISO(today);
  const tip       = STUDY_TIPS[today.getDay()];
  const todayLabel= `יום ${HEB_DAYS[today.getDay()]}, ${today.getDate()} ב${HEB_MONTHS[today.getMonth()]}`;

  const activeTasks  = tasks.filter(t => !t.completed);
  const completedCnt = tasks.filter(t => t.completed).length;

  const urgentTasks = activeTasks
    .filter(t => { const d = daysUntil(t.dueDate); return d >= 0 && d <= 7; })
    .sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate));

  const todayEvents = events
    .filter(e => occursOnISO(e, todayISO))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const next7Dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() + i + 1); return toISO(d);
  });
  const next7Events = next7Dates.flatMap(iso => events.filter(e => occursOnISO(e, iso)));

  const avg        = calcWeightedAvg(grades);
  const avgPct     = avg ? Math.min(100, Math.round(avg)) : 0;
  const topicsReview = topics.filter(t => t.needsReview).length;

  const earnedCredits  = grades.reduce((s: number, g: any) => s + (g.credits || 0), 0);
  const creditsPct     = requiredCredits > 0 ? Math.min(100, Math.round((earnedCredits / requiredCredits) * 100)) : 0;
  const creditsLeft    = requiredCredits > 0 ? Math.max(0, requiredCredits - earnedCredits) : 0;

  const studyRecs  = Array.from(new Set(urgentTasks.filter(t => t.course).map(t => t.course)))
    .map(course => {
      const nearest = urgentTasks.find(t => t.course === course)!;
      const days    = daysUntil(nearest.dueDate);
      const hours   = Math.max(2, Math.min(8, Math.round((8 - days) * 1.2)));
      return { course, days, hours, taskName: nearest.name };
    }).slice(0, 3);

  const urgentDayColor = (d: number) => d === 0 ? '#ff6b6b' : d <= 2 ? '#ffa94d' : '#51cf66';
  const urgentDayLabel = (d: number) => d === 0 ? 'היום!' : d === 1 ? 'מחר' : `${d} ימים`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
    >

      {/* ── 1. Header ──────────────────────────────────────────────────────── */}
      <Text style={[s.dateLabel, { color: theme.textSub, marginBottom: 20 }]}>{todayLabel}</Text>

      {/* ── 2. Urgent Deadlines ───────────────────────────────────────────── */}
      {urgentTasks.length > 0 && (
        <View style={[s.section, { backgroundColor: theme.surface }]}>
          <View style={s.sectionHeader}>
            <MaterialCommunityIcons name="alert-circle" size={18} color="#ff6b6b" />
            <Text style={[s.sectionTitle, { color: '#ff6b6b' }]}>דדליינים דחופים השבוע</Text>
          </View>
          {urgentTasks.slice(0, 4).map(task => {
            const d = daysUntil(task.dueDate);
            return (
              <TouchableOpacity key={task.id} style={s.urgentRow} onPress={() => navigation.navigate('Tasks')}>
                <View style={[s.urgentDot, { backgroundColor: urgentDayColor(d) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.urgentName, { color: theme.text }]}>{task.name}</Text>
                  {task.course ? <Text style={[s.urgentCourse, { color: theme.textSub }]}>{task.course}</Text> : null}
                </View>
                <Text style={[s.urgentDays, { color: urgentDayColor(d) }]}>{urgentDayLabel(d)}</Text>
              </TouchableOpacity>
            );
          })}
          {urgentTasks.length > 4 && (
            <TouchableOpacity onPress={() => navigation.navigate('Tasks')}>
              <Text style={[s.seeAll, { color: '#ff6b6b' }]}>עוד {urgentTasks.length - 4} מטלות →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── 3. Today's Schedule ───────────────────────────────────────────── */}
      {todayEvents.length > 0 && (
        <View style={[s.section, { backgroundColor: theme.surface }]}>
          <View style={s.sectionHeader}>
            <MaterialCommunityIcons name="calendar-today" size={18} color="#667eea" />
            <Text style={[s.sectionTitle, { color: '#667eea' }]}>לוח זמנים להיום</Text>
          </View>
          {todayEvents.map(ev => (
            <TouchableOpacity key={ev.id} style={s.eventRow} onPress={() => navigation.navigate('Events')}>
              <View style={[s.eventBar, { backgroundColor: ev.color || '#667eea' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.eventTitle, { color: theme.text }]}>{ev.title}</Text>
                <Text style={[s.eventTime, { color: '#667eea' }]}>
                  {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-left" size={16} color={theme.textSub} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── 4. Two cards side by side ─────────────────────────────────────── */}
      <View style={s.twoCardRow}>
        {/* Academic Performance */}
        <TouchableOpacity
          style={[s.halfCard, { backgroundColor: theme.surface }]}
          onPress={() => navigation.navigate('Grades')}
        >
          <Text style={[s.halfCardTitle, { color: theme.textSub }]}>ביצועים אקדמיים</Text>
          {avg ? (
            <>
              <View style={[s.circle, { borderColor: theme.accent }]}>
                <Text style={[s.circleVal, { color: theme.accent }]}>{avg}</Text>
                <Text style={[s.circleSubLabel, { color: theme.textSub }]}>ממוצע</Text>
              </View>
              <View style={[s.progressBarBg, { backgroundColor: theme.accent + '22' }]}>
                <View style={[s.progressBarFill, { width: `${avgPct}%` as any, backgroundColor: theme.accent }]} />
              </View>
              <Text style={[s.halfCardSub, { color: theme.textSub }]}>{avgPct}% מהמקסימום</Text>
            </>
          ) : (
            <Text style={[s.halfCardEmpty, { color: theme.textSub }]}>אין ציונים עדיין</Text>
          )}
        </TouchableOpacity>

        {/* Next 7 Days */}
        <TouchableOpacity
          style={[s.halfCard, { backgroundColor: theme.surface }]}
          onPress={() => navigation.navigate('Tasks')}
        >
          <Text style={[s.halfCardTitle, { color: theme.textSub }]}>7 ימים הבאים</Text>
          <View style={s.next7List}>
            {[
              { val: urgentTasks.length, label: 'מטלות',   color: '#ff6b6b', icon: 'clipboard-alert-outline' },
              { val: next7Events.length, label: 'אירועים', color: '#667eea', icon: 'calendar-range' },
              { val: topicsReview,       label: 'לחזרה',   color: '#ffa94d', icon: 'refresh' },
            ].map(item => (
              <View key={item.label} style={s.next7Row}>
                <MaterialCommunityIcons name={item.icon as any} size={14} color={item.color} />
                <Text style={[s.next7Val, { color: item.color }]}>{item.val}</Text>
                <Text style={[s.next7Key, { color: theme.textSub }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </View>

      {/* ── 4.5. Study Timer ──────────────────────────────────────────────── */}
      <View style={[s.section, { backgroundColor: theme.surface }]}>
        <View style={s.sectionHeader}>
          <MaterialCommunityIcons name="timer-outline" size={18} color={theme.accent} />
          <Text style={[s.sectionTitle, { color: theme.accent }]}>טיימר לימוד עצמי</Text>
          {timerDone && (
            <View style={[s.timerDoneBadge, { backgroundColor: '#51cf66' + '22', borderColor: '#51cf66' }]}>
              <Text style={s.timerDoneText}>✓ הסתיים</Text>
            </View>
          )}
        </View>

        {/* Time display */}
        <Text style={[s.timerDisplay, { color: timerDone ? '#51cf66' : timerLeft > 0 && timerLeft <= 60 ? '#ff6b6b' : theme.text }]}>
          {timerLeft > 0 ? formatTime(timerLeft) : timerDone ? formatTime(0) : formatTime((parseInt(timerInput) || 25) * 60)}
        </Text>

        {/* Status label */}
        <Text style={[s.timerStatus, { color: theme.textSub }]}>
          {timerRunning ? 'לומד...' : timerDone ? 'כל הכבוד!' : timerLeft > 0 ? 'בהפסקה' : 'מוכן להתחיל'}
        </Text>

        {/* Progress bar */}
        <View style={[s.progressBarBg, { backgroundColor: theme.accent + '22', marginVertical: 12 }]}>
          <View style={[s.progressBarFill, { width: `${timerPct}%` as any, backgroundColor: timerDone ? '#51cf66' : theme.accent }]} />
        </View>

        {/* Duration input — only when idle */}
        {!timerRunning && timerLeft === 0 && (
          <View style={s.timerInputRow}>
            <Text style={[s.timerInputLabel, { color: theme.textSub }]}>משך (דקות):</Text>
            {[15, 25, 45, 60].map(m => (
              <TouchableOpacity
                key={m}
                style={[s.timerPreset, { borderColor: timerInput === String(m) ? theme.accent : theme.border, backgroundColor: timerInput === String(m) ? theme.accent + '22' : 'transparent' }]}
                onPress={() => setTimerInput(String(m))}
              >
                <Text style={[s.timerPresetText, { color: timerInput === String(m) ? theme.accent : theme.textSub }]}>{m}</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={[s.timerCustomInput, { borderColor: theme.border, backgroundColor: theme.surface, color: theme.text }]}
              value={timerInput}
              onChangeText={v => setTimerInput(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={3}
              textAlign="center"
              placeholderTextColor={theme.textSub}
              placeholder="25"
            />
          </View>
        )}

        {/* Controls */}
        <View style={s.timerControls}>
          {!timerRunning ? (
            <TouchableOpacity style={[s.timerStartBtn, { backgroundColor: theme.accent }]} onPress={handleTimerStart}>
              <MaterialCommunityIcons name={timerLeft > 0 ? 'play' : 'play'} size={18} color={theme.bg} />
              <Text style={[s.timerStartText, { color: theme.bg }]}>{timerLeft > 0 ? 'המשך' : 'התחל'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.timerPauseBtn, { borderColor: theme.accent }]} onPress={handleTimerPause}>
              <MaterialCommunityIcons name="pause" size={18} color={theme.accent} />
              <Text style={[s.timerPauseText, { color: theme.accent }]}>השהה</Text>
            </TouchableOpacity>
          )}
          {(timerLeft > 0 || timerDone) && (
            <TouchableOpacity style={[s.timerResetBtn, { borderColor: theme.border }]} onPress={handleTimerReset}>
              <MaterialCommunityIcons name="restart" size={18} color={theme.textSub} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── 5. Study Recommendations ──────────────────────────────────────── */}
      {studyRecs.length > 0 && (
        <View style={[s.section, { backgroundColor: theme.surface }]}>
          <View style={s.sectionHeader}>
            <MaterialCommunityIcons name="book-clock-outline" size={18} color="#ffa94d" />
            <Text style={[s.sectionTitle, { color: '#ffa94d' }]}>המלצות לימוד</Text>
          </View>
          {studyRecs.map((rec, i) => (
            <View key={i} style={s.studyRow}>
              <MaterialCommunityIcons name="clock-fast" size={16} color="#ffa94d" />
              <View style={{ flex: 1 }}>
                <Text style={[s.studyCourse, { color: theme.text }]}>{rec.course}</Text>
                <Text style={[s.studySub, { color: theme.textSub }]}>
                  {`${rec.hours} שעות מומלצות — "${rec.taskName}" בעוד ${rec.days} ימים`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── 7. Credit Points Progress ─────────────────────────────────────── */}
      <TouchableOpacity
        style={[s.section, { backgroundColor: theme.surface, marginBottom: 16 }]}
        onPress={() => navigation.navigate('Grades')}
        activeOpacity={0.8}
      >
        <View style={s.sectionHeader}>
          <MaterialCommunityIcons name="school-outline" size={18} color={theme.accent} />
          <Text style={[s.sectionTitle, { color: theme.accent }]}>התקדמות נקודות זכות</Text>
        </View>
        <View style={s.creditsRow}>
          <Text style={[s.creditsEarned, { color: theme.text }]}>{earnedCredits}</Text>
          <Text style={[s.creditsSlash, { color: theme.textSub }]}>
            {requiredCredits > 0 ? ` / ${requiredCredits} נ"ז` : ' נ"ז נצברו'}
          </Text>
        </View>
        {requiredCredits > 0 ? (
          <>
            <View style={[s.progressBarBg, { backgroundColor: theme.accent + '22', marginVertical: 10 }]}>
              <View style={[s.progressBarFill, { width: `${creditsPct}%` as any, backgroundColor: theme.accent }]} />
            </View>
            <View style={s.creditsMeta}>
              <Text style={[s.creditsPct, { color: theme.accent }]}>{creditsPct}% הושלמו</Text>
              {creditsLeft > 0 && (
                <Text style={[s.creditsLeft, { color: theme.textSub }]}>עוד {creditsLeft} נ"ז לסיום</Text>
              )}
            </View>
          </>
        ) : (
          <Text style={[s.creditsHint, { color: theme.textSub }]}>הגדר נ"ז נדרשות בפרופיל כדי לראות את ההתקדמות</Text>
        )}
      </TouchableOpacity>

      {/* ── 8. Motivational Tip ───────────────────────────────────────────── */}
      <View style={[s.tipCard, { backgroundColor: theme.surface }]}>
        <View style={s.tipHeader}>
          <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color="#51cf66" />
          <Text style={[s.tipTitle, { color: '#51cf66' }]}>טיפ לימוד יומי</Text>
        </View>
        <Text style={[s.tipText, { color: theme.text }]}>{tip}</Text>
      </View>

    </ScrollView>
    {alertNode}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Header
  headerRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  greeting:       { fontSize: 20, fontWeight: '800', textAlign: 'right' },
  dateLabel:      { fontSize: 12, marginTop: 2, textAlign: 'right' },
  quickChip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  quickChipText:  { fontSize: 12, fontWeight: '700' },

  // Section card
  section:        { borderRadius: 20, padding: 16, marginBottom: 14, shadowColor: '#4A5B9A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 4 },
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle:   { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  seeAll:         { fontSize: 12, fontWeight: '600', textAlign: 'right', marginTop: 8 },

  // Urgent rows
  urgentRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  urgentDot:      { width: 10, height: 10, borderRadius: 5 },
  urgentName:     { fontSize: 13, fontWeight: '700', textAlign: 'right' },
  urgentCourse:   { fontSize: 11, textAlign: 'right', marginTop: 1 },
  urgentDays:     { fontSize: 12, fontWeight: '800', minWidth: 50, textAlign: 'right' },

  // Events
  eventRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  eventBar:       { width: 4, height: 40, borderRadius: 2 },
  eventTitle:     { fontSize: 13, fontWeight: '700', textAlign: 'right' },
  eventTime:      { fontSize: 11, fontWeight: '600', marginTop: 2, textAlign: 'right' },

  // Two cards
  twoCardRow:     { flexDirection: 'row', gap: 12, marginBottom: 14 },
  halfCard:       { flex: 1, borderRadius: 20, padding: 14, alignItems: 'center', gap: 8, shadowColor: '#4A5B9A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 4 },
  halfCardTitle:  { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  halfCardSub:    { fontSize: 10, textAlign: 'center' },
  halfCardEmpty:  { fontSize: 12, textAlign: 'center', marginTop: 16 },
  circle:         { width: 72, height: 72, borderRadius: 36, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  circleVal:      { fontSize: 20, fontWeight: '800' },
  circleSubLabel: { fontSize: 9, fontWeight: '600' },
  progressBarBg:  { height: 6, width: '100%', borderRadius: 3, overflow: 'hidden' },
  progressBarFill:{ height: 6, borderRadius: 3 },
  next7List:      { gap: 8, width: '100%' },
  next7Row:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  next7Val:       { fontSize: 16, fontWeight: '800', minWidth: 24, textAlign: 'right' },
  next7Key:       { fontSize: 12 },

  // Study recs
  studyRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  studyCourse:    { fontSize: 13, fontWeight: '700', textAlign: 'right' },
  studySub:       { fontSize: 11, textAlign: 'right', marginTop: 2 },

  // Stats grid
  statsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statMini:       { width: '47%', borderRadius: 14, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1 },
  statMiniVal:    { fontSize: 22, fontWeight: '800' },
  statMiniLabel:  { fontSize: 10, fontWeight: '600', textAlign: 'center' },

  // Credits progress
  creditsRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  creditsEarned:  { fontSize: 36, fontWeight: '900' },
  creditsSlash:   { fontSize: 14, fontWeight: '600' },
  creditsMeta:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  creditsPct:     { fontSize: 13, fontWeight: '800' },
  creditsLeft:    { fontSize: 12 },
  creditsHint:    { fontSize: 12, textAlign: 'right', marginTop: 8 },

  // Tip
  tipCard:        { borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: '#4A5B9A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 4 },
  tipHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  tipTitle:       { fontSize: 13, fontWeight: '700' },
  tipText:        { fontSize: 13, lineHeight: 20, textAlign: 'right' },

  // Actions
  actionsRow:     { flexDirection: 'row', gap: 12 },
  actionBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  actionBtnText:  { fontSize: 13, fontWeight: '700' },

  // Timer
  timerDisplay:    { fontSize: 52, fontWeight: '900', textAlign: 'center', letterSpacing: 2, marginTop: 4 },
  timerStatus:     { fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  timerDoneBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, marginLeft: 8 },
  timerDoneText:   { fontSize: 11, fontWeight: '700', color: '#51cf66' },
  timerInputRow:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  timerInputLabel: { fontSize: 12, fontWeight: '600' },
  timerPreset:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  timerPresetText: { fontSize: 12, fontWeight: '700' },
  timerCustomInput:{ width: 52, borderWidth: 1, borderRadius: 20, paddingVertical: 6, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  timerControls:   { flexDirection: 'row', gap: 10, marginTop: 14, alignItems: 'center' },
  timerStartBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 },
  timerStartText:  { fontSize: 15, fontWeight: '800' },
  timerPauseBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  timerPauseText:  { fontSize: 15, fontWeight: '800' },
  timerResetBtn:   { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

export default HomeScreen;
