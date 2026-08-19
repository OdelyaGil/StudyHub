import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, TextInput, Vibration, Platform, AppState,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadField } from '../utils/firestore';
import { useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { scheduleAllNotifications, scheduleTimerNotification, cancelTimerNotification, scheduleWebEventReminders } from '../utils/notifications';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { toISO, daysUntil, occursOnISO, hexToRgba } from '../utils/helpers';

// ── Design tokens ─────────────────────────────────────────────────────────────
const PAGE_BG    = '#EEF0F9';   // light lavender-white
const DARK_CARD  = '#3D1568';   // hero card purple
const SOFT_TEAL  = '#00C9B1';
const NEON_PINK  = '#EF5B8A';
const NEON_BLUE  = '#00C8E8';
const NEON_GREEN = '#00BFA5';


// ── Neumorphic shadows ────────────────────────────────────────────────────────
// outer raised shadow — rgba so it works on any background (solid or gradient)
const NEU_OUTER = Platform.select<object>({
  web: { boxShadow: '8px 8px 22px rgba(0,0,0,0.13), -6px -6px 18px rgba(255,255,255,0.88)' } as any,
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.13,
    shadowRadius: 14,
    elevation: 8,
  },
});

// inset pressed for search / progress bars
const NEU_INSET = Platform.select<object>({
  web: { boxShadow: 'inset 4px 4px 10px rgba(0,0,0,0.1), inset -3px -3px 8px rgba(255,255,255,0.85)' } as any,
  default: {},
});

// ── Constants ─────────────────────────────────────────────────────────────────
const HEB_DAYS   = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEB_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

const STUDY_TIPS = [
  'למד/י בסביבה שקטה ללא הפרעות — הריכוז עולה ב-40%',
  'שיטת פומודורו: 25 דקות לימוד, 5 דקות הפסקה',
  'חזרה על חומר לפני השינה משפרת זיכרון לטווח ארוך',
  'הסבר/י את החומר בקול רם — זה מחזק הבנה עמוקה',
  'חלק/י חומר קשה למנות קטנות ובדוק/י את עצמך בסוף',
  'שמור/י על לחות — שתיית מים משפרת ריכוז וזיכרון',
  'לימוד בקבוצות קטנות יכול להאיר זוויות חדשות',
];


const calcWeightedAvg = (grades: any[]) => {
  const valid = grades.filter(g => g.value > 0 && g.credits > 0);
  if (!valid.length) return null;
  return +(valid.reduce((s, g) => s + g.value * g.credits, 0) /
           valid.reduce((s, g) => s + g.credits, 0)).toFixed(1);
};

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ── Soft Ring ─────────────────────────────────────────────────────────────────
const RING_SIZE   = 82;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC   = 2 * Math.PI * RING_RADIUS;

