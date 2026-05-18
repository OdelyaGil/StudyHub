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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCustomAlert } from '../hooks/useCustomAlert';

interface CalendarEvent {
  id: number;
  title: string;
  date: string;             // YYYY-MM-DD  base date
  startTime: string;        // HH:MM
  endTime: string;          // HH:MM
  color: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceEndDate?: string; // YYYY-MM-DD inclusive
}

const HEBREW_MONTHS = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
];
const DAY_LABELS = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
const EVENT_COLORS = ['#667eea','#f5576c','#43e97b','#f093fb','#fda085','#4facfe','#fa709a','#38f9d7'];
const RECURRENCE_OPTIONS: { key: CalendarEvent['recurrence']; label: string }[] = [
  { key: 'none',    label: 'ללא' },
  { key: 'daily',   label: 'יומי' },
  { key: 'weekly',  label: 'שבועי' },
  { key: 'monthly', label: 'חודשי' },
  { key: 'yearly',  label: 'שנתי' },
];

const THIS_YEAR = new Date().getFullYear();
// Year range for date picker: 5 years back to 10 years forward
const YEAR_OPTIONS = Array.from({ length: 16 }, (_, i) => THIS_YEAR - 5 + i);
// Hour/minute options
const HOUR_OPTIONS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

// ── Dimensions ───────────────────────────────────────────────────────────────
const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const USABLE_H  = SCREEN_H - 148;
const CAL_TOP_H = 44;
const DAY_ROW_H = 26;
const GRID_ROWS = 6;
const CELL_H    = Math.floor((USABLE_H * 0.70 - CAL_TOP_H - DAY_ROW_H) / GRID_ROWS);

// ── Date/time helpers ─────────────────────────────────────────────────────────
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

const daysBetween = (iso1: string, iso2: string): number =>
  Math.round((localDate(iso2).getTime() - localDate(iso1).getTime()) / 86_400_000);

