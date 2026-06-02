
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadField, saveField } from '../utils/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { useTheme } from '../context/ThemeContext';

interface CalendarEvent {
  id: number;
  title: string;
  date: string;
  endDate?: string;
  allDay?: boolean;
  startTime: string;
  endTime: string;
  color: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceEndDate?: string;
}

type ViewMode = 'day' | 'week' | 'month' | 'year';

const HEBREW_MONTHS = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
];
const HEBREW_DAYS_LONG = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const DAY_LABELS = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
const EVENT_COLORS = ['#B35A8A','#F6B7C7','#B6A5CE','#523F77','#7880AE','#A3BBD7'];
const RECURRENCE_OPTIONS: { key: CalendarEvent['recurrence']; label: string }[] = [
  { key: 'none',    label: 'ללא' },
  { key: 'daily',   label: 'יומי' },
  { key: 'weekly',  label: 'שבועי' },
  { key: 'monthly', label: 'חודשי' },
  { key: 'yearly',  label: 'שנתי' },
];
const VIEW_TABS: { mode: ViewMode; label: string }[] = [
  { mode: 'day',   label: 'יומי' },
  { mode: 'week',  label: 'שבועי' },
  { mode: 'month', label: 'חודשי' },
  { mode: 'year',  label: 'שנתי' },
];

const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS   = Array.from({ length: 16 }, (_, i) => THIS_YEAR - 5 + i);
const HOUR_OPTIONS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const USABLE_H  = SCREEN_H - 148;
const CAL_TOP_H = 44;
const DAY_ROW_H = 26;
const GRID_ROWS = 6;
const CELL_H    = Math.floor((USABLE_H * 0.70 - CAL_TOP_H - DAY_ROW_H) / GRID_ROWS);