const GlowRing = ({ pct, color, label, bgColor }: { pct: number; color: string; label: string; bgColor: string }) => {
  if (Platform.OS !== 'web') {
    const offset = RING_CIRC - (Math.min(pct, 100) / 100) * RING_CIRC;
    return (
      <View style={s.glowRingWrap}>
        <View style={{ width: RING_SIZE, height: RING_SIZE, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ position: 'absolute', width: RING_SIZE, height: RING_SIZE }}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Circle
                cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
                stroke="rgba(255,255,255,0.15)" strokeWidth={RING_STROKE} fill="none"
              />
              {pct > 0 && (
                <Circle
                  cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
                  stroke={color} strokeWidth={RING_STROKE} fill="none"
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  rotation={-90}
                  origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                />
              )}
            </Svg>
          </View>
          <View style={[s.glowRingInner, { backgroundColor: bgColor }]}>
            <Text style={[s.glowRingPct, { color }]}>{pct > 0 ? `${pct}%` : '--'}</Text>
          </View>
        </View>
        <Text style={[s.heroMetaLabel, { color: 'rgba(255,255,255,0.45)' }]}>{label}</Text>
      </View>
    );
  }

  const deg = Math.max(0, Math.min(360, pct * 3.6));
  return (
    <View style={s.glowRingWrap}>
      <View style={[
        s.glowRingOuter,
        {
          background: `conic-gradient(${color} ${deg}deg, rgba(255,255,255,0.12) ${deg}deg)`,
          boxShadow: '5px 5px 14px rgba(0,0,0,0.5), -3px -3px 8px rgba(255,255,255,0.07)',
        } as any
      ]}>
        <View style={[
          s.glowRingInner,
          { background: `radial-gradient(circle, ${bgColor} 30%, ${color}18 100%)` } as any
        ]}>
          <Text style={[s.glowRingPct, { color }]}>{pct > 0 ? `${pct}%` : '--'}</Text>
        </View>
      </View>
      <Text style={[s.heroMetaLabel, { color: 'rgba(255,255,255,0.45)' }]}>{label}</Text>
    </View>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────
const HomeScreen = () => {
  const theme      = useTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { showAlert, alertNode } = useCustomAlert(theme.accent);

  const [grades,          setGrades]         = useState<any[]>([]);
  const [tasks,           setTasks]          = useState<any[]>([]);
  const [events,          setEvents]         = useState<any[]>([]);
  const [requiredCredits, setRequiredCredits]= useState(0);
  const [refreshing,      setRefreshing]     = useState(false);
  const [userName,        setUserName]       = useState('');

  // ── Timer ─────────────────────────────────────────────────────────────────
  const [timerRunning,  setTimerRunning]  = useState(false);
  const [timerLeft,     setTimerLeft]     = useState(0);
  const [timerTotal,    setTimerTotal]    = useState(0);
  const [timerDone,     setTimerDone]     = useState(false);
  const [timerInput,    setTimerInput]    = useState('25');
  const doneRef           = useRef(false);
  const timerNotifId      = useRef<string | null>(null);
  const timerLeftRef      = useRef(0);
  const timerEndTime      = useRef<number | null>(null);
  const webTimeout        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNotifSchedule = useRef<number>(0);

  useEffect(() => { timerLeftRef.current = timerLeft; }, [timerLeft]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
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
        .catch(() => { const N = (globalThis as any).Notification; if (N?.permission === 'granted') new N(title, { body }); });
    } else {
      const N = (globalThis as any).Notification;
      if (N?.permission === 'granted') new N(title, { body });
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = () => {
      if ((document as any).visibilityState !== 'visible') return;
      if (!timerEndTime.current || doneRef.current) return;
      if (Date.now() >= timerEndTime.current) {
        doneRef.current = true; timerEndTime.current = null;
        if (webTimeout.current) { clearTimeout(webTimeout.current); webTimeout.current = null; }
        setTimerRunning(false); setTimerLeft(0); setTimerDone(true);
      } else {
        setTimerLeft(Math.ceil((timerEndTime.current - Date.now()) / 1000));
      }
    };
    (document as any).addEventListener('visibilitychange', handler);
    return () => (document as any).removeEventListener('visibilitychange', handler);
  }, []);

  // Mobile equivalent of the web visibilitychange handler: when the app
  // returns to foreground the interval may have been paused, so recalculate
  // remaining time (or fire completion) based on the absolute end timestamp.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      if (!timerEndTime.current || doneRef.current) return;
      const remaining = Math.ceil((timerEndTime.current - Date.now()) / 1000);
      if (remaining <= 0) {
        doneRef.current = true; timerEndTime.current = null;
        setTimerRunning(false); setTimerLeft(0); setTimerDone(true);
      } else {
        setTimerLeft(remaining);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!timerRunning) return;
    doneRef.current = false;
    const id = setInterval(() => {
      if (!timerEndTime.current) return;
      const remaining = Math.ceil((timerEndTime.current - Date.now()) / 1000);
      if (remaining <= 0 && !doneRef.current) {
        doneRef.current = true; clearInterval(id); timerEndTime.current = null;
        setTimerRunning(false); setTimerLeft(0); setTimerDone(true);
      } else if (remaining > 0) { setTimerLeft(remaining); }
    }, 500);
    return () => clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    return () => { if (webTimeout.current) { clearTimeout(webTimeout.current); webTimeout.current = null; } };
  }, []);

  useEffect(() => {
    if (!timerDone) return;
    timerNotifId.current = null;
    Vibration.vibrate([0, 400, 200, 400, 200, 400]);
    showAlert('⏰ הזמן הסתיים!', 'כל הכבוד! סיימת את פגישת הלימוד שלך.');
    fireWebNotif();
  }, [timerDone]);

  const handleTimerStart = async () => {
    const secs = timerLeft > 0 ? timerLeftRef.current : Math.max(1, parseInt(timerInput) || 25) * 60;
    if (timerLeft === 0) { setTimerLeft(secs); setTimerTotal(secs); }
    timerEndTime.current = Date.now() + secs * 1000;
    setTimerDone(false); setTimerRunning(true);
    const id = await scheduleTimerNotification(secs);
    if (id) timerNotifId.current = id;
    if (Platform.OS === 'web') {
      if (webTimeout.current) clearTimeout(webTimeout.current);
      // Backstop for backgrounded tabs, where setInterval gets throttled and may
      // never notice completion on its own. Goes through the same doneRef guard
      // and timerDone state as every other completion path (interval tick,
      // visibilitychange, AppState) so exactly one of them ends up firing the
      // notification, not both.
      webTimeout.current = setTimeout(() => {
        if (doneRef.current) return;
        doneRef.current = true; timerEndTime.current = null;
        setTimerRunning(false); setTimerLeft(0); setTimerDone(true);
      }, secs * 1000);
    }
  };

  const handleTimerPause = () => {
    setTimerRunning(false);
    if (timerNotifId.current) { cancelTimerNotification(timerNotifId.current); timerNotifId.current = null; }
    if (webTimeout.current)   { clearTimeout(webTimeout.current); webTimeout.current = null; }
    if (timerEndTime.current) {
      timerLeftRef.current = Math.max(0, Math.ceil((timerEndTime.current - Date.now()) / 1000));
      setTimerLeft(timerLeftRef.current);
      timerEndTime.current = null;
    }
  };

  const handleTimerReset = () => {
    setTimerRunning(false); setTimerLeft(0); setTimerTotal(0); setTimerDone(false);
    timerEndTime.current = null;
    if (timerNotifId.current) { cancelTimerNotification(timerNotifId.current); timerNotifId.current = null; }
    if (webTimeout.current)   { clearTimeout(webTimeout.current); webTimeout.current = null; }
  };

  const timerPct    = timerTotal > 0 ? Math.round(((timerTotal - timerLeft) / timerTotal) * 100) : 0;
  const timerBarPct = timerLeft > 0 && timerPct < 2 ? 2 : timerPct;  // always show a visible sliver

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  const loadAll = async () => {
    try {
      const user = auth.currentUser;
      const [g, t, e, snap] = await Promise.all([
        loadField('grades'), loadField('tasks'), loadField('schedule'),
        user ? getDoc(doc(db, 'users', user.uid)) : Promise.resolve(null),
      ]);
      // All setters in one batch — prevents a render with grades but without
      // requiredCredits that would briefly show avgPct instead of creditsPct.
      setGrades(g ?? []); setTasks(t ?? []); setEvents(e ?? []);
      if (snap && snap.exists()) {
        const d = snap.data();
        setRequiredCredits(+(d.requiredCredits ?? 0));
        setUserName(d.name || '');
      }
      // Reschedule at most once every 5 minutes — navigation triggers useFocusEffect
      // on every visit so without throttling every tab-switch rebuilds all notifications.
      if (Date.now() - lastNotifSchedule.current > 5 * 60_000) {
        await scheduleAllNotifications(t ?? [], e ?? []);
        scheduleWebEventReminders(e ?? []);
        lastNotifSchedule.current = Date.now();
        // scheduleAllNotifications cancels ALL notifications first; re-register
        // the study timer notification if it was still running.
        if (timerEndTime.current && Date.now() < timerEndTime.current) {
          const remaining = Math.ceil((timerEndTime.current - Date.now()) / 1000);
          const id = await scheduleTimerNotification(remaining);
          if (id) timerNotifId.current = id;
        }
      }
    } catch { }
  };

  const onRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };

  // ── Derived ───────────────────────────────────────────────────────────────
  const today      = new Date();
  const todayISO   = toISO(today);
  const tip        = STUDY_TIPS[today.getDay()];
  const todayLabel = `יום ${HEB_DAYS[today.getDay()]}, ${today.getDate()} ב${HEB_MONTHS[today.getMonth()]}`;
  const firstName  = userName ? userName.split(' ')[0] : '';

  const activeTasks  = tasks.filter(t => !t.completed);
  const completedCnt = tasks.filter(t => t.completed).length;
  const urgentTasks  = activeTasks
    .filter(t => { const d = daysUntil(t.dueDate); return d >= 0 && d <= 7; })
    .sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate));
  const todayEvents   = events.filter(e => occursOnISO(e, todayISO)).sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  const nowStr        = `${String(today.getHours()).padStart(2,'0')}:${String(today.getMinutes()).padStart(2,'0')}`;
  const upcomingEvents = todayEvents.filter(ev => (ev.endTime || ev.startTime) >= nowStr);
  const next7Dates    = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i + 1); return toISO(d); });
  const next7Events   = next7Dates.flatMap(iso => events.filter(e => occursOnISO(e, iso)));
  const avg           = calcWeightedAvg(grades);
  const avgPct        = avg ? Math.min(100, Math.round(avg)) : 0;
  const earnedCredits = grades.reduce((sum: number, g: any) => sum + (g.credits || 0), 0);
  const creditsPct    = requiredCredits > 0 ? Math.min(100, Math.round((earnedCredits / requiredCredits) * 100)) : 0;
  const ringPct       = creditsPct > 0 ? creditsPct : avgPct;

  const studyRecs = Array.from(new Set(urgentTasks.filter(t => t.course).map(t => t.course)))
    .map(course => {
      const nearest = urgentTasks.find(t => t.course === course)!;
      const days = daysUntil(nearest.dueDate);
      return { course, days, hours: Math.max(2, Math.min(8, Math.round((8 - days) * 1.2))), taskName: nearest.name };
    }).slice(0, 3);

  const urgentDayColor = (d: number) => d === 0 ? NEON_PINK : d <= 2 ? '#ffa94d' : NEON_GREEN;
  const urgentDayLabel = (d: number) => d === 0 ? 'היום!' : d === 1 ? 'מחר' : `${d} ימים`;

  // ── Render ────────────────────────────────────────────────────────────────
  const hasGradient  = !!theme.accentGradient && theme.mode === 'light';
  const cardBg       = theme.surface;
  const cardText     = theme.text;
  const cardSubText  = theme.textSub;

  // in dark mode add a subtle accent border so cards separate from bg
  const cardBorder: object = theme.mode === 'dark'
    ? { borderWidth: 1, borderColor: theme.border }
    : {};

  // dark mode: accent glow instead of white neumorphic shadow
  const neuCard: object = theme.mode === 'dark'
    ? (Platform.select({
        web: { boxShadow: `0 4px 20px ${theme.accent}30, 0 1px 6px rgba(0,0,0,0.5)` } as any,
        default: {
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 6,
        },
      }) ?? {})
    : NEU_OUTER;
  // hero colors: white card on gradient bg, accent card on plain bg
  const heroTxt      = hasGradient ? theme.text            : '#FFFFFF';
  const heroSub      = hasGradient ? theme.textSub         : 'rgba(255,255,255,0.5)';
  const heroDivider  = hasGradient ? 'rgba(0,0,0,0.08)'   : 'rgba(255,255,255,0.18)';
  const heroRingBg   = hasGradient ? '#FFFFFF'             : (theme.accentGradient?.[0] ?? theme.accent);
  const heroRingClr  = hasGradient ? theme.accent          : '#FFFFFF';
  const heroGradColors = (hasGradient
    ? (['#FFFFFF', '#FFFFFF'] as [string, string])
    : ([theme.accent, theme.accent] as [string, string]));

  const scrollContent = (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SOFT_TEAL} />}
    >

      {/* ══ HERO CARD ══════════════════════════════════════════════════════ */}
      <LinearGradient
        colors={heroGradColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[s.heroCard, hasGradient && (NEU_OUTER as any)]}
      >
        <View style={s.heroInner}>
          {/* LEFT — greeting */}
          <View style={s.heroLeft}>
            {firstName ? <Text style={[s.heroGreeting, { color: heroTxt }]}>שלום, {firstName} 🤍</Text> : null}
            <Text style={[s.heroDate, { color: heroSub }]}>{todayLabel}</Text>
          </View>
          {/* CENTER — average */}
          <View style={s.heroCenter}>
            <Text style={[s.heroStatBig, { color: heroTxt }]}>{avg ?? '--'}</Text>
            <Text style={[s.heroStatLabel, { color: heroSub }]}>ממוצע כללי</Text>
          </View>
          {/* RIGHT — ring */}
          <GlowRing pct={ringPct} color={heroRingClr} label="ציונים" bgColor={heroRingBg} />
        </View>

        <View style={[s.heroBottomRow, { borderTopColor: heroDivider }]}>
          <View style={s.heroBottomStat}>
            <Text style={[s.heroBottomNum, { color: heroTxt }]}>{activeTasks.length}</Text>
            <Text style={[s.heroBottomLabel, { color: heroSub }]}>מטלות פעילות</Text>
          </View>
          <View style={[s.heroBottomDivider, { backgroundColor: heroDivider }]} />
          <View style={s.heroBottomStat}>
            <Text style={[s.heroBottomNum, { color: heroTxt }]}>{next7Events.length}</Text>
            <Text style={[s.heroBottomLabel, { color: heroSub }]}>אירועים בשבוע</Text>
          </View>
          <View style={[s.heroBottomDivider, { backgroundColor: heroDivider }]} />
          <View style={s.heroBottomStat}>
            <Text style={[s.heroBottomNum, { color: heroTxt }]}>{earnedCredits}</Text>
            <Text style={[s.heroBottomLabel, { color: heroSub }]}>נ״ז נצברו</Text>
          </View>
        </View>
      </LinearGradient>

        {/* ══ TWO-COLUMN ROW ════════════════════════════════════════════════ */}
        <View style={s.cardsRow}>

          {/* LEFT — Deadlines */}
          <TouchableOpacity
            style={[s.lightCard, { flex: 2, marginBottom: 0, backgroundColor: cardBg }, neuCard as any, cardBorder as any]}
            onPress={() => navigation.navigate('Tasks')}
            activeOpacity={0.9}
          >
            <View style={s.cardTopRow}>
              <Text style={[s.cardMeta, { color: cardSubText }]}>{urgentTasks.length} השבוע</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="clipboard-alert-outline" size={15} color={theme.accent} />
                <Text style={[s.cardTitle, { color: theme.accent }]}>דדליינים</Text>
              </View>
            </View>

            {urgentTasks.length > 0 ? urgentTasks.slice(0, 3).map(task => {
              const d = daysUntil(task.dueDate);
              const col = urgentDayColor(d);
              return (
                <View key={task.id} style={[s.taskPill, { borderColor: col + '55', backgroundColor: col + '10' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.taskPillTitle, { color: cardText }]} numberOfLines={1}>{task.name}</Text>
                    {task.course ? <Text style={[s.taskPillSub, { color: cardSubText }]}>{task.course}</Text> : null}
                  </View>
                  <View style={[s.taskPillBadge, { backgroundColor: col + '22' }]}>
                    <Text style={[s.taskPillBadgeText, { color: col }]}>{urgentDayLabel(d)}</Text>
                  </View>
                </View>
              );
            }) : (
              <View style={s.miniStatsGrid}>
                {[
                  { icon: 'check-circle-outline'     as const, color: NEON_GREEN,  val: completedCnt,       label: 'הושלמו' },
                  { icon: 'clipboard-list-outline'   as const, color: NEON_BLUE,   val: activeTasks.length, label: 'פעילות' },
                  { icon: 'flag-outline'              as const, color: NEON_PINK,   val: urgentTasks.length, label: 'דחופות' },
                ].map(item => {
                  const c = item.val === 0 ? '#C0C0D0' : item.color;
                  return (
                    <View key={item.label} style={s.miniStatCell}>
                      <MaterialCommunityIcons name={item.icon} size={20} color={c} />
                      <Text style={[s.miniStatNum, { color: c }]}>{item.val}</Text>
                      <Text style={[s.miniStatLabel, { color: '#9299B8' }]}>{item.label}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {urgentTasks.length > 3 && (
              <Text style={s.cardMore}>עוד {urgentTasks.length - 3} →</Text>
            )}
          </TouchableOpacity>

          {/* RIGHT — Events */}
          <View style={[s.lightCard, { flex: 2, marginBottom: 0, backgroundColor: cardBg }, neuCard as any, cardBorder as any]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: upcomingEvents.length > 0 ? 8 : 0 }}>
                <MaterialCommunityIcons name="calendar-today" size={15} color={theme.accent} />
                <Text style={[s.cardTitle, { color: theme.accent }]}>אירועים היום</Text>
              </View>

              {upcomingEvents.length > 0 ? (
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {upcomingEvents.map((ev, i) => (
                    <TouchableOpacity
                      key={ev.id}
                      style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border }]}
                      onPress={() => navigation.navigate('Events')}
                      activeOpacity={0.85}
                    >
                      <View style={{ width: 3, height: 28, borderRadius: 2, backgroundColor: ev.color || NEON_BLUE, marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.eventTitle, { color: cardText }]} numberOfLines={1}>{ev.title}</Text>
                        <Text style={[s.eventTime, { color: ev.color || NEON_BLUE }]}>
                          {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-left" size={14} color={cardSubText} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <Text style={[s.eventTitle, { color: cardSubText }]}>
                  {todayEvents.length > 0 ? 'כל האירועים להיום הסתיימו ✓' : 'אין אירועים היום'}
                </Text>
              )}
          </View>
        </View>

        {/* ══ TIP STRIP ═════════════════════════════════════════════════════ */}
        <View style={[s.lightCard, { paddingVertical: 12, backgroundColor: cardBg }, neuCard as any, cardBorder as any]}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <MaterialCommunityIcons name="lightbulb-on-outline" size={15} color={theme.accent} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.accent }}>טיפ יומי</Text>
          </View>
          <Text style={[s.tipText, { color: cardSubText }]} numberOfLines={3}>{tip}</Text>
        </View>

        {/* ══ STUDY RECS ════════════════════════════════════════════════════ */}
        {studyRecs.length > 0 && (
          <View style={[s.lightCard, { backgroundColor: cardBg }, neuCard as any, cardBorder as any]}>
            <View style={s.cardTopRow}>
              <View />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="book-clock-outline" size={16} color={theme.accent} />
                <Text style={[s.cardTitle, { color: theme.accent }]}>המלצות לימוד</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {studyRecs.map((rec, i) => (
                <View key={i} style={[s.taskPill, { flex: 1, minWidth: 140, borderColor: theme.accent + '55', backgroundColor: theme.accent + '08' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.taskPillTitle, { color: cardText }]} numberOfLines={1}>{rec.course}</Text>
                    <Text style={[s.taskPillSub, { color: cardSubText }]}>{rec.hours} שע׳ · {rec.taskName} · {rec.days} ימים</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ══ TIMER ═════════════════════════════════════════════════════════ */}
        <View style={[s.lightCard, { backgroundColor: cardBg }, neuCard as any, cardBorder as any]}>
          <View style={s.cardTopRow}>
            <View />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons name="timer-outline" size={18} color={theme.accent} />
              <Text style={[s.cardTitle, { color: theme.accent }]}>טיימר ללימוד עצמי</Text>
              {timerDone && (
                <View style={[s.doneBadge, { backgroundColor: theme.accent + '22' }]}>
                  <Text style={[s.doneBadgeText, { color: theme.accent }]}>✓ הסתיים</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={[
            s.timerDisplay,
            { color: timerDone ? theme.accent : cardText },
          ]}>
            {timerLeft > 0 ? formatTime(timerLeft) : timerDone ? formatTime(0) : formatTime((parseInt(timerInput) || 25) * 60)}
          </Text>

          <Text style={s.timerStatus}>
            {timerRunning ? 'לומד...' : timerDone ? 'כל הכבוד!' : timerLeft > 0 ? 'בהפסקה' : 'מוכן להתחיל'}
          </Text>

          <View style={[s.timerBarBg, NEU_INSET as any]}>
            <View style={[s.timerBarFill, {
              width: `${timerBarPct}%` as any,
              backgroundColor: theme.accent,
            }]} />
          </View>

          {!timerRunning && timerLeft === 0 && (
            <View style={s.timerPresets}>
              {[15, 25, 45, 60].map(m => {
                const active = timerInput === String(m);
                return (
                  <TouchableOpacity
                    key={m}
                    style={[s.presetBtn, neuCard as any, cardBorder as any, { backgroundColor: cardBg }, active && { borderColor: theme.accent, borderWidth: 1.5 }]}
                    onPress={() => setTimerInput(String(m))}
                  >
                    <Text style={[s.presetText, { color: active ? theme.accent : cardSubText }]}>{m}</Text>
                  </TouchableOpacity>
                );
              })}
              <TextInput
                style={[s.timerInput, NEU_INSET as any, { backgroundColor: cardBg, color: cardText }]}
                value={timerInput}
                onChangeText={v => setTimerInput(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad" maxLength={3} textAlign="center"
                placeholderTextColor="#9299B8" placeholder="25"
              />
            </View>
          )}

          <View style={s.timerBtns}>
            {!timerRunning ? (
              <TouchableOpacity style={[s.timerStartBtn, { backgroundColor: theme.accent }]} onPress={handleTimerStart}>
                <MaterialCommunityIcons name="play" size={18} color="#fff" />
                <Text style={s.timerStartText}>{timerLeft > 0 ? 'המשך' : 'התחל'}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[s.timerPauseBtn, { borderColor: theme.accent }]} onPress={handleTimerPause}>
                <MaterialCommunityIcons name="pause" size={18} color={theme.accent} />
                <Text style={[s.timerPauseText, { color: theme.accent }]}>השהה</Text>
              </TouchableOpacity>
            )}
            {(timerLeft > 0 || timerDone) && (
              <TouchableOpacity
                accessibilityLabel="אפס טיימר"
                accessibilityRole="button"
                style={[s.timerResetBtn, neuCard as any, cardBorder as any, { backgroundColor: cardBg }]}
                onPress={handleTimerReset}
              >
                <MaterialCommunityIcons name="restart" size={18} color="#9299B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

    </ScrollView>
  );

  return hasGradient ? (
    <LinearGradient
      colors={theme.accentGradient!.map(c => hexToRgba(c, 0.6)) as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}
    >
      {scrollContent}
      {alertNode}
    </LinearGradient>
  ) : (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {scrollContent}
      {alertNode}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // ── Hero card (dark) ───────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: DARK_CARD,
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
    shadowColor: '#1A0A3A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.40,
    shadowRadius: 32,
    elevation: 14,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 12px 40px rgba(26,10,58,0.45)' } as any
      : {}),
  },
  heroInner:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 },
  heroLeft:    { width: 110, alignSelf: 'flex-start', paddingTop: 2 },
  heroGreeting:{ fontSize: 17, fontWeight: '700', color: '#fff', textAlign: 'right' },
  heroDate:    { fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'right', marginTop: 3 },
  heroCenter:  { flex: 1, alignItems: 'center' },
  heroStatBig: { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  heroStatLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 },
  heroMetaLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginTop: 6, textAlign: 'center' },

  heroBottomRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    marginTop: 20, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)',
  },
  heroBottomStat:    { flex: 1, alignItems: 'center' },
  heroBottomNum:     { fontSize: 20, fontWeight: '900', color: '#fff' },
  heroBottomLabel:   { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3, textAlign: 'center' },
  heroBottomDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)' },

  glowRingWrap:  { alignItems: 'center', width: 90 },
  glowRingOuter: { width: 82, height: 82, borderRadius: 41, justifyContent: 'center', alignItems: 'center' },
  glowRingInner: { width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center' },
  glowRingPct:   { fontSize: 14, fontWeight: '900' },

  // ── Light cards (neumorphic) ───────────────────────────────────────────────
  lightCard: {
    backgroundColor: PAGE_BG,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    ...NEU_OUTER,
  },

  cardsRow:    { flexDirection: 'row', gap: 12, marginBottom: 16 },
  cardTopRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle:   { fontSize: 13, fontWeight: '700' },
  cardMeta:    { fontSize: 10, fontWeight: '600', color: '#9299B8' },
  cardMore:    { fontSize: 11, fontWeight: '600', color: '#9299B8', textAlign: 'right', marginTop: 6 },

  // ── Mini stats grid ────────────────────────────────────────────────────────
  miniStatsGrid: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  miniStatCell:  { alignItems: 'center', gap: 4, flex: 1 },
  miniStatNum:   { fontSize: 22, fontWeight: '900' },
  miniStatLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Task pills ─────────────────────────────────────────────────────────────
  taskPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8,
  },
  taskPillTitle:     { fontSize: 12, fontWeight: '700', color: '#1A2052', textAlign: 'right' },
  taskPillSub:       { fontSize: 10, color: '#9299B8', marginTop: 2, textAlign: 'right' },
  taskPillBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  taskPillBadgeText: { fontSize: 10, fontWeight: '800' },

  // ── Events ────────────────────────────────────────────────────────────────
  eventsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 },
  eventsMeta:      { fontSize: 11, fontWeight: '600', color: '#9299B8' },
  eventVertRow: {
    backgroundColor: PAGE_BG,
    borderRadius: 12, padding: 10, marginBottom: 8,
    borderLeftWidth: 3, flexDirection: 'row', alignItems: 'center',
    ...NEU_OUTER,
  },
  eventTitle: { fontSize: 12, fontWeight: '700', color: '#1A2052', textAlign: 'right' },
  eventTime:  { fontSize: 10, color: '#9299B8', marginTop: 2, textAlign: 'right' },

  // ── Tip ───────────────────────────────────────────────────────────────────
  tipText: { flex: 1, fontSize: 13, lineHeight: 19, textAlign: 'right' },

  // ── Timer ─────────────────────────────────────────────────────────────────
  doneBadge:     { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  doneBadgeText: { fontSize: 11, fontWeight: '700' },

  timerDisplay: { fontSize: 52, fontWeight: '900', textAlign: 'center', letterSpacing: 2, marginTop: 2 },
  timerStatus:  { fontSize: 11, fontWeight: '700', textAlign: 'center', color: '#9299B8', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },

  timerBarBg:   { height: 8, borderRadius: 20, backgroundColor: PAGE_BG, overflow: 'hidden', marginVertical: 14 },
  timerBarFill: { height: 8, borderRadius: 20 },

  timerPresets: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, justifyContent: 'center' },
  presetBtn:    { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: PAGE_BG },
  presetText:   { fontSize: 12, fontWeight: '700' },
  timerInput:   { width: 52, height: 46, borderRadius: 23, backgroundColor: PAGE_BG, fontSize: 16, fontWeight: '700', color: '#1A2052', textAlign: 'center' },

  timerBtns:     { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' },
  timerStartBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14 },
  timerStartText:{ fontSize: 15, fontWeight: '800', color: '#fff' },
  timerPauseBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5 },
  timerPauseText:{ fontSize: 15, fontWeight: '800' },
  timerResetBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: PAGE_BG },
});

export default HomeScreen;