const occursOn = (event: CalendarEvent, iso: string): boolean => {
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
type PickerTarget = 'date' | 'startTime' | 'endTime' | 'recurrenceEnd';

const timeStringToDate = (s: string): Date => {
  const parts = s ? s.split(':').map(Number) : [];
  const h = parts[0] ?? 9;
  const m = parts[1] ?? 0;
  const d = new Date();
  d.setHours(isNaN(h) ? 9 : h, isNaN(m) ? 0 : m, 0, 0);
  return d;
};

const dateToTimeString = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Parse an ISO string to { day, month (1-based), year }
const parseDateParts = (iso: string) => {
  if (!isValidDate(iso)) {
    const n = new Date();
    return { day: n.getDate(), month: n.getMonth() + 1, year: n.getFullYear() };
  }
  const [y, m, d] = iso.split('-').map(Number);
  return { day: d, month: m, year: y };
};

// Build ISO string from parts, clamping day to valid range
const buildDateISO = (day: number, month: number, year: number): string => {
  const maxDay = new Date(year, month, 0).getDate();
  const d = Math.max(1, Math.min(day, maxDay));
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

// Parse HH:MM to { hour, minute }
const parseTimeParts = (t: string) => {
  const parts = t ? t.split(':').map(Number) : [];
  const h = parts[0]; const m = parts[1];
  return {
    hour:   !isNaN(h) && h >= 0 && h <= 23 ? h : 9,
    minute: !isNaN(m) && m >= 0 && m <= 59 ? m : 0,
  };
};

// Snap minute to the nearest MINUTE_OPTIONS entry
const snapMinute = (m: number) =>
  MINUTE_OPTIONS.reduce((prev, cur) =>
    Math.abs(cur - m) < Math.abs(prev - m) ? cur : prev, 0);

const addOneHour = (timeStr: string): string => {
  const { hour, minute } = parseTimeParts(timeStr);
  const newHour = Math.min(hour + 1, 23);
  return `${String(newHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

// ── Component ─────────────────────────────────────────────────────────────────
const ScheduleScreen = () => {
  const { showAlert, showDestructiveConfirm, alertNode } = useCustomAlert();
  const todayDate = new Date();
  const todayISO  = toISO(todayDate);

  const [year,  setYear]  = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  // Month/year picker (calendar navigation)
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerYear,    setPickerYear]    = useState(todayDate.getFullYear());

  // Add/edit modal
  const [modalVisible,        setModalVisible]        = useState(false);
  const [editingId,           setEditingId]           = useState<number | null>(null);
  const [eventTitle,          setEventTitle]          = useState('');
  const [eventDate,           setEventDate]           = useState(todayISO);
  const [eventStartTime,      setEventStartTime]      = useState('09:00');
  const [eventEndTime,        setEventEndTime]        = useState('10:00');
  const [eventColor,          setEventColor]          = useState(EVENT_COLORS[0]);
  const [eventRecurrence,     setEventRecurrence]     = useState<CalendarEvent['recurrence']>('none');
  const [eventRecurrenceEnd,  setEventRecurrenceEnd]  = useState('');

  // Native OS date/time picker state (iOS & Android only — web uses Picker dropdowns)
  const [dtPickerTarget,   setDtPickerTarget]   = useState<PickerTarget | null>(null);
  const [dtPickerTempDate, setDtPickerTempDate] = useState<Date>(new Date());

  useFocusEffect(useCallback(() => { loadEvents(); }, []));

  const loadEvents = async () => {
    try {
      const data = await AsyncStorage.getItem('calendarEvents');
      if (data) {
        const parsed = JSON.parse(data).map((e: any) => ({
          ...e,
          startTime: e.startTime ?? e.time ?? '09:00',
          endTime:   e.endTime   ?? '',
        }));
        setEvents(parsed);
      }
    } catch (e) { console.log(e); }
  };

  const persist = async (updated: CalendarEvent[]) =>
    AsyncStorage.setItem('calendarEvents', JSON.stringify(updated));

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

  // ── Form helpers ──────────────────────────────────────────────────────────
  const handleStartTimeChange = (newTime: string) => {
    setEventStartTime(newTime);
    setEventEndTime(addOneHour(newTime));
  };

  const resetForm = () => {
    setEditingId(null);
    setEventTitle(''); setEventDate(selectedDate);
    setEventStartTime('09:00'); setEventEndTime('10:00');
    setEventColor(EVENT_COLORS[0]); setEventRecurrence('none');
    setEventRecurrenceEnd('');
  };

  const openAdd  = () => { resetForm(); setModalVisible(true); };

  const openEdit = (ev: CalendarEvent) => {
    setEditingId(ev.id);
    setEventTitle(ev.title);
    setEventDate(ev.date);
    setEventStartTime(ev.startTime);
    setEventEndTime(ev.endTime || addOneHour(ev.startTime));
    setEventColor(ev.color);
    setEventRecurrence(ev.recurrence);
    setEventRecurrenceEnd(ev.recurrenceEndDate ?? '');
    setModalVisible(true);
  };

  // ── Native picker logic (iOS & Android) ───────────────────────────────────
  const getPickerInitialDate = (target: PickerTarget): Date => {
    switch (target) {
      case 'date':
        return isValidDate(eventDate) ? localDate(eventDate) : new Date();
      case 'startTime':
        return timeStringToDate(eventStartTime || '09:00');
      case 'endTime': {
        if (eventEndTime) return timeStringToDate(eventEndTime);
        const start = timeStringToDate(eventStartTime || '09:00');
        const end   = new Date(start);
        end.setHours(Math.min(end.getHours() + 1, 23));
        return end;
      }
      case 'recurrenceEnd':
        if (isValidDate(eventRecurrenceEnd)) return localDate(eventRecurrenceEnd);
        return isValidDate(eventDate) ? localDate(eventDate) : new Date();
    }
  };

  const openDtPicker = (target: PickerTarget) => {
    setDtPickerTempDate(getPickerInitialDate(target));
    setDtPickerTarget(target);
  };

  const applyPickerValue = (target: PickerTarget, date: Date) => {
    switch (target) {
      case 'date':          setEventDate(toISO(date));             break;
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

  const cancelDtPicker = () => setDtPickerTarget(null);

  const dtPickerMode   = (t: PickerTarget): 'date' | 'time' => t === 'startTime' || t === 'endTime' ? 'time' : 'date';
  const dtPickerTitle  = (t: PickerTarget) => ({ date: 'בחר תאריך', startTime: 'שעת התחלה', endTime: 'שעת סיום', recurrenceEnd: 'תאריך סיום חזרתיות' }[t]);

  // ── Web Picker helpers ────────────────────────────────────────────────────
  const WebDatePicker = ({ iso, onChange, minISO }: { iso: string; onChange: (v: string) => void; minISO?: string }) => {
    const { day, month: m, year: y } = parseDateParts(iso);
    const maxDay   = new Date(y, m, 0).getDate();
    const minParts = minISO && isValidDate(minISO) ? parseDateParts(minISO) : null;
    return (
      <View style={styles.webPickerRow}>
        <View style={styles.webPickerCol}>
          <Text style={styles.webPickerSubLabel}>יום</Text>
          <Picker
            selectedValue={day}
            onValueChange={d => onChange(buildDateISO(Number(d), m, y))}
            style={[styles.webPickerBase, styles.webPickerDay]}
          >
            {Array.from({ length: maxDay }, (_, i) => i + 1).map(d => (
              <Picker.Item key={d} label={String(d)} value={d} />
            ))}
          </Picker>
        </View>
        <View style={[styles.webPickerCol, { flex: 1 }]}>
          <Text style={styles.webPickerSubLabel}>חודש</Text>
          <Picker
            selectedValue={m}
            onValueChange={newM => onChange(buildDateISO(day, Number(newM), y))}
            style={[styles.webPickerBase, styles.webPickerMonth]}
          >
            {HEBREW_MONTHS.map((name, i) => (
              <Picker.Item key={i} label={name} value={i + 1} />
            ))}
          </Picker>
        </View>
        <View style={styles.webPickerCol}>
          <Text style={styles.webPickerSubLabel}>שנה</Text>
          <Picker
            selectedValue={y}
            onValueChange={newY => onChange(buildDateISO(day, m, Number(newY)))}
            style={[styles.webPickerBase, styles.webPickerYear]}
          >
            {YEAR_OPTIONS
              .filter(yr => !minParts || yr >= minParts.year)
              .map(yr => <Picker.Item key={yr} label={String(yr)} value={yr} />)}
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
          <Picker
            selectedValue={hour}
            onValueChange={h => onChange(`${String(Number(h)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)}
            style={[styles.webPickerBase, styles.webPickerHour]}
          >
            {HOUR_OPTIONS.map(h => (
              <Picker.Item key={h} label={String(h).padStart(2, '0')} value={h} />
            ))}
          </Picker>
        </View>
        <View style={styles.webPickerColonWrap}>
          <Text style={styles.webPickerColon}>:</Text>
        </View>
        <View style={styles.webPickerCol}>
          <Text style={styles.webPickerSubLabel}>דקות</Text>
          <Picker
            selectedValue={snapMinute(minute)}
            onValueChange={min => onChange(`${String(hour).padStart(2, '0')}:${String(Number(min)).padStart(2, '0')}`)}
            style={[styles.webPickerBase, styles.webPickerMinute]}
          >
            {MINUTE_OPTIONS.map(m => (
              <Picker.Item key={m} label={String(m).padStart(2, '0')} value={m} />
            ))}
          </Picker>
        </View>
      </View>
    );
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!eventTitle.trim()) {
      showAlert('שגיאה', 'אנא הזן שם לאירוע'); return;
    }
    if (!isValidDate(eventDate)) {
      showAlert('שגיאה', 'תאריך לא תקין'); return;
    }
    if (eventEndTime <= eventStartTime) {
      showAlert('שגיאה', 'שעת הסיום חייבת להיות אחרי שעת ההתחלה'); return;
    }
    if (eventRecurrenceEnd && isValidDate(eventRecurrenceEnd) && eventRecurrenceEnd < eventDate) {
      showAlert('שגיאה', 'תאריך סיום החזרתיות לא יכול להיות לפני תאריך האירוע'); return;
    }

    const saved: CalendarEvent = {
      id: editingId ?? Date.now(),
      title: eventTitle.trim(),
      date:  eventDate,
      startTime: eventStartTime,
      endTime:   eventEndTime,
      color:     eventColor,
      recurrence: eventRecurrence,
      ...(eventRecurrence !== 'none' && eventRecurrenceEnd
        ? { recurrenceEndDate: eventRecurrenceEnd }
        : {}),
    };

    const updated = editingId !== null
      ? events.map(e => e.id === editingId ? saved : e)
      : [...events, saved];

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

  const displayDate = selectedDate.split('-').reverse().join('/');
  const fmtDate     = (iso: string) => iso.split('-').reverse().join('/');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ─── Fixed calendar block ─────────────────────────────────────── */}
      <View style={styles.calBlock}>
        <View style={styles.calHeader}>
          <TouchableOpacity onPress={goToPrev} style={styles.navBtn}>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#667eea" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.monthYearBtn} onPress={() => { setPickerYear(year); setPickerVisible(true); }}>
            <Text style={styles.monthLabel}>{HEBREW_MONTHS[month]} {year}</Text>
            <MaterialCommunityIcons name="menu-down" size={18} color="#667eea" />
          </TouchableOpacity>
          <TouchableOpacity onPress={goToNext} style={styles.navBtn}>
            <MaterialCommunityIcons name="chevron-left" size={24} color="#667eea" />
          </TouchableOpacity>
          <TouchableOpacity onPress={goToToday} style={styles.todayBtn}>
            <Text style={styles.todayBtnText}>היום</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dayLabelRow}>
          {DAY_LABELS.map(h => <Text key={h} style={styles.dayLabelText}>{h}</Text>)}
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
                style={[styles.cell, isToday && !isSelected && styles.cellToday, isSelected && styles.cellSelected]}
                onPress={() => setSelectedDate(iso)}
                activeOpacity={0.7}
              >
                <Text style={[styles.cellText, isToday && !isSelected && styles.cellTextToday, isSelected && styles.cellTextSelected]}>
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

      {/* ─── Scrollable events list ───────────────────────────────────── */}
      <ScrollView style={styles.eventsScroll} contentContainerStyle={styles.eventsContent}>
        <Text style={styles.eventsSectionTitle}>אירועים ל-{displayDate}</Text>
        {selectedEvts.length === 0 ? (
          <Text style={styles.noEventsText}>אין אירועים ביום זה. לחץ + להוספה</Text>
        ) : (
          selectedEvts.map(ev => {
            const recurLabel = RECURRENCE_OPTIONS.find(r => r.key === ev.recurrence)?.label;
            const timeRange  = ev.endTime ? `${ev.startTime} – ${ev.endTime}` : ev.startTime;
            return (
              <View key={ev.id} style={[styles.eventItem, { borderRightColor: ev.color }]}>
                <View style={styles.eventBody}>
                  <Text style={styles.eventTitle}>{ev.title}</Text>
                  <View style={styles.eventMeta}>
                    <Text style={styles.eventTime}>{timeRange}</Text>
                    {ev.recurrence !== 'none' && (
                      <Text style={styles.eventRecur}>
                        🔁 {recurLabel}{ev.recurrenceEndDate ? ` עד ${ev.recurrenceEndDate.split('-').reverse().join('/')}` : ''}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.eventActions}>
                  <TouchableOpacity onPress={() => openEdit(ev)} style={styles.actionBtn}>
                    <MaterialCommunityIcons name="pencil-outline" size={18} color="#667eea" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(ev.id)} style={styles.actionBtn}>
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color="#ff6b6b" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ─── Month / Year picker ──────────────────────────────────────── */}
      <Modal visible={pickerVisible} animationType="fade" transparent>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <View style={styles.pickerBox} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerYearRow}>
              <TouchableOpacity onPress={() => setPickerYear(y => y - 1)} style={styles.pickerYearBtn}>
                <MaterialCommunityIcons name="chevron-right" size={22} color="#667eea" />
              </TouchableOpacity>
              <Text style={styles.pickerYearText}>{pickerYear}</Text>
              <TouchableOpacity onPress={() => setPickerYear(y => y + 1)} style={styles.pickerYearBtn}>
                <MaterialCommunityIcons name="chevron-left" size={22} color="#667eea" />
              </TouchableOpacity>
            </View>
            <View style={styles.pickerMonthGrid}>
              {HEBREW_MONTHS.map((name, i) => {
                const isActive = i === month && pickerYear === year;
                return (
                  <TouchableOpacity key={name}
                    style={[styles.pickerMonthCell, isActive && styles.pickerMonthCellActive]}
                    onPress={() => pickMonthYear(i)}>
                    <Text style={[styles.pickerMonthText, isActive && styles.pickerMonthTextActive]}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Add / Edit event modal ───────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId !== null ? 'עריכת אירוע' : 'אירוע חדש'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Title */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>שם האירוע</Text>
                <TextInput style={styles.input} placeholder="למשל: הרצאת חדו״א"
                  value={eventTitle} onChangeText={setEventTitle} />
              </View>

              {/* ── Date ───────────────────────────────────────────────── */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>תאריך</Text>
                {Platform.OS === 'web' ? (
                  <WebDatePicker iso={eventDate} onChange={setEventDate} />
                ) : (
                  <TouchableOpacity
                    style={[styles.input, styles.pickerBtn]}
                    onPress={() => openDtPicker('date')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.pickerBtnText}>{fmtDate(eventDate)}</Text>
                    <MaterialCommunityIcons name="calendar" size={18} color="#667eea" />
                  </TouchableOpacity>
                )}
              </View>

              {/* ── Time range ─────────────────────────────────────────── */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>שעות</Text>
                {Platform.OS === 'web' ? (
                  <View style={styles.webTimeRow}>
                    {/* Start time */}
                    <View style={styles.webTimeGroup}>
                      <WebTimePicker time={eventStartTime} onChange={handleStartTimeChange} />
                      <Text style={styles.webTimeLabel}>התחלה</Text>
                    </View>

                    <View style={styles.webTimeDivider} />

                    {/* End time */}
                    <View style={styles.webTimeGroup}>
                      <WebTimePicker time={eventEndTime} onChange={setEventEndTime} />
                      <Text style={styles.webTimeLabel}>סיום</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.timeRow}>
                    {/* Start time */}
                    <View style={styles.timeCol}>
                      <Text style={styles.timeSubLabel}>התחלה</Text>
                      <TouchableOpacity
                        style={[styles.input, styles.pickerBtn]}
                        onPress={() => openDtPicker('startTime')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.pickerBtnText}>{eventStartTime || '09:00'}</Text>
                        <MaterialCommunityIcons name="clock-outline" size={18} color="#667eea" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.timeSep}>
                      <Text style={styles.timeSepText}>—</Text>
                    </View>

                    {/* End time */}
                    <View style={styles.timeCol}>
                      <Text style={styles.timeSubLabel}>סיום</Text>
                      <TouchableOpacity
                        style={[styles.input, styles.pickerBtn]}
                        onPress={() => openDtPicker('endTime')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.pickerBtnText}>{eventEndTime}</Text>
                        <MaterialCommunityIcons name="clock-outline" size={18} color="#667eea" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Color */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>צבע</Text>
                <View style={styles.colorRow}>
                  {EVENT_COLORS.map(c => (
                    <TouchableOpacity key={c}
                      style={[styles.colorCircle, { backgroundColor: c }, eventColor === c && styles.colorCircleSelected]}
                      onPress={() => setEventColor(c)} />
                  ))}
                </View>
              </View>

              {/* Recurrence */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>חזרתיות</Text>
                <View style={styles.recurrenceRow}>
                  {RECURRENCE_OPTIONS.map(opt => (
                    <TouchableOpacity key={opt.key}
                      style={[styles.recurrenceBtn, eventRecurrence === opt.key && styles.recurrenceBtnActive]}
                      onPress={() => setEventRecurrence(opt.key)}>
                      <Text style={[styles.recurrenceBtnText, eventRecurrence === opt.key && styles.recurrenceBtnTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Recurrence end date */}
              {eventRecurrence !== 'none' && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>תאריך סיום חזרתיות</Text>
                  {Platform.OS === 'web' ? (
                    <View style={styles.webEndTimeRow}>
                      <WebDatePicker
                        iso={eventRecurrenceEnd || eventDate}
                        onChange={setEventRecurrenceEnd}
                        minISO={eventDate}
                      />
                      {!!eventRecurrenceEnd && (
                        <TouchableOpacity onPress={() => setEventRecurrenceEnd('')} style={styles.clearBtn}>
                          <MaterialCommunityIcons name="close-circle" size={18} color="#ccc" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View style={styles.pickerBtnWithClear}>
                      <TouchableOpacity
                        style={[styles.input, styles.pickerBtn, styles.pickerBtnFlex]}
                        onPress={() => openDtPicker('recurrenceEnd')}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pickerBtnText, !eventRecurrenceEnd && styles.pickerBtnPlaceholder]}>
                          {eventRecurrenceEnd ? fmtDate(eventRecurrenceEnd) : 'ללא תאריך סיום'}
                        </Text>
                        <MaterialCommunityIcons
                          name="calendar"
                          size={18}
                          color={eventRecurrenceEnd ? '#667eea' : '#ccc'}
                        />
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

              <TouchableOpacity style={styles.submitBtn} onPress={handleSave}>
                <Text style={styles.submitBtnText}>{editingId !== null ? 'שמור שינויים' : 'הוסף אירוע'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Native OS date/time picker (iOS & Android) ───────────────── */}

      {/* Android: native dialog, auto-dismisses */}
      {dtPickerTarget !== null && Platform.OS === 'android' && (
        <DateTimePicker
          value={dtPickerTempDate}
          mode={dtPickerMode(dtPickerTarget)}
          display="default"
          onChange={onDtPickerChange}
          minimumDate={
            dtPickerTarget === 'recurrenceEnd' && isValidDate(eventDate)
              ? localDate(eventDate)
              : undefined
          }
        />
      )}

      {/* iOS: spinner inside a bottom-sheet modal with Done/Cancel */}
      {dtPickerTarget !== null && Platform.OS === 'ios' && (
        <Modal visible animationType="slide" transparent>
          <TouchableOpacity
            style={styles.dtPickerOverlay}
            activeOpacity={1}
            onPress={cancelDtPicker}
          >
            <View style={styles.dtPickerSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.dtPickerHeader}>
                <TouchableOpacity onPress={cancelDtPicker} style={styles.dtPickerHeaderBtn}>
                  <Text style={styles.dtPickerCancelText}>ביטול</Text>
                </TouchableOpacity>
                <Text style={styles.dtPickerTitle}>{dtPickerTitle(dtPickerTarget)}</Text>
                <TouchableOpacity onPress={confirmDtPicker} style={styles.dtPickerHeaderBtn}>
                  <Text style={styles.dtPickerDoneText}>אישור</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dtPickerTempDate}
                mode={dtPickerMode(dtPickerTarget)}
                display="spinner"
                onChange={onDtPickerChange}
                minimumDate={
                  dtPickerTarget === 'recurrenceEnd' && isValidDate(eventDate)
                    ? localDate(eventDate)
                    : undefined
                }
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

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  calBlock:  { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8e8e8' },

  calHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: CAL_TOP_H },
  navBtn:       { padding: 6 },
  monthYearBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center' },
  monthLabel:   { fontSize: 15, fontWeight: '700', color: '#333' },
  todayBtn:     { backgroundColor: '#667eea', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  todayBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  dayLabelRow:  { flexDirection: 'row', height: DAY_ROW_H, alignItems: 'center' },
  dayLabelText: { width: '14.2857%', textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#aaa' },

  grid:             { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 6 },
  cell:             { width: '14.2857%', height: CELL_H, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4, borderRadius: 6 },
  cellToday:        { backgroundColor: '#f0f3ff' },
  cellSelected:     { backgroundColor: '#667eea' },
  cellText:         { fontSize: 12, fontWeight: '600', color: '#333' },
  cellTextToday:    { color: '#667eea', fontWeight: '800' },
  cellTextSelected: { color: '#fff',    fontWeight: '800' },
  dotRow:           { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot:              { width: 4, height: 4, borderRadius: 2 },

  eventsScroll:       { flex: 1 },
  eventsContent:      { padding: 14, paddingBottom: 80 },
  eventsSectionTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 10, textAlign: 'right' },
  noEventsText:       { fontSize: 13, color: '#bbb', textAlign: 'center', paddingVertical: 16 },

  eventItem:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, borderRightWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3, elevation: 2, overflow: 'hidden' },
  eventColorBar: { width: 4, alignSelf: 'stretch' },
  eventBody:     { flex: 1, paddingVertical: 10, paddingHorizontal: 12 },
  eventTitle:    { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 3, textAlign: 'right' },
  eventMeta:     { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  eventTime:     { fontSize: 12, color: '#667eea', fontWeight: '600' },
  eventRecur:    { fontSize: 12, color: '#999' },
  eventActions:  { flexDirection: 'column', justifyContent: 'center', paddingHorizontal: 4 },
  actionBtn:     { padding: 8 },

  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#667eea', justifyContent: 'center', alignItems: 'center', shadowColor: '#667eea', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },

  pickerOverlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerBox:             { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: SCREEN_W * 0.85, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  pickerYearRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 20 },
  pickerYearBtn:         { padding: 4 },
  pickerYearText:        { fontSize: 18, fontWeight: '700', color: '#333', minWidth: 60, textAlign: 'center' },
  pickerMonthGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerMonthCell:       { width: '30%', paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#f5f5f5' },
  pickerMonthCellActive: { backgroundColor: '#667eea' },
  pickerMonthText:       { fontSize: 13, fontWeight: '600', color: '#555' },
  pickerMonthTextActive: { color: '#fff' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingVertical: 20, maxHeight: '90%' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: '#333' },
  formGroup:    { marginBottom: 18 },
  formLabel:    { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 8, textTransform: 'uppercase', textAlign: 'right' },
  input:        { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 14, backgroundColor: '#f5f5f5', textAlign: 'right' },

  pickerBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerBtnText:       { fontSize: 14, color: '#333', flex: 1 },
  pickerBtnPlaceholder:{ color: '#aaa' },
  pickerBtnFlex:       { flex: 1 },
  pickerBtnWithClear:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clearBtn:            { padding: 4 },

  timeRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  timeCol:      { flex: 1 },
  timeSubLabel: { fontSize: 11, color: '#aaa', fontWeight: '600', marginBottom: 6 },
  timeSep:      { paddingBottom: 13 },
  timeSepText:  { fontSize: 16, color: '#ccc', fontWeight: '700' },

  colorRow:            { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorCircle:         { width: 32, height: 32, borderRadius: 16 },
  colorCircleSelected: { borderWidth: 3, borderColor: '#333', transform: [{ scale: 1.15 }] },

  recurrenceRow:           { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  recurrenceBtn:           { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#f5f5f5' },
  recurrenceBtnActive:     { borderColor: '#667eea', backgroundColor: '#f0f3ff' },
  recurrenceBtnText:       { fontSize: 13, color: '#999', fontWeight: '600' },
  recurrenceBtnTextActive: { color: '#667eea' },

  submitBtn:     { backgroundColor: '#667eea', paddingVertical: 13, borderRadius: 10, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Web Picker dropdowns (rendered as <select> on web)
  webPickerRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  webPickerCol:      { flexDirection: 'column' },
  webPickerSubLabel: { fontSize: 11, color: '#aaa', fontWeight: '600', marginBottom: 5 },
  webPickerBase:     { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, height: 44, fontSize: 14, color: '#333' },
  webPickerDay:      { width: 72 },
  webPickerMonth:    { minWidth: 100 },
  webPickerYear:     { width: 92 },
  webPickerHour:     { width: 80 },
  webPickerMinute:   { width: 80 },
  webPickerColonWrap:{ paddingBottom: 11 },
  webPickerColon:    { fontSize: 20, fontWeight: '700', color: '#667eea' },
  webEndTimeRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Web time section layout
  webTimeRow:      { flexDirection: 'row', alignItems: 'center', gap: 0 },
  webTimeGroup:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  webTimeLabel:    { fontSize: 11, color: '#aaa', fontWeight: '600', flexShrink: 0 },
  webTimeDivider:  { width: 1, backgroundColor: '#e0e0e0', height: 44, marginHorizontal: 12 },
  webTimeClearBtn: { padding: 2 },

  // iOS picker bottom sheet
  dtPickerOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  dtPickerSheet:      { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 20 },
  dtPickerHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  dtPickerHeaderBtn:  { minWidth: 60, padding: 4 },
  dtPickerTitle:      { fontSize: 15, fontWeight: '700', color: '#333' },
  dtPickerCancelText: { fontSize: 15, color: '#999' },
  dtPickerDoneText:   { fontSize: 15, color: '#667eea', fontWeight: '700', textAlign: 'right' },
  dtPickerControl:    { width: '100%' },
});

export default ScheduleScreen;