// ── Date helpers ──────────────────────────────────────────────────────────────
const toISO = (d: Date) => {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

const localDate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (iso: string, n: number): string => {
  const d = localDate(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

const weekStartISO = (iso: string): string => {
  const d = localDate(iso);
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  return toISO(d);
};

const daysBetween = (iso1: string, iso2: string): number =>
  Math.round((localDate(iso2).getTime() - localDate(iso1).getTime()) / 86_400_000);

const occursOn = (event: CalendarEvent, iso: string): boolean => {
  if (event.endDate && iso >= event.date && iso <= event.endDate) return true;
  if (iso < event.date) return false;
  if (event.recurrenceEndDate && iso > event.recurrenceEndDate) return false;
  switch (event.recurrence) {
    case 'none':    return iso === event.date;
    case 'daily':   return true;
    case 'weekly':  return daysBetween(event.date, iso) % 7 === 0;
    case 'monthly': return iso.slice(8) === event.date.slice(8);
    case 'yearly':  return iso.slice(5) === event.date.slice(5);
    default:        return false;
  }
};

// ── Picker helpers ────────────────────────────────────────────────────────────
type PickerTarget = 'date' | 'endDate' | 'startTime' | 'endTime' | 'recurrenceEnd';

const timeStringToDate = (s: string): Date => {
  const parts = s ? s.split(':').map(Number) : [];
  const h = parts[0] ?? 9; const m = parts[1] ?? 0;
  const d = new Date();
  d.setHours(isNaN(h) ? 9 : h, isNaN(m) ? 0 : m, 0, 0);
  return d;
};

const dateToTimeString = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const parseDateParts = (iso: string) => {
  if (!isValidDate(iso)) {
    const n = new Date();
    return { day: n.getDate(), month: n.getMonth() + 1, year: n.getFullYear() };
  }
  const [y, m, d] = iso.split('-').map(Number);
  return { day: d, month: m, year: y };
};

const buildDateISO = (day: number, month: number, year: number): string => {
  const maxDay = new Date(year, month, 0).getDate();
  const d = Math.max(1, Math.min(day, maxDay));
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

const parseTimeParts = (t: string) => {
  const parts = t ? t.split(':').map(Number) : [];
  const h = parts[0]; const m = parts[1];
  return {
    hour:   !isNaN(h) && h >= 0 && h <= 23 ? h : 9,
    minute: !isNaN(m) && m >= 0 && m <= 59 ? m : 0,
  };
};

const snapMinute = (m: number) =>
  MINUTE_OPTIONS.reduce((prev, cur) => Math.abs(cur - m) < Math.abs(prev - m) ? cur : prev, 0);

const addOneHour = (timeStr: string): string => {
  const { hour, minute } = parseTimeParts(timeStr);
  return `${String(Math.min(hour + 1, 23)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

// ── Component ─────────────────────────────────────────────────────────────────
const ScheduleScreen = () => {
  const themeObj  = useTheme();
  const theme     = themeObj.accent;
  const bg        = themeObj.bg;
  const surface   = themeObj.surface;
  const tabBg     = themeObj.tabBg;
  const textColor = themeObj.text;
  const textSub   = themeObj.textSub;
  const borderClr = themeObj.border;
  const light     = theme + '22';
  const { showAlert, showDestructiveConfirm, alertNode } = useCustomAlert(theme);
  const todayDate = new Date();
  const todayISO  = toISO(todayDate);

  const [viewMode, setViewMode]   = useState<ViewMode>('month');
  const [year,  setYear]  = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerYear,    setPickerYear]    = useState(todayDate.getFullYear());

  const [modalVisible,        setModalVisible]        = useState(false);
  const [editingId,           setEditingId]           = useState<number | null>(null);
  const [eventTitle,          setEventTitle]          = useState('');
  const [eventDate,           setEventDate]           = useState(todayISO);
  const [eventEndDate,        setEventEndDate]        = useState('');
  const [eventAllDay,         setEventAllDay]         = useState(false);
  const [eventStartTime,      setEventStartTime]      = useState('09:00');
  const [eventEndTime,        setEventEndTime]        = useState('10:00');
  const [eventColor,          setEventColor]          = useState(EVENT_COLORS[0]);
  const [eventRecurrence,     setEventRecurrence]     = useState<CalendarEvent['recurrence']>('none');
  const [eventRecurrenceEnd,  setEventRecurrenceEnd]  = useState('');

  const [dtPickerTarget,   setDtPickerTarget]   = useState<PickerTarget | null>(null);
  const [dtPickerTempDate, setDtPickerTempDate] = useState<Date>(new Date());

  useFocusEffect(useCallback(() => { loadEvents(); }, []));

  const loadEvents = async () => {
    try {
      const data = await loadField('schedule');
      if (data) {
        const parsed = data.map((e: any) => ({
          ...e,
          startTime: e.startTime ?? e.time ?? '09:00',
          endTime:   e.endTime   ?? '',
        }));
        setEvents(parsed);
      }
    } catch (e) { console.log(e); }
  };

  const persist = async (updated: CalendarEvent[]) => saveField('schedule', updated);

  // ── Month navigation ──────────────────────────────────────────────────────
  const goToPrev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const goToNext = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };
  const goToToday = () => {
    setYear(todayDate.getFullYear());
    setMonth(todayDate.getMonth());
    setSelectedDate(todayISO);
  };
  const pickMonthYear = (m: number) => {
    setMonth(m); setYear(pickerYear); setPickerVisible(false);
  };

  // ── Calendar grid ─────────────────────────────────────────────────────────
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth    = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const cellISO      = (day: number) => toISO(new Date(year, month, day));
  const eventsOnDay  = (day: number) => events.filter(e => occursOn(e, cellISO(day)));
  const selectedEvts = events
    .filter(e => occursOn(e, selectedDate))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // ── Week view data ────────────────────────────────────────────────────────
  const wkStart = weekStartISO(selectedDate);
  const weekDayISOs = Array.from({ length: 7 }, (_, i) => addDays(wkStart, i));

  // ── Form helpers ──────────────────────────────────────────────────────────
  const handleStartTimeChange = (newTime: string) => {
    setEventStartTime(newTime);
    setEventEndTime(addOneHour(newTime));
  };

  const resetForm = () => {
    setEditingId(null);
    setEventTitle(''); setEventDate(selectedDate);
    setEventEndDate(''); setEventAllDay(false);
    setEventStartTime('09:00'); setEventEndTime('10:00');
    setEventColor(EVENT_COLORS[0]); setEventRecurrence('none');
    setEventRecurrenceEnd('');
  };

  const openAdd  = () => { resetForm(); setModalVisible(true); };

  const openEdit = (ev: CalendarEvent) => {
    setEditingId(ev.id);
    setEventTitle(ev.title);
    setEventDate(ev.date);
    setEventEndDate(ev.endDate ?? '');
    setEventAllDay(ev.allDay ?? false);
    setEventStartTime(ev.startTime || '09:00');
    setEventEndTime(ev.endTime || addOneHour(ev.startTime || '09:00'));
    setEventColor(ev.color);
    setEventRecurrence(ev.recurrence);
    setEventRecurrenceEnd(ev.recurrenceEndDate ?? '');
    setModalVisible(true);
  };

  // ── Native picker ─────────────────────────────────────────────────────────
  const getPickerInitialDate = (target: PickerTarget): Date => {
    switch (target) {
      case 'date':          return isValidDate(eventDate) ? localDate(eventDate) : new Date();
      case 'endDate':       return isValidDate(eventEndDate) ? localDate(eventEndDate) : isValidDate(eventDate) ? localDate(eventDate) : new Date();
      case 'startTime':     return timeStringToDate(eventStartTime || '09:00');
      case 'endTime': {
        if (eventEndTime) return timeStringToDate(eventEndTime);
        const s = timeStringToDate(eventStartTime || '09:00');
        s.setHours(Math.min(s.getHours() + 1, 23));
        return s;
      }
      case 'recurrenceEnd': return isValidDate(eventRecurrenceEnd) ? localDate(eventRecurrenceEnd) : isValidDate(eventDate) ? localDate(eventDate) : new Date();
    }
  };

  const openDtPicker = (target: PickerTarget) => {
    setDtPickerTempDate(getPickerInitialDate(target));
    setDtPickerTarget(target);
  };

  const applyPickerValue = (target: PickerTarget, date: Date) => {
    switch (target) {
      case 'date':          setEventDate(toISO(date));             break;
      case 'endDate':       setEventEndDate(toISO(date));          break;
      case 'startTime':     handleStartTimeChange(dateToTimeString(date)); break;
      case 'endTime':       setEventEndTime(dateToTimeString(date));   break;
      case 'recurrenceEnd': setEventRecurrenceEnd(toISO(date));    break;
    }
  };

  const onDtPickerChange = (ev: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setDtPickerTarget(null);
      if (ev.type === 'set' && date && dtPickerTarget) applyPickerValue(dtPickerTarget, date);
    } else {
      if (date) setDtPickerTempDate(date);
    }
  };

  const confirmDtPicker = () => {
    if (dtPickerTarget) applyPickerValue(dtPickerTarget, dtPickerTempDate);
    setDtPickerTarget(null);
  };
  const cancelDtPicker  = () => setDtPickerTarget(null);
  const dtPickerMode    = (t: PickerTarget): 'date' | 'time' => t === 'startTime' || t === 'endTime' ? 'time' : 'date';
  const dtPickerTitle   = (t: PickerTarget) =>
    ({ date: 'תאריך התחלה', endDate: 'תאריך סיום', startTime: 'שעת התחלה', endTime: 'שעת סיום', recurrenceEnd: 'תאריך סיום חזרתיות' }[t]);

  // ── Web pickers ───────────────────────────────────────────────────────────
  const WebDatePicker = ({ iso, onChange, minISO }: { iso: string; onChange: (v: string) => void; minISO?: string }) => {
    const { day, month: m, year: y } = parseDateParts(iso);
    const maxDay   = new Date(y, m, 0).getDate();
    const minParts = minISO && isValidDate(minISO) ? parseDateParts(minISO) : null;
    return (
      <View style={styles.webPickerRow}>
        <View style={styles.webPickerCol}>
          <Text style={styles.webPickerSubLabel}>שנה</Text>
          <Picker selectedValue={y} onValueChange={newY => onChange(buildDateISO(day, m, Number(newY)))} style={[styles.webPickerBase, styles.webPickerYear]}>
            {YEAR_OPTIONS.filter(yr => !minParts || yr >= minParts.year).map(yr => <Picker.Item key={yr} label={String(yr)} value={yr} />)}
          </Picker>
        </View>
        <View style={styles.webPickerCol}>
          <Text style={styles.webPickerSubLabel}>חודש</Text>
          <Picker selectedValue={m} onValueChange={newM => onChange(buildDateISO(day, Number(newM), y))} style={[styles.webPickerBase, styles.webPickerMonth]}>
            {HEBREW_MONTHS.map((name, i) => <Picker.Item key={i} label={name} value={i + 1} />)}
          </Picker>
        </View>
        <View style={styles.webPickerCol}>
          <Text style={styles.webPickerSubLabel}>יום</Text>
          <Picker selectedValue={day} onValueChange={d => onChange(buildDateISO(Number(d), m, y))} style={[styles.webPickerBase, styles.webPickerDay]}>
            {Array.from({ length: maxDay }, (_, i) => i + 1).map(d => <Picker.Item key={d} label={String(d)} value={d} />)}
          </Picker>
        </View>
      </View>
    );
  };

  const WebTimePicker = ({ time, onChange }: { time: string; onChange: (v: string) => void }) => {
    const { hour, minute } = parseTimeParts(time);
    return (
      <View style={styles.webPickerRow}>
        <View style={styles.webPickerCol}>
          <Text style={styles.webPickerSubLabel}>שעה</Text>
          <Picker selectedValue={hour} onValueChange={h => onChange(`${String(Number(h)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)} style={[styles.webPickerBase, styles.webPickerHour]}>
            {HOUR_OPTIONS.map(h => <Picker.Item key={h} label={String(h).padStart(2, '0')} value={h} />)}
          </Picker>
        </View>
        <View style={styles.webPickerColonWrap}>
          <Text style={[styles.webPickerColon, { color: theme }]}>:</Text>
        </View>
        <View style={styles.webPickerCol}>
          <Text style={styles.webPickerSubLabel}>דקות</Text>
          <Picker selectedValue={snapMinute(minute)} onValueChange={min => onChange(`${String(hour).padStart(2, '0')}:${String(Number(min)).padStart(2, '0')}`)} style={[styles.webPickerBase, styles.webPickerMinute]}>
            {MINUTE_OPTIONS.map(m => <Picker.Item key={m} label={String(m).padStart(2, '0')} value={m} />)}
          </Picker>
        </View>
      </View>
    );
  };

  // ── Save / delete ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!eventTitle.trim()) { showAlert('שגיאה', 'אנא הזן שם לאירוע'); return; }
    if (!isValidDate(eventDate)) { showAlert('שגיאה', 'תאריך לא תקין'); return; }
    if (eventEndDate && isValidDate(eventEndDate) && eventEndDate < eventDate) {
      showAlert('שגיאה', 'תאריך הסיום לא יכול להיות לפני תאריך ההתחלה'); return;
    }
    const multiDay = eventEndDate && isValidDate(eventEndDate) && eventEndDate > eventDate;
    if (!eventAllDay && !multiDay && eventEndTime <= eventStartTime) {
      showAlert('שגיאה', 'שעת הסיום חייבת להיות אחרי שעת ההתחלה'); return;
    }
    if (eventRecurrenceEnd && isValidDate(eventRecurrenceEnd) && eventRecurrenceEnd < eventDate) {
      showAlert('שגיאה', 'תאריך סיום החזרתיות לא יכול להיות לפני תאריך האירוע'); return;
    }
    const saved: CalendarEvent = {
      id: editingId ?? Date.now(),
      title: eventTitle.trim(),
      date:  eventDate,
      ...(eventEndDate && isValidDate(eventEndDate) ? { endDate: eventEndDate } : {}),
      allDay:    eventAllDay,
      startTime: eventAllDay ? '' : eventStartTime,
      endTime:   eventAllDay ? '' : eventEndTime,
      color:     eventColor,
      recurrence: eventRecurrence,
      ...(eventRecurrence !== 'none' && eventRecurrenceEnd ? { recurrenceEndDate: eventRecurrenceEnd } : {}),
    };
    const updated = editingId !== null ? events.map(e => e.id === editingId ? saved : e) : [...events, saved];
    setEvents(updated);
    try { await persist(updated); setModalVisible(false); }
    catch { showAlert('שגיאה', 'שמירה נכשלה'); }
  };

  const handleDelete = (id: number) => {
    showDestructiveConfirm('מחיקת אירוע', 'האם אתה בטוח שברצונך למחוק את האירוע?', 'מחק', async () => {
      const updated = events.filter(e => e.id !== id);
      setEvents(updated); await persist(updated);
    });
  };

  const fmtDate = (iso: string) => iso.split('-').reverse().join('/');

  // ── Shared event item render (used in day, week, month views) ─────────────
  const renderEventItem = (ev: CalendarEvent) => {
    const recurLabel = RECURRENCE_OPTIONS.find(r => r.key === ev.recurrence)?.label;
    const timeRange  = ev.allDay ? 'כל היום' : ev.endTime ? `${ev.startTime} – ${ev.endTime}` : ev.startTime;
    const dateRange  = ev.endDate ? `${fmtDate(ev.date)} – ${fmtDate(ev.endDate)}` : null;
    return (
      <View key={ev.id} style={[styles.eventItem, { borderRightColor: ev.color, backgroundColor: surface }]}>
        <View style={styles.eventBody}>
          <Text style={[styles.eventTitle, { color: textColor }]}>{ev.title}</Text>
          <View style={styles.eventMeta}>
            <Text style={[styles.eventTime, { color: theme }]}>{timeRange}</Text>
            {dateRange && <Text style={[styles.eventRecur, { color: textSub }]}>📅 {dateRange}</Text>}
            {ev.recurrence !== 'none' && (
              <Text style={styles.eventRecur}>
                🔁 {recurLabel}{ev.recurrenceEndDate ? ` עד ${fmtDate(ev.recurrenceEndDate)}` : ''}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.eventActions}>
          <TouchableOpacity onPress={() => openEdit(ev)} style={styles.actionBtn}>
            <MaterialCommunityIcons name="pencil-outline" size={18} color={theme} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(ev.id)} style={styles.actionBtn}>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color="#ff6b6b" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ── Mini month (year view) ────────────────────────────────────────────────
  const renderMiniMonth = (m: number, y: number) => {
    const firstDay   = new Date(y, m, 1).getDay();
    const days       = new Date(y, m + 1, 0).getDate();
    const miniCells: (number | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: days }, (_, i) => i + 1),
    ];
    while (miniCells.length % 7 !== 0) miniCells.push(null);
    const isCurrentMonth = y === year && m === month;
    return (
      <TouchableOpacity
        key={m}
        style={[styles.miniMonth, { backgroundColor: surface, borderColor: isCurrentMonth ? theme : borderClr }]}
        onPress={() => { setMonth(m); setYear(y); setViewMode('month'); }}
        activeOpacity={0.8}
      >
        <Text style={[styles.miniMonthTitle, { color: isCurrentMonth ? theme : textColor }]}>
          {HEBREW_MONTHS[m]}
        </Text>
        <View style={styles.miniDayRow}>
          {DAY_LABELS.map(l => (
            <Text key={l} style={[styles.miniDayLabel, { color: textSub }]}>{l[0]}</Text>
          ))}
        </View>
        <View style={styles.miniGrid}>
          {miniCells.map((day, idx) => {
            if (!day) return <View key={idx} style={styles.miniCell} />;
            const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasEv  = events.some(e => occursOn(e, iso));
            const isToday = iso === todayISO;
            return (
              <View key={idx} style={[styles.miniCell, isToday && { backgroundColor: theme, borderRadius: 4 }]}>
                <Text style={[styles.miniCellText, { color: isToday ? (themeObj.mode === 'dark' ? '#000' : '#fff') : textColor }]}>
                  {day}
                </Text>
                {hasEv && !isToday && <View style={[styles.miniDot, { backgroundColor: theme }]} />}
              </View>
            );
          })}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>

      {/* View mode tab bar */}
      <View style={[styles.viewTabBar, { backgroundColor: bg, borderBottomColor: borderClr }]}>
        {VIEW_TABS.map(tab => {
          const active = viewMode === tab.mode;
          return (
            <TouchableOpacity
              key={tab.mode}
              style={[styles.viewTab, { borderColor: active ? theme : borderClr, backgroundColor: active ? theme : surface }]}
              onPress={() => setViewMode(tab.mode)}
              activeOpacity={0.75}
            >
              <Text style={[styles.viewTabText, { color: active ? (themeObj.mode === 'dark' ? '#000' : '#fff') : textSub }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── DAY VIEW ────────────────────────────────────────────────────── */}
      {viewMode === 'day' && (
        <>
          <View style={[styles.navBar, { borderBottomColor: borderClr }]}>
            <TouchableOpacity onPress={() => setSelectedDate(addDays(selectedDate, -1))} style={styles.navBtn}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectedDate(todayISO)} style={[styles.todayBtn, { backgroundColor: theme }]}>
              <Text style={styles.todayBtnText}>היום</Text>
            </TouchableOpacity>
            <Text style={[styles.navTitle, { color: textColor }]}>
              {HEBREW_DAYS_LONG[localDate(selectedDate).getDay()]}, {fmtDate(selectedDate)}
            </Text>
            <TouchableOpacity onPress={() => setSelectedDate(addDays(selectedDate, 1))} style={styles.navBtn}>
              <MaterialCommunityIcons name="chevron-left" size={24} color={theme} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.eventsScroll} contentContainerStyle={styles.eventsContent}>
            {selectedEvts.length === 0 ? (
              <Text style={[styles.noEventsText, { color: textSub }]}>אין אירועים ביום זה. לחץ + להוספה</Text>
            ) : (
              selectedEvts.map(ev => renderEventItem(ev))
            )}
          </ScrollView>
        </>
      )}

      {/* ─── WEEK VIEW ───────────────────────────────────────────────────── */}
      {viewMode === 'week' && (
        <>
          <View style={[styles.navBar, { borderBottomColor: borderClr }]}>
            <TouchableOpacity onPress={() => setSelectedDate(addDays(wkStart, -7))} style={styles.navBtn}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectedDate(todayISO)} style={[styles.todayBtn, { backgroundColor: theme }]}>
              <Text style={styles.todayBtnText}>היום</Text>
            </TouchableOpacity>
            <Text style={[styles.navTitle, { color: textColor }]}>
              {fmtDate(weekDayISOs[0])} – {fmtDate(weekDayISOs[6])}
            </Text>
            <TouchableOpacity onPress={() => setSelectedDate(addDays(wkStart, 7))} style={styles.navBtn}>
              <MaterialCommunityIcons name="chevron-left" size={24} color={theme} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.eventsScroll} contentContainerStyle={{ paddingBottom: 80 }}>
            {weekDayISOs.map(iso => {
              const dayEvts = events.filter(e => occursOn(e, iso)).sort((a, b) => a.startTime.localeCompare(b.startTime));
              const dow     = localDate(iso).getDay();
              const isToday = iso === todayISO;
              return (
                <View key={iso}>
                  <TouchableOpacity
                    style={[styles.weekDayHeader, { borderBottomColor: borderClr, backgroundColor: isToday ? light : 'transparent' }]}
                    onPress={() => { setSelectedDate(iso); setViewMode('day'); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.weekDayName, { color: isToday ? theme : textColor }]}>
                      {HEBREW_DAYS_LONG[dow]}, {fmtDate(iso)}
                    </Text>
                    {dayEvts.length > 0 && (
                      <Text style={[styles.weekDayCount, { color: theme }]}>{dayEvts.length} אירועים</Text>
                    )}
                  </TouchableOpacity>
                  {dayEvts.length === 0 ? (
                    <Text style={[styles.weekNoEventsText, { color: textSub }]}>אין אירועים</Text>
                  ) : (
                    <View style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
                      {dayEvts.map(ev => renderEventItem(ev))}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* ─── MONTH VIEW ──────────────────────────────────────────────────── */}
      {viewMode === 'month' && (
        <>
          <View style={[styles.calBlock, { backgroundColor: surface, borderBottomColor: borderClr }]}>
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={goToPrev} style={styles.navBtn}>
                <MaterialCommunityIcons name="chevron-right" size={24} color={theme} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.monthYearBtn} onPress={() => { setPickerYear(year); setPickerVisible(true); }}>
                <Text style={[styles.monthLabel, { color: textColor }]}>{HEBREW_MONTHS[month]} {year}</Text>
                <MaterialCommunityIcons name="menu-down" size={18} color={theme} />
              </TouchableOpacity>
              <TouchableOpacity onPress={goToNext} style={styles.navBtn}>
                <MaterialCommunityIcons name="chevron-left" size={24} color={theme} />
              </TouchableOpacity>
              <TouchableOpacity onPress={goToToday} style={[styles.todayBtn, { backgroundColor: theme }]}>
                <Text style={styles.todayBtnText}>היום</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dayLabelRow}>
              {DAY_LABELS.map(h => <Text key={h} style={[styles.dayLabelText, { color: textSub }]}>{h}</Text>)}
            </View>
            <View style={styles.grid}>
              {cells.map((day, idx) => {
                if (!day) return <View key={`e-${idx}`} style={styles.cell} />;
                const iso        = cellISO(day);
                const isSelected = iso === selectedDate;
                const isToday    = iso === todayISO;
                const dots       = eventsOnDay(day).slice(0, 3);
                return (
                  <TouchableOpacity
                    key={iso}
                    style={[
                      styles.cell,
                      isToday && !isSelected && styles.cellToday,
                      isToday && !isSelected && { backgroundColor: light },
                      isSelected && styles.cellSelected,
                      isSelected && { backgroundColor: theme },
                    ]}
                    onPress={() => setSelectedDate(iso)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.cellText, { color: textColor },
                      isToday && !isSelected && styles.cellTextToday,
                      isToday && !isSelected && { color: theme },
                      isSelected && styles.cellTextSelected,
                    ]}>
                      {day}
                    </Text>
                    {dots.length > 0 && (
                      <View style={styles.dotRow}>
                        {dots.map((e, i) => <View key={i} style={[styles.dot, { backgroundColor: e.color }]} />)}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <ScrollView style={styles.eventsScroll} contentContainerStyle={styles.eventsContent}>
            <Text style={[styles.eventsSectionTitle, { color: textColor }]}>
              אירועים ל-{fmtDate(selectedDate)}
            </Text>
            {selectedEvts.length === 0 ? (
              <Text style={[styles.noEventsText, { color: textSub }]}>אין אירועים ביום זה. לחץ + להוספה</Text>
            ) : (
              selectedEvts.map(ev => renderEventItem(ev))
            )}
          </ScrollView>
        </>
      )}

      {/* ─── YEAR VIEW ───────────────────────────────────────────────────── */}
      {viewMode === 'year' && (
        <>
          <View style={[styles.navBar, { borderBottomColor: borderClr }]}>
            <TouchableOpacity onPress={() => setYear(y => y - 1)} style={styles.navBtn}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setYear(todayDate.getFullYear()); }} style={[styles.todayBtn, { backgroundColor: theme }]}>
              <Text style={styles.todayBtnText}>השנה</Text>
            </TouchableOpacity>
            <Text style={[styles.navTitle, { color: textColor }]}>{year}</Text>
            <TouchableOpacity onPress={() => setYear(y => y + 1)} style={styles.navBtn}>
              <MaterialCommunityIcons name="chevron-left" size={24} color={theme} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.yearGrid}>
            {Array.from({ length: 12 }, (_, m) => renderMiniMonth(m, year))}
          </ScrollView>
        </>
      )}

      {/* FAB */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: theme, shadowColor: theme }]} onPress={openAdd}>
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ─── Month/Year picker ────────────────────────────────────────────── */}
      <Modal visible={pickerVisible} animationType="fade" transparent>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <View style={[styles.pickerBox, { backgroundColor: tabBg }]} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerYearRow}>
              <TouchableOpacity onPress={() => setPickerYear(y => y - 1)} style={styles.pickerYearBtn}>
                <MaterialCommunityIcons name="chevron-right" size={22} color={theme} />
              </TouchableOpacity>
              <Text style={[styles.pickerYearText, { color: textColor }]}>{pickerYear}</Text>
              <TouchableOpacity onPress={() => setPickerYear(y => y + 1)} style={styles.pickerYearBtn}>
                <MaterialCommunityIcons name="chevron-left" size={22} color={theme} />
              </TouchableOpacity>
            </View>
            <View style={styles.pickerMonthGrid}>
              {HEBREW_MONTHS.map((name, i) => {
                const isActive = i === month && pickerYear === year;
                return (
                  <TouchableOpacity key={name}
                    style={[styles.pickerMonthCell, { backgroundColor: surface }, isActive && { backgroundColor: theme }]}
                    onPress={() => pickMonthYear(i)}>
                    <Text style={[styles.pickerMonthText, { color: textSub }, isActive && styles.pickerMonthTextActive]}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Add / Edit event modal ───────────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: tabBg }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: textColor }]}>{editingId !== null ? 'עריכת אירוע' : 'אירוע חדש'}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <MaterialCommunityIcons name="close" size={24} color={textSub} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: textSub }]}>שם האירוע</Text>
                  <TextInput style={[styles.input, { backgroundColor: surface, borderColor: borderClr, color: textColor }]} placeholder="למשל: הרצאת חדו״א" placeholderTextColor={textSub} value={eventTitle} onChangeText={setEventTitle} />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: textSub }]}>יום שלם</Text>
                  <TouchableOpacity style={[styles.allDayBtn, { borderColor: eventAllDay ? theme : borderClr, backgroundColor: eventAllDay ? light : surface }]} onPress={() => setEventAllDay(v => !v)} activeOpacity={0.8}>
                    <MaterialCommunityIcons name={eventAllDay ? 'toggle-switch' : 'toggle-switch-off-outline'} size={28} color={eventAllDay ? theme : textSub} />
                    <Text style={[styles.allDayText, { color: eventAllDay ? theme : textSub }]}>{eventAllDay ? 'אירוע יום שלם' : 'בחר טווח שעות'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: textSub }]}>תאריך התחלה</Text>
                  {Platform.OS === 'web' ? (
                    <WebDatePicker iso={eventDate} onChange={setEventDate} />
                  ) : (
                    <TouchableOpacity style={[styles.input, styles.pickerBtn, { backgroundColor: surface, borderColor: borderClr }]} onPress={() => openDtPicker('date')} activeOpacity={0.7}>
                      <Text style={[styles.pickerBtnText, { color: textColor }]}>{fmtDate(eventDate)}</Text>
                      <MaterialCommunityIcons name="calendar" size={18} color={theme} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: textSub }]}>תאריך סיום (אופציונלי)</Text>
                  {Platform.OS === 'web' ? (
                    <View style={styles.webEndTimeRow}>
                      <WebDatePicker iso={eventEndDate || eventDate} onChange={setEventEndDate} minISO={eventDate} />
                      {!!eventEndDate && (
                        <TouchableOpacity onPress={() => setEventEndDate('')} style={styles.clearBtn}>
                          <MaterialCommunityIcons name="close-circle" size={18} color="#ccc" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View style={styles.pickerBtnWithClear}>
                      <TouchableOpacity style={[styles.input, styles.pickerBtn, styles.pickerBtnFlex, { backgroundColor: surface, borderColor: borderClr }]} onPress={() => openDtPicker('endDate')} activeOpacity={0.7}>
                        <Text style={[styles.pickerBtnText, { color: eventEndDate ? textColor : textSub }]}>{eventEndDate ? fmtDate(eventEndDate) : 'ללא תאריך סיום'}</Text>
                        <MaterialCommunityIcons name="calendar" size={18} color={eventEndDate ? theme : '#ccc'} />
                      </TouchableOpacity>
                      {!!eventEndDate && (
                        <TouchableOpacity onPress={() => setEventEndDate('')} style={styles.clearBtn}>
                          <MaterialCommunityIcons name="close-circle" size={18} color="#ccc" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>

                {!eventAllDay && (
                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: textSub }]}>שעות</Text>
                    {Platform.OS === 'web' ? (
                      <View style={styles.webTimeRow}>
                        <View style={styles.webTimeGroup}>
                          <WebTimePicker time={eventStartTime} onChange={handleStartTimeChange} />
                          <Text style={styles.webTimeLabel}>התחלה</Text>
                        </View>
                        <View style={styles.webTimeDivider} />
                        <View style={styles.webTimeGroup}>
                          <WebTimePicker time={eventEndTime} onChange={setEventEndTime} />
                          <Text style={styles.webTimeLabel}>סיום</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.timeRow}>
                        <View style={styles.timeCol}>
                          <Text style={[styles.timeSubLabel, { color: textSub }]}>התחלה</Text>
                          <TouchableOpacity style={[styles.input, styles.pickerBtn, { backgroundColor: surface, borderColor: borderClr }]} onPress={() => openDtPicker('startTime')} activeOpacity={0.7}>
                            <Text style={[styles.pickerBtnText, { color: textColor }]}>{eventStartTime || '09:00'}</Text>
                            <MaterialCommunityIcons name="clock-outline" size={18} color={theme} />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.timeSep}><Text style={[styles.timeSepText, { color: textSub }]}>—</Text></View>
                        <View style={styles.timeCol}>
                          <Text style={[styles.timeSubLabel, { color: textSub }]}>סיום</Text>
                          <TouchableOpacity style={[styles.input, styles.pickerBtn, { backgroundColor: surface, borderColor: borderClr }]} onPress={() => openDtPicker('endTime')} activeOpacity={0.7}>
                            <Text style={[styles.pickerBtnText, { color: textColor }]}>{eventEndTime}</Text>
                            <MaterialCommunityIcons name="clock-outline" size={18} color={theme} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: textSub }]}>צבע</Text>
                  <View style={styles.colorRow}>
                    {EVENT_COLORS.map(c => (
                      <TouchableOpacity key={c} style={[styles.colorCircle, { backgroundColor: c }, eventColor === c && styles.colorCircleSelected]} onPress={() => setEventColor(c)} />
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: textSub }]}>חזרתיות</Text>
                  <View style={styles.recurrenceRow}>
                    {RECURRENCE_OPTIONS.map(opt => (
                      <TouchableOpacity key={opt.key}
                        style={[styles.recurrenceBtn, { borderColor: borderClr, backgroundColor: surface }, eventRecurrence === opt.key && { borderColor: theme, backgroundColor: light }]}
                        onPress={() => setEventRecurrence(opt.key)}>
                        <Text style={[styles.recurrenceBtnText, { color: textSub }, eventRecurrence === opt.key && { color: theme }]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {eventRecurrence !== 'none' && (
                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: textSub }]}>תאריך סיום חזרתיות</Text>
                    {Platform.OS === 'web' ? (
                      <View style={styles.webEndTimeRow}>
                        <WebDatePicker iso={eventRecurrenceEnd || eventDate} onChange={setEventRecurrenceEnd} minISO={eventDate} />
                        {!!eventRecurrenceEnd && (
                          <TouchableOpacity onPress={() => setEventRecurrenceEnd('')} style={styles.clearBtn}>
                            <MaterialCommunityIcons name="close-circle" size={18} color="#ccc" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <View style={styles.pickerBtnWithClear}>
                        <TouchableOpacity style={[styles.input, styles.pickerBtn, styles.pickerBtnFlex, { backgroundColor: surface, borderColor: borderClr }]} onPress={() => openDtPicker('recurrenceEnd')} activeOpacity={0.7}>
                          <Text style={[styles.pickerBtnText, { color: textColor }, !eventRecurrenceEnd && { color: textSub }]}>{eventRecurrenceEnd ? fmtDate(eventRecurrenceEnd) : 'ללא תאריך סיום'}</Text>
                          <MaterialCommunityIcons name="calendar" size={18} color={eventRecurrenceEnd ? theme : '#ccc'} />
                        </TouchableOpacity>
                        {!!eventRecurrenceEnd && (
                          <TouchableOpacity onPress={() => setEventRecurrenceEnd('')} style={styles.clearBtn}>
                            <MaterialCommunityIcons name="close-circle" size={18} color="#ccc" />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity style={[styles.submitBtn, { backgroundColor: theme }]} onPress={handleSave}>
                  <Text style={styles.submitBtnText}>{editingId !== null ? 'שמור שינויים' : 'הוסף אירוע'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Native date/time picker ──────────────────────────────────────── */}
      {dtPickerTarget !== null && Platform.OS === 'android' && (
        <DateTimePicker
          value={dtPickerTempDate}
          mode={dtPickerMode(dtPickerTarget)}
          display="default"
          onChange={onDtPickerChange}
          minimumDate={(dtPickerTarget === 'recurrenceEnd' || dtPickerTarget === 'endDate') && isValidDate(eventDate) ? localDate(eventDate) : undefined}
        />
      )}
      {dtPickerTarget !== null && Platform.OS === 'ios' && (
        <Modal visible animationType="slide" transparent>
          <TouchableOpacity style={styles.dtPickerOverlay} activeOpacity={1} onPress={cancelDtPicker}>
            <View style={styles.dtPickerSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.dtPickerHeader}>
                <TouchableOpacity onPress={cancelDtPicker} style={styles.dtPickerHeaderBtn}>
                  <Text style={styles.dtPickerCancelText}>ביטול</Text>
                </TouchableOpacity>
                <Text style={styles.dtPickerTitle}>{dtPickerTitle(dtPickerTarget)}</Text>
                <TouchableOpacity onPress={confirmDtPicker} style={styles.dtPickerHeaderBtn}>
                  <Text style={[styles.dtPickerDoneText, { color: theme }]}>אישור</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dtPickerTempDate}
                mode={dtPickerMode(dtPickerTarget)}
                display="spinner"
                onChange={onDtPickerChange}
                minimumDate={(dtPickerTarget === 'recurrenceEnd' || dtPickerTarget === 'endDate') && isValidDate(eventDate) ? localDate(eventDate) : undefined}
                style={styles.dtPickerControl}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {alertNode}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // View tabs
  viewTabBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  viewTab:    { flex: 1, paddingVertical: 9, borderRadius: 24, alignItems: 'center', borderWidth: 1.5 },
  viewTabText:{ fontSize: 13, fontWeight: '700' },

  // Shared navigation bar (day / week / year views)
  navBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: CAL_TOP_H + 8, marginHorizontal: 16, marginBottom: 8, borderRadius: 16, shadowColor: '#4A5B9A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  navTitle:  { fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },

  // Month calendar
  calBlock:     { marginHorizontal: 16, borderRadius: 20, marginBottom: 10, shadowColor: '#4A5B9A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 4, overflow: 'hidden' },
  calHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: CAL_TOP_H },
  navBtn:       { padding: 6 },
  monthYearBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center' },
  monthLabel:   { fontSize: 15, fontWeight: '700' },
  todayBtn:     { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  todayBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  dayLabelRow:  { flexDirection: 'row', height: DAY_ROW_H, alignItems: 'center' },
  dayLabelText: { width: '14.2857%', textAlign: 'center', fontSize: 11, fontWeight: '700' },

  grid:             { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 6 },
  cell:             { width: '14.2857%', height: CELL_H, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4, borderRadius: 6 },
  cellToday:        {},
  cellSelected:     {},
  cellText:         { fontSize: 12, fontWeight: '600' },
  cellTextToday:    { fontWeight: '800' },
  cellTextSelected: { color: '#fff', fontWeight: '800' },
  dotRow:           { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot:              { width: 4, height: 4, borderRadius: 2 },

  // Events list
  eventsScroll:       { flex: 1 },
  eventsContent:      { padding: 16, paddingBottom: 100 },
  eventsSectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 12, textAlign: 'right', color: '#9299B8', textTransform: 'uppercase', letterSpacing: 0.8 },
  noEventsText:       { fontSize: 13, textAlign: 'center', paddingVertical: 24, opacity: 0.6 },

  eventItem:    { flexDirection: 'row', alignItems: 'center', borderRadius: 20, marginBottom: 10, borderRightWidth: 4, shadowColor: '#4A5B9A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 4, overflow: 'hidden' },
  eventBody:    { flex: 1, paddingVertical: 12, paddingHorizontal: 14 },
  eventTitle:   { fontSize: 14, fontWeight: '700', marginBottom: 4, textAlign: 'right' },
  eventMeta:    { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  eventTime:    { fontSize: 12, fontWeight: '600' },
  eventRecur:   { fontSize: 12, color: '#999' },
  eventActions: { flexDirection: 'column', justifyContent: 'center', paddingHorizontal: 6 },
  actionBtn:    { padding: 8 },

  // Week view
  weekDayHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 16, marginBottom: 6, borderRadius: 14, shadowColor: '#4A5B9A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  weekDayName:    { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  weekDayCount:   { fontSize: 12, fontWeight: '600' },
  weekNoEventsText:{ fontSize: 12, textAlign: 'right', paddingHorizontal: 16, paddingVertical: 6, opacity: 0.5 },

  // Year view mini calendars
  yearGrid:       { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12, paddingBottom: 100 },
  miniMonth:      { width: '47%', borderRadius: 20, borderWidth: 0, padding: 12, shadowColor: '#4A5B9A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 4 },
  miniMonthTitle: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  miniDayRow:     { flexDirection: 'row', marginBottom: 2 },
  miniDayLabel:   { width: '14.2857%', textAlign: 'center', fontSize: 8, fontWeight: '600' },
  miniGrid:       { flexDirection: 'row', flexWrap: 'wrap' },
  miniCell:       { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  miniCellText:   { fontSize: 9, fontWeight: '500' },
  miniDot:        { width: 3, height: 3, borderRadius: 2 },

  // FAB
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },

  // Month/year picker modal
  pickerOverlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerBox:             { borderRadius: 16, padding: 20, width: SCREEN_W * 0.85, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  pickerYearRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 20 },
  pickerYearBtn:         { padding: 4 },
  pickerYearText:        { fontSize: 18, fontWeight: '700', minWidth: 60, textAlign: 'center' },
  pickerMonthGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerMonthCell:       { width: '30%', paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  pickerMonthText:       { fontSize: 13, fontWeight: '600' },
  pickerMonthTextActive: { color: '#fff' },

  // Add/Edit event modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingVertical: 20, maxHeight: '90%' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 18, fontWeight: '700' },
  formGroup:    { marginBottom: 18 },
  formLabel:    { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', textAlign: 'right' },
  input:        { borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 14, textAlign: 'right' },

  pickerBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerBtnText:       { fontSize: 14, flex: 1 },
  pickerBtnFlex:       { flex: 1 },
  pickerBtnWithClear:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clearBtn:            { padding: 4 },

  timeRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  timeCol:      { flex: 1 },
  timeSubLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6 },
  timeSep:      { paddingBottom: 13 },
  timeSepText:  { fontSize: 16, fontWeight: '700' },

  colorRow:            { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' },
  colorCircle:         { width: 32, height: 32, borderRadius: 16 },
  colorCircleSelected: { borderWidth: 3, borderColor: '#333', transform: [{ scale: 1.15 }] },

  recurrenceRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  recurrenceBtn:     { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  recurrenceBtnText: { fontSize: 13, fontWeight: '600' },

  submitBtn:     { paddingVertical: 13, borderRadius: 10, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  allDayBtn:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-end' },
  allDayText: { fontSize: 14, fontWeight: '600' },

  // Web pickers
  webPickerRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8, justifyContent: 'flex-end', alignSelf: 'flex-end' },
  webPickerCol:      { flexDirection: 'column' },
  webPickerSubLabel: { fontSize: 11, fontWeight: '600', marginBottom: 5 },
  webPickerBase:     { borderWidth: 1, borderRadius: 10, height: 44, fontSize: 14 },
  webPickerDay:      { width: 72 },
  webPickerMonth:    { width: 110 },
  webPickerYear:     { width: 92 },
  webPickerHour:     { width: 80 },
  webPickerMinute:   { width: 80 },
  webPickerColonWrap:{ paddingBottom: 11 },
  webPickerColon:    { fontSize: 20, fontWeight: '700' },
  webEndTimeRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end' },
  webTimeRow:        { flexDirection: 'row-reverse', alignItems: 'center', gap: 0, alignSelf: 'flex-end' },
  webTimeGroup:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  webTimeLabel:      { fontSize: 11, fontWeight: '600', flexShrink: 0 },
  webTimeDivider:    { width: 1, height: 44, marginHorizontal: 12 },

  // iOS date picker sheet
  dtPickerOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  dtPickerSheet:      { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 20 },
  dtPickerHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  dtPickerHeaderBtn:  { minWidth: 60, padding: 4 },
  dtPickerTitle:      { fontSize: 15, fontWeight: '700' },
  dtPickerCancelText: { fontSize: 15, color: '#999' },
  dtPickerDoneText:   { fontSize: 15, fontWeight: '700', textAlign: 'right' },
  dtPickerControl:    { width: '100%' },
});

export default ScheduleScreen;
