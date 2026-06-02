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

// ── Design tokens ─────────────────────────────────────────────────────────────
const NEON_BLUE  = '#00E5FF';
const NEON_GREEN = '#00D4AA';
const NEON_PINK  = '#FF6B9D';
const PURPLE     = '#9B5CF6';
const HERO_BG    = '#1C1F2E';
const PAGE_BG    = '#EBF0FA';

// ── Constants ─────────────────────────────────────────────────────────────────
const HEB_DAYS   = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEB_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

const STUDY_TIPS = [
  'תלמדי בסביבה שקטה ללא הפרעות — הריכוז עולה ב-40%',
  'שיטת פומודורו: 25 דקות לימוד, 5 דקות הפסקה',
  'חזרה על חומר לפני השינה משפרת שינון לטווח ארוך',
  'הסבירי את החומר בקול רם — זה מחזק הבנה עמוקה',
  'חלקי חומר קשה למנות קטנות ובדקי את עצמך בסוף',
  'שמרי על לחות — שתיית מים משפרת ריכוז וזיכרון',
  'לימוד בקבוצות קטנות יכול להאיר זוויות חדשות',
];


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

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};



// ── Glow Ring — conic-gradient arc on web, border fallback on native ──────────
const GlowRing = ({ pct, color, label }: { pct: number; color: string; label: string }) => {
  const deg = Math.max(0, Math.min(360, pct * 3.6));
  return (
    <View style={s.glowRingWrap}>
      <View style={[
        s.glowRingOuter,
        Platform.OS === 'web'
          ? {
              background: `conic-gradient(${color} ${deg}deg, rgba(255,255,255,0.07) ${deg}deg)`,
              filter: `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 12px ${color}66)`,
            } as any
          : { borderColor: color, borderWidth: 4,
              shadowColor: color, shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }
      ]}>
        <View style={[s.glowRingInner, { backgroundColor: HERO_BG }]}>
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
  const navigation = useNavigation<any>();
  const { showAlert, alertNode } = useCustomAlert(theme.accent);

  const [grades,          setGrades]         = useState<any[]>([]);
  const [tasks,           setTasks]          = useState<any[]>([]);
  const [events,          setEvents]         = useState<any[]>([]);
  const [topics,          setTopics]         = useState<any[]>([]);
  const [requiredCredits, setRequiredCredits]= useState(0);
  const [refreshing,      setRefreshing]     = useState(false);
  const [userName,        setUserName]       = useState('');

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
      webTimeout.current = setTimeout(() => { fireWebNotif(); }, secs * 1000);
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

  const timerPct = timerTotal > 0 ? Math.round(((timerTotal - timerLeft) / timerTotal) * 100) : 0;

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  const loadAll = async () => {
    try {
      const [g, t, e, tp] = await Promise.all([
        loadField('grades'), loadField('tasks'), loadField('schedule'), loadField('topics'),
      ]);
      setGrades(g ?? []); setTasks(t ?? []); setEvents(e ?? []); setTopics(tp ?? []);
      scheduleAllNotifications(t ?? [], e ?? []);
      const user = auth.currentUser;
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          setRequiredCredits(+(d.requiredCredits ?? 0));
          setUserName(d.name || '');
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
  const firstName  = userName ? userName.split(' ')[0] : '';

  const activeTasks   = tasks.filter(t => !t.completed);
  const urgentTasks   = activeTasks
    .filter(t => { const d = daysUntil(t.dueDate); return d >= 0 && d <= 7; })
    .sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate));
  const todayEvents   = events.filter(e => occursOnISO(e, todayISO)).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const next7Dates    = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i + 1); return toISO(d); });
  const next7Events   = next7Dates.flatMap(iso => events.filter(e => occursOnISO(e, iso)));
  const avg           = calcWeightedAvg(grades);
  const avgPct        = avg ? Math.min(100, Math.round(avg)) : 0;
  const topicsReview  = topics.filter(t => t.needsReview).length;
  const earnedCredits = grades.reduce((s: number, g: any) => s + (g.credits || 0), 0);
  const creditsPct    = requiredCredits > 0 ? Math.min(100, Math.round((earnedCredits / requiredCredits) * 100)) : 0;
  const creditsLeft   = requiredCredits > 0 ? Math.max(0, requiredCredits - earnedCredits) : 0;
  const studyRecs     = Array.from(new Set(urgentTasks.filter(t => t.course).map(t => t.course)))
    .map(course => {
      const nearest = urgentTasks.find(t => t.course === course)!;
      const days = daysUntil(nearest.dueDate);
      return { course, days, hours: Math.max(2, Math.min(8, Math.round((8 - days) * 1.2))), taskName: nearest.name };
    }).slice(0, 3);

  const urgentDayColor = (d: number) => d === 0 ? NEON_PINK : d <= 2 ? '#ffa94d' : NEON_GREEN;
  const urgentDayLabel = (d: number) => d === 0 ? 'היום!' : d === 1 ? 'מחר' : `${d} ימים`;



  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NEON_BLUE} />}
    >

      {/* ══════════════════════════════════════════════════════════════════════
          HERO CARD — dark matte, neon glow
      ══════════════════════════════════════════════════════════════════════ */}
      <View style={s.heroCard}>

        <View style={s.heroInner}>

          {/* LEFT — greeting + date */}
          <View style={s.heroLeft}>
            {firstName ? <Text style={s.heroGreeting}>שלום, {firstName} 👋</Text> : null}
            <Text style={s.heroDate}>{todayLabel}</Text>
          </View>

          {/* CENTER — big average stat */}
          <View style={s.heroCenter}>
            <Text style={[s.heroStatBig, { textShadow: `0 0 18px ${NEON_BLUE}, 0 0 36px rgba(0,229,255,0.45)` } as any]}>{avg ?? '--'}</Text>
            <Text style={s.heroStatLabel}>AVERAGE SCORE</Text>
          </View>

          {/* RIGHT — progress ring (grades) */}
          <GlowRing pct={creditsPct > 0 ? creditsPct : avgPct} color={NEON_PINK} label="ציונים" />
        </View>

        {/* BOTTOM STATS ROW */}
        <View style={s.heroBottomRow}>
          <View style={s.heroBottomStat}>
            <Text style={s.heroBottomNum}>{activeTasks.length}</Text>
            <Text style={s.heroBottomLabel}>מטלות פעילות</Text>
          </View>
          <View style={s.heroBottomDivider} />
          <View style={s.heroBottomStat}>
            <Text style={s.heroBottomNum}>{next7Events.length}</Text>
            <Text style={s.heroBottomLabel}>אירועים בשבוע</Text>
          </View>
          <View style={s.heroBottomDivider} />
          <View style={s.heroBottomStat}>
            <Text style={s.heroBottomNum}>{earnedCredits}</Text>
            <Text style={s.heroBottomLabel}>נ"ז נצברו</Text>
          </View>
        </View>
      </View>

      {/* ══════════════════════════════════════════════════════════════════════
          DEADLINES — full-width card
      ══════════════════════════════════════════════════════════════════════ */}
      <TouchableOpacity style={s.contentCard} onPress={() => navigation.navigate('Tasks')} activeOpacity={0.9}>
        <View style={s.cardTopRow}>
          <Text style={s.cardLabel}>דדליינים</Text>
          <Text style={s.cardMeta}>{urgentTasks.length} השבוע</Text>
        </View>

        {urgentTasks.length > 0 ? urgentTasks.slice(0, 3).map(task => {
          const d = daysUntil(task.dueDate);
          const col = urgentDayColor(d);
          return (
            <View key={task.id} style={[s.taskPill, { borderColor: col + '55', backgroundColor: col + '10' }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.taskPillTitle} numberOfLines={1}>{task.name}</Text>
                {task.course ? <Text style={s.taskPillSub}>{task.course}</Text> : null}
              </View>
              <View style={[s.taskPillBadge, { backgroundColor: col + '22' }]}>
                <Text style={[s.taskPillBadgeText, { color: col }]}>{urgentDayLabel(d)}</Text>
              </View>
            </View>
          );
        }) : (
          <View style={[s.taskPill, { borderColor: NEON_GREEN + '55', backgroundColor: NEON_GREEN + '10' }]}>
            <Text style={[s.taskPillTitle, { color: NEON_GREEN }]}>אין דדליינים קרובים 🎉</Text>
          </View>
        )}

        {urgentTasks.length > 3 && (
          <Text style={s.cardMore}>עוד {urgentTasks.length - 3} מטלות →</Text>
        )}
      </TouchableOpacity>

      {/* ══════════════════════════════════════════════════════════════════════
          TODAY EVENTS — horizontal scrolling chips
      ══════════════════════════════════════════════════════════════════════ */}
      <View style={s.eventsSection}>
        <View style={s.eventsHeaderRow}>
          <Text style={s.eventsLabel}>אירועים היום</Text>
          <Text style={s.eventsMeta}>{todayEvents.length} היום</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsScroll}>
          {todayEvents.length > 0 ? todayEvents.map(ev => (
            <TouchableOpacity
              key={ev.id}
              style={[s.eventChip, { borderColor: (ev.color || NEON_BLUE) + '66', backgroundColor: (ev.color || NEON_BLUE) + '12' }]}
              onPress={() => navigation.navigate('Events')}
              activeOpacity={0.8}
            >
              <View style={[s.eventChipDot, { backgroundColor: ev.color || NEON_BLUE }]} />
              <Text style={[s.eventChipTime, { color: ev.color || NEON_BLUE }]}>
                {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
              </Text>
              <Text style={s.eventChipTitle} numberOfLines={2}>{ev.title}</Text>
            </TouchableOpacity>
          )) : (
            <View style={[s.eventChip, { borderColor: '#E8EDF5', backgroundColor: '#fff' }]}>
              <View style={[s.eventChipDot, { backgroundColor: '#ccc' }]} />
              <Text style={[s.eventChipTitle, { color: '#aaa' }]}>אין אירועים היום</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* ══════════════════════════════════════════════════════════════════════
          TIP — full-width flat strip
      ══════════════════════════════════════════════════════════════════════ */}
      <View style={[s.whiteCard, s.tipStrip]}>
        <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color={NEON_GREEN} />
        <Text style={{ fontSize: 12, fontWeight: '700', color: NEON_GREEN }}>טיפ יומי</Text>
        <Text style={[s.tipStripText, { color: theme.textSub }]} numberOfLines={2}>{tip}</Text>
      </View>

      {/* ══════════════════════════════════════════════════════════════════════
          RECS — conditional, full-width
      ══════════════════════════════════════════════════════════════════════ */}
      {studyRecs.length > 0 && (
        <View style={s.whiteCard}>
          <View style={s.whiteCardHeader}>
            <MaterialCommunityIcons name="book-clock-outline" size={16} color="#ffa94d" />
            <Text style={[s.whiteCardTitle, { color: '#ffa94d' }]}>המלצות לימוד</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {studyRecs.map((rec, i) => (
              <View key={i} style={[s.taskPill, { flex: 1, minWidth: 140, borderColor: '#ffa94d55', backgroundColor: '#ffa94d10' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.taskPillTitle} numberOfLines={1}>{rec.course}</Text>
                  <Text style={s.taskPillSub}>{rec.hours} שע׳ · {rec.taskName} · {rec.days} ימים</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STUDY TIMER
      ══════════════════════════════════════════════════════════════════════ */}
      <View style={s.whiteCard}>
        <View style={s.whiteCardHeader}>
          <MaterialCommunityIcons name="timer-outline" size={18} color={theme.accent} />
          <Text style={[s.whiteCardTitle, { color: theme.accent }]}>טיימר לימוד עצמי</Text>
          {timerDone && (
            <View style={s.doneBadge}>
              <Text style={s.doneBadgeText}>✓ הסתיים</Text>
            </View>
          )}
        </View>

        <Text style={[s.timerDisplay, { color: timerDone ? NEON_GREEN : timerLeft > 0 && timerLeft <= 60 ? NEON_PINK : theme.text } as any]}>
          {timerLeft > 0 ? formatTime(timerLeft) : timerDone ? formatTime(0) : formatTime((parseInt(timerInput) || 25) * 60)}
        </Text>
        <Text style={[s.timerStatus, { color: theme.textSub }]}>
          {timerRunning ? 'לומד...' : timerDone ? 'כל הכבוד!' : timerLeft > 0 ? 'בהפסקה' : 'מוכן להתחיל'}
        </Text>

        <View style={[s.timerBarBg, { backgroundColor: theme.accent + '22' }]}>
          <View style={[s.timerBarFill, { width: `${timerPct}%` as any, backgroundColor: timerDone ? NEON_GREEN : theme.accent }]} />
        </View>

        {!timerRunning && timerLeft === 0 && (
          <View style={s.timerPresets}>
            {[15, 25, 45, 60].map(m => (
              <TouchableOpacity
                key={m}
                style={[s.presetBtn, {
                  borderColor: timerInput === String(m) ? theme.accent : theme.border,
                  backgroundColor: timerInput === String(m) ? theme.accent + '18' : 'transparent',
                }]}
                onPress={() => setTimerInput(String(m))}
              >
                <Text style={[s.presetText, { color: timerInput === String(m) ? theme.accent : theme.textSub }]}>{m}</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={[s.timerInput, { borderColor: theme.border, color: theme.text }]}
              value={timerInput}
              onChangeText={v => setTimerInput(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad" maxLength={3} textAlign="center"
              placeholderTextColor={theme.textSub} placeholder="25"
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
            <TouchableOpacity style={[s.timerResetBtn, { borderColor: theme.border }]} onPress={handleTimerReset}>
              <MaterialCommunityIcons name="restart" size={18} color={theme.textSub} />
            </TouchableOpacity>
          )}
        </View>
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
  shadowRadius: 16,
  elevation: 4,
};

const s = StyleSheet.create({
  // ── Hero ───────────────────────────────────────────────────────────────────
  heroCard: {
    borderRadius: 24, padding: 20, marginBottom: 20,
    backgroundColor: HERO_BG,
    shadowColor: NEON_BLUE, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 10,
  },
  allStatsBtn: {
    position: 'absolute', top: 14, left: 14,
    backgroundColor: PURPLE, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20,
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8,
  },
  allStatsText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  heroInner:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  heroLeft:    { width: 90, justifyContent: 'center' },
  heroGreeting:{ fontSize: 13, fontWeight: '800', color: '#fff', textAlign: 'right' },
  heroDate:    { fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'right', marginTop: 3 },
  heroCenter:  { flex: 1, alignItems: 'center' },
  glowRingWrap:{ alignItems: 'center', width: 80 },

  heroBottomRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    marginTop: 20, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  heroBottomStat:    { flex: 1, alignItems: 'center' },
  heroBottomNum:     { fontSize: 20, fontWeight: '900', color: '#fff' },
  heroBottomLabel:   { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3, textAlign: 'center' },
  heroBottomDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)' },

  avatarGlowRing: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 2.5, borderColor: NEON_BLUE,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    shadowColor: NEON_BLUE, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 12,
    marginBottom: 8,
  },
  avatarImg:      { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,229,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 22, fontWeight: '900', color: NEON_BLUE },

  heroName:          { fontSize: 13, fontWeight: '800', color: '#fff', textAlign: 'center' },
  heroSubtitle:      { fontSize: 9, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 2 },
  heroStatsMiniRow:  { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5 },
  heroStatsMiniText: { fontSize: 9, color: NEON_BLUE, fontWeight: '600' },

  heroStatBig:   { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  heroStatLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 },
  heroMetaLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginTop: 6, textAlign: 'center' },

  // LED bars
  ledContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 44 },
  ledBar:       { width: 5, borderRadius: 3 },

  // Glow ring
  glowRingOuter: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  glowRingInner: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  glowRingPct:   { fontSize: 13, fontWeight: '900' },

  // ── Content cards ──────────────────────────────────────────────────────────
  cardsRow:    { flexDirection: 'row', gap: 12, marginBottom: 16 },
  contentCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 14, ...CARD_SHADOW },

  // ── Event chips ────────────────────────────────────────────────────────────
  eventsSection:   { marginBottom: 16 },
  eventsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 2 },
  eventsLabel:     { fontSize: 10, fontWeight: '700', color: '#9299B8', textTransform: 'uppercase', letterSpacing: 0.8 },
  eventsMeta:      { fontSize: 11, fontWeight: '600', color: '#9299B8' },
  chipsScroll:     { paddingBottom: 4, gap: 10 },
  eventChip: {
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
    minWidth: 130, maxWidth: 180,
    ...CARD_SHADOW,
  },
  eventChipDot:   { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
  eventChipTime:  { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  eventChipTitle: { fontSize: 12, fontWeight: '600', color: '#1A2052', lineHeight: 17 },
  cardTopRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardLabel:   { fontSize: 10, fontWeight: '800', color: '#1A2052', textTransform: 'uppercase', letterSpacing: 1 },
  cardMeta:    { fontSize: 10, fontWeight: '600', color: '#9299B8' },
  cardMore:    { fontSize: 11, fontWeight: '600', color: '#9299B8', textAlign: 'right', marginTop: 6 },

  taskPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8,
  },
  taskPillTitle:     { fontSize: 12, fontWeight: '700', color: '#1A2052', textAlign: 'right' },
  taskPillSub:       { fontSize: 10, color: '#9299B8', marginTop: 2, textAlign: 'right' },
  taskPillBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  taskPillBadgeText: { fontSize: 10, fontWeight: '800' },

  eventRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  eventColorBar: { width: 4, height: 40, borderRadius: 2 },
  eventTitle:    { fontSize: 12, fontWeight: '700', color: '#1A2052', textAlign: 'right' },
  eventTime:     { fontSize: 10, color: '#9299B8', marginTop: 2, textAlign: 'right' },

  // ── Timeline ───────────────────────────────────────────────────────────────
  timelineSection: { marginBottom: 16 },
  timelineHeader:  { fontSize: 10, fontWeight: '700', color: '#9299B8', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, textAlign: 'right' },
  timelineScroll:  { gap: 8, paddingBottom: 4, paddingTop: 16 },

  dayTab: {
    width: 72, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8,
    alignItems: 'center', gap: 3,
    backgroundColor: '#fff', ...CARD_SHADOW,
  },
  dayTabActive: {
    backgroundColor: NEON_GREEN,
    shadowColor: NEON_GREEN, shadowOpacity: 0.35, shadowRadius: 16,
  },
  dayTabBadge: {
    position: 'absolute', top: -12,
    backgroundColor: '#1C1F2E', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  dayTabBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  dayNum:          { fontSize: 22, fontWeight: '900', color: '#1A2052' },
  dayNumActive:    { color: '#fff' },
  dayMonth:        { fontSize: 9, fontWeight: '700', color: '#9299B8', textTransform: 'uppercase' },
  dayMonthActive:  { color: 'rgba(255,255,255,0.8)' },
  dayName:         { fontSize: 9, fontWeight: '600', color: '#9299B8' },
  dayNameActive:   { color: 'rgba(255,255,255,0.7)' },
  dayDot:          { width: 5, height: 5, borderRadius: 3, marginTop: 2 },

  // ── White card (timer, recs, tip) ──────────────────────────────────────────
  whiteCard:    { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 14, ...CARD_SHADOW },
  tipStrip:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderLeftWidth: 3, borderLeftColor: NEON_GREEN },
  tipStripText: { flex: 1, fontSize: 13, lineHeight: 19 },
  whiteCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  whiteCardTitle:  { fontSize: 13, fontWeight: '700' },
  doneBadge:       { marginLeft: 8, backgroundColor: NEON_GREEN + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  doneBadgeText:   { fontSize: 11, fontWeight: '700', color: NEON_GREEN },
  tipText:         { fontSize: 13, lineHeight: 21, color: '#1A2052', textAlign: 'right' },

  // ── Timer controls ─────────────────────────────────────────────────────────
  timerDisplay:  { fontSize: 52, fontWeight: '900', textAlign: 'center', letterSpacing: 2, marginTop: 2 },
  timerStatus:   { fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  timerBarBg:    { height: 6, borderRadius: 3, overflow: 'hidden', marginVertical: 14 },
  timerBarFill:  { height: 6, borderRadius: 3 },
  timerPresets:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  presetBtn:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  presetText:    { fontSize: 12, fontWeight: '700' },
  timerInput:    { width: 52, borderWidth: 1, borderRadius: 20, paddingVertical: 7, fontSize: 12, fontWeight: '700', textAlign: 'center', color: '#1A2052' },
  timerBtns:     { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' },
  timerStartBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14 },
  timerStartText:{ fontSize: 15, fontWeight: '800', color: '#fff' },
  timerPauseBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5 },
  timerPauseText:{ fontSize: 15, fontWeight: '800' },
  timerResetBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

export default HomeScreen;
