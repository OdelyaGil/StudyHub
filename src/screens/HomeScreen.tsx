import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
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
  const [userName,        setUserName]       = useState('');
  const [photoURL,        setPhotoURL]       = useState<string | null>(null);

  // ── Timer ─────────────────────────────────────────────────────────────────
  const [timerRunning,  setTimerRunning]  = useState(false);
  const [timerLeft,     setTimerLeft]     = useState(0);
  const [timerTotal,    setTimerTotal]    = useState(0);
  const [timerDone,     setTimerDone]     = useState(false);
  const [timerInput,    setTimerInput]    = useState('25');
  const doneRef        = useRef(false);
  const timerNotifId   = useRef<string | null>(null);
  const timerLeftRef   = useRef(0);
  const timerEndTime   = useRef<number | null>(null);
  const webTimeout     = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { timerLeftRef.current = timerLeft; }, [timerLeft]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const N = (globalThis as any).Notification;
    if (N && N.permission === 'default') N.requestPermission().catch(() => {});
  }, []);

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
        setTimerLeft(Math.ceil((timerEndTime.current - Date.now()) / 1000));
      }
    };
    (document as any).addEventListener('visibilitychange', handler);
    return () => (document as any).removeEventListener('visibilitychange', handler);
  }, []);

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

  useEffect(() => {
    if (!timerDone) return;
    timerNotifId.current = null;
    Vibration.vibrate([0, 400, 200, 400, 200, 400]);
    showAlert('⏰ הזמן הסתיים!', 'כל הכבוד! סיימת את פגישת הלימוד שלך.');
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
    const id = await scheduleTimerNotification(secs);
    if (id) timerNotifId.current = id;
    if (Platform.OS === 'web') {
      if (webTimeout.current) clearTimeout(webTimeout.current);
      webTimeout.current = setTimeout(() => { fireWebNotif(); }, secs * 1000);
    }
  };

  const handleTimerPause = () => {
    setTimerRunning(false);
    if (timerNotifId.current) { cancelTimerNotification(timerNotifId.current); timerNotifId.current = null; }
    if (webTimeout.current)   { clearTimeout(webTimeout.current); webTimeout.current = null; }
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
      setGrades(g  ?? []);
      setTasks(t   ?? []);
      setEvents(e  ?? []);
      setTopics(tp ?? []);
      scheduleAllNotifications(t ?? [], e ?? []);
      const user = auth.currentUser;
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          setRequiredCredits(+(d.requiredCredits ?? 0));
          setUserName(d.name || '');
          setPhotoURL(d.photoURL || null);
        }
      }
    } catch (err) { console.log(err); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };

  // ── Derived ───────────────────────────────────────────────────────────────
  const today      = new Date();
  const todayISO   = toISO(today);
  const tip        = STUDY_TIPS[today.getDay()];
  const todayLabel = `יום ${HEB_DAYS[today.getDay()]}, ${today.getDate()} ב${HEB_MONTHS[today.getMonth()]}`;

  const activeTasks  = tasks.filter(t => !t.completed);

  const urgentTasks = activeTasks
    .filter(t => { const d = daysUntil(t.dueDate); return d >= 0 && d <= 7; })
    .sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate));

  const todayEvents = events
    .filter(e => occursOnISO(e, todayISO))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const next7Dates  = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() + i + 1); return toISO(d);
  });
  const next7Events = next7Dates.flatMap(iso => events.filter(e => occursOnISO(e, iso)));

  const avg         = calcWeightedAvg(grades);
  const topicsReview= topics.filter(t => t.needsReview).length;
  const earnedCredits = grades.reduce((s: number, g: any) => s + (g.credits || 0), 0);
  const creditsPct  = requiredCredits > 0 ? Math.min(100, Math.round((earnedCredits / requiredCredits) * 100)) : 0;

  const studyRecs   = Array.from(new Set(urgentTasks.filter(t => t.course).map(t => t.course)))
    .map(course => {
      const nearest = urgentTasks.find(t => t.course === course)!;
      const days    = daysUntil(nearest.dueDate);
      const hours   = Math.max(2, Math.min(8, Math.round((8 - days) * 1.2)));
      return { course, days, hours, taskName: nearest.name };
    }).slice(0, 3);

  const urgentDayColor = (d: number) => d === 0 ? '#ff6b6b' : d <= 2 ? '#ffa94d' : '#51cf66';
  const urgentDayLabel = (d: number) => d === 0 ? 'היום!' : d === 1 ? 'מחר' : `${d} ימים`;

  const initials = userName
    ? userName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
    >

      {/* ── HERO CARD ──────────────────────────────────────────────────────── */}
      <View style={s.heroCard}>
        {/* Top-left "All stats" button */}
        <TouchableOpacity style={s.heroAllStatsBtn} onPress={() => navigation.navigate('Grades')}>
          <MaterialCommunityIcons name="chart-box-outline" size={15} color="#fff" />
          <Text style={s.heroAllStatsText}>סטטיסטיקות</Text>
        </TouchableOpacity>

        {/* Avatar + name */}
        <View style={s.heroTop}>
          <View style={s.heroAvatarRing}>
            {photoURL
              ? <Image source={{ uri: photoURL }} style={s.heroAvatar} />
              : <View style={s.heroAvatarFallback}>
                  <Text style={s.heroInitials}>{initials}</Text>
                </View>
            }
          </View>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={s.heroName}>{userName || 'סטודנט'}</Text>
            <Text style={s.heroSub}>{todayLabel}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={s.heroStatsRow}>
          <View style={s.heroStat}>
            <Text style={s.heroStatVal}>{avg ?? '--'}</Text>
            <Text style={s.heroStatLabel}>AVERAGE SCORE</Text>
          </View>
          <View style={s.heroStatDivider} />
          <View style={s.heroStat}>
            <Text style={s.heroStatVal}>{activeTasks.length}</Text>
            <Text style={s.heroStatLabel}>TASKS</Text>
          </View>
          <View style={s.heroStatDivider} />
          <View style={s.heroStat}>
            <Text style={s.heroStatVal}>{earnedCredits}</Text>
            <Text style={s.heroStatLabel}>CREDITS</Text>
          </View>
        </View>
      </View>

      {/* ── THREE COLUMNS ──────────────────────────────────────────────────── */}
      <View style={s.threeCol}>

        {/* 1 — Urgent Deadlines */}
        <TouchableOpacity
          style={[s.colCard, { backgroundColor: theme.surface }]}
          onPress={() => navigation.navigate('Tasks')}
          activeOpacity={0.85}
        >
          <View style={s.colHeader}>
            <Text style={[s.colTitle, { color: theme.textSub }]}>דדליינים</Text>
            <View style={s.colBadgeRed}>
              <Text style={s.colBadgeRedText}>{urgentTasks.length}</Text>
            </View>
          </View>
          {urgentTasks.length > 0 ? urgentTasks.slice(0, 3).map(task => {
            const d = daysUntil(task.dueDate);
            return (
              <View key={task.id} style={s.colItem}>
                <View style={[s.colDot, { backgroundColor: urgentDayColor(d) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.colItemTitle, { color: theme.text }]} numberOfLines={1}>{task.name}</Text>
                  <Text style={[s.colItemSub, { color: urgentDayColor(d) }]}>{urgentDayLabel(d)}</Text>
                </View>
              </View>
            );
          }) : (
            <Text style={[s.colEmpty, { color: theme.textSub }]}>אין דדליינים קרובים 🎉</Text>
          )}
        </TouchableOpacity>

        {/* 2 — Today's Schedule */}
        <TouchableOpacity
          style={[s.colCard, { backgroundColor: theme.surface }]}
          onPress={() => navigation.navigate('Events')}
          activeOpacity={0.85}
        >
          <View style={s.colHeader}>
            <Text style={[s.colTitle, { color: theme.textSub }]}>לוח זמנים להיום</Text>
            <View style={s.colBadgeBlue}>
              <Text style={s.colBadgeBlueText}>{todayEvents.length}</Text>
            </View>
          </View>
          {todayEvents.length > 0 ? todayEvents.slice(0, 3).map(ev => (
            <View key={ev.id} style={s.colItem}>
              <View style={[s.colBar, { backgroundColor: ev.color || '#667eea' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.colItemTitle, { color: theme.text }]} numberOfLines={1}>{ev.title}</Text>
                <Text style={[s.colItemSub, { color: '#667eea' }]}>
                  {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
                </Text>
              </View>
            </View>
          )) : (
            <Text style={[s.colEmpty, { color: theme.textSub }]}>אין אירועים היום</Text>
          )}
        </TouchableOpacity>

        {/* 3 — Next 7 Days */}
        <View style={[s.colCard, { backgroundColor: theme.surface }]}>
          <View style={s.colHeader}>
            <Text style={[s.colTitle, { color: theme.textSub }]}>7 ימים הבאים</Text>
          </View>
          {[
            { val: urgentTasks.length, label: 'מטלות',   color: '#ff6b6b', icon: 'clipboard-alert-outline' as const },
            { val: next7Events.length, label: 'אירועים', color: '#667eea', icon: 'calendar-range' as const },
            { val: topicsReview,       label: 'לחזרה',   color: '#ffa94d', icon: 'refresh' as const },
          ].map(item => (
            <View key={item.label} style={s.next7Row}>
              <MaterialCommunityIcons name={item.icon} size={16} color={item.color} />
              <Text style={[s.next7Val, { color: item.color }]}>{item.val}</Text>
              <Text style={[s.next7Key, { color: theme.textSub }]}>{item.label}</Text>
            </View>
          ))}
          {requiredCredits > 0 && (
            <>
              <View style={[s.progressBarBg, { backgroundColor: theme.accent + '22', marginTop: 14 }]}>
                <View style={[s.progressBarFill, { width: `${creditsPct}%` as any, backgroundColor: theme.accent }]} />
              </View>
              <Text style={[s.colItemSub, { color: theme.textSub, textAlign: 'right', marginTop: 5 }]}>
                {creditsPct}% נ"ז הושלמו
              </Text>
            </>
          )}
        </View>
      </View>

      {/* ── Study Timer ───────────────────────────────────────────────────── */}
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

        <Text style={[s.timerDisplay, { color: timerDone ? '#51cf66' : timerLeft > 0 && timerLeft <= 60 ? '#ff6b6b' : theme.text }]}>
          {timerLeft > 0 ? formatTime(timerLeft) : timerDone ? formatTime(0) : formatTime((parseInt(timerInput) || 25) * 60)}
        </Text>
        <Text style={[s.timerStatus, { color: theme.textSub }]}>
          {timerRunning ? 'לומד...' : timerDone ? 'כל הכבוד!' : timerLeft > 0 ? 'בהפסקה' : 'מוכן להתחיל'}
        </Text>

        <View style={[s.progressBarBg, { backgroundColor: theme.accent + '22', marginVertical: 12 }]}>
          <View style={[s.progressBarFill, { width: `${timerPct}%` as any, backgroundColor: timerDone ? '#51cf66' : theme.accent }]} />
        </View>

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

        <View style={s.timerControls}>
          {!timerRunning ? (
            <TouchableOpacity style={[s.timerStartBtn, { backgroundColor: theme.accent }]} onPress={handleTimerStart}>
              <MaterialCommunityIcons name="play" size={18} color={theme.bg} />
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

      {/* ── Study Recommendations ─────────────────────────────────────────── */}
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

      {/* ── Motivational Tip ──────────────────────────────────────────────── */}
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
const CARD_SHADOW = {
  shadowColor: '#4A5B9A' as string,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.10,
  shadowRadius: 12,
  elevation: 4,
};

const s = StyleSheet.create({
  // ── Hero card ──────────────────────────────────────────────────────────────
  heroCard: {
    borderRadius: 24, padding: 20, marginBottom: 20,
    backgroundColor: '#1E2140',
    shadowColor: '#5B78F5', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.30, shadowRadius: 24, elevation: 10,
  },
  heroTop: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20,
    marginTop: 8,
  },
  heroAvatarRing: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2.5, borderColor: '#5B78F5',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#5B78F5', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 10,
  },
  heroAvatar:         { width: 60, height: 60, borderRadius: 30 },
  heroAvatarFallback: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(91,120,245,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroInitials:    { fontSize: 22, fontWeight: '800', color: '#5B78F5' },
  heroName:        { fontSize: 17, fontWeight: '800', color: '#FFFFFF', textAlign: 'right' },
  heroSub:         { fontSize: 12, color: 'rgba(232,237,248,0.55)', textAlign: 'right', marginTop: 3 },
  heroAllStatsBtn: {
    position: 'absolute', top: 16, left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#5B78F5',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    shadowColor: '#5B78F5', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8,
  },
  heroAllStatsText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  heroStatsRow: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)',
  },
  heroStat:         { alignItems: 'center', flex: 1 },
  heroStatVal:      { fontSize: 26, fontWeight: '900', color: '#FFFFFF' },
  heroStatLabel:    { fontSize: 9, fontWeight: '700', color: 'rgba(232,237,248,0.45)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  heroStatDivider:  { width: 1, height: 38, backgroundColor: 'rgba(255,255,255,0.10)' },

  // ── Three-column grid ──────────────────────────────────────────────────────
  threeCol: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  colCard: {
    flex: 1, borderRadius: 20, padding: 14, minHeight: 190,
    ...CARD_SHADOW,
  },
  colHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 6, marginBottom: 12,
  },
  colTitle:         { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, flex: 1, textAlign: 'right' },
  colBadgeRed:      { backgroundColor: 'rgba(255,107,107,0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  colBadgeRedText:  { fontSize: 10, fontWeight: '700', color: '#ff6b6b' },
  colBadgeBlue:     { backgroundColor: 'rgba(102,126,234,0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  colBadgeBlueText: { fontSize: 10, fontWeight: '700', color: '#667eea' },
  colItem:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  colDot:           { width: 8, height: 8, borderRadius: 4 },
  colBar:           { width: 3, height: 36, borderRadius: 2 },
  colItemTitle:     { fontSize: 12, fontWeight: '700', textAlign: 'right' },
  colItemSub:       { fontSize: 10, fontWeight: '600', marginTop: 1, textAlign: 'right' },
  colEmpty:         { fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 20 },

  // ── Section card ───────────────────────────────────────────────────────────
  section:       { borderRadius: 20, padding: 16, marginBottom: 14, ...CARD_SHADOW },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle:  { fontSize: 14, fontWeight: '700', textAlign: 'right' },

  // ── Next 7 days (inside col card) ──────────────────────────────────────────
  next7Row:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  next7Val:  { fontSize: 16, fontWeight: '800', minWidth: 24, textAlign: 'right' },
  next7Key:  { fontSize: 12 },

  // ── Progress bar ───────────────────────────────────────────────────────────
  progressBarBg:   { height: 6, width: '100%', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, borderRadius: 3 },

  // ── Study recommendations ──────────────────────────────────────────────────
  studyRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  studyCourse: { fontSize: 13, fontWeight: '700', textAlign: 'right' },
  studySub:    { fontSize: 11, textAlign: 'right', marginTop: 2 },

  // ── Motivational tip ───────────────────────────────────────────────────────
  tipCard:   { borderRadius: 20, padding: 16, marginBottom: 16, ...CARD_SHADOW },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  tipTitle:  { fontSize: 13, fontWeight: '700' },
  tipText:   { fontSize: 13, lineHeight: 20, textAlign: 'right' },

  // ── Timer ──────────────────────────────────────────────────────────────────
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
