import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCustomAlert } from '../hooks/useCustomAlert';

interface CalendarEvent {
  id: number;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  color: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
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

// ── Dimensions ──────────────────────────────────────────────────────────────
const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
// Navigation header ≈44, tab bar ≈60, status bar ≈44  → usable area
const USABLE_H  = SCREEN_H - 148;
// Calendar fills ~70% of the usable height; events section gets the rest
const CAL_TOP_H = 44;  // month-nav header row
const DAY_ROW_H = 26;  // day-of-week label row
const GRID_ROWS = 6;
const CELL_H    = Math.floor((USABLE_H * 0.70 - CAL_TOP_H - DAY_ROW_H) / GRID_ROWS);
const CELL_W    = Math.floor(SCREEN_W / 7);

// ── Helpers ──────────────────────────────────────────────────────────────────
const toISO = (d: Date) => {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const occursOn = (event: CalendarEvent, iso: string): boolean => {
  if (iso < event.date) return false;
  const d1 = new Date(event.date + 'T00:00:00');
  const d2 = new Date(iso + 'T00:00:00');
  switch (event.recurrence) {
    case 'none':    return iso === event.date;
    case 'daily':   return true;
    case 'weekly':  return d1.getDay() === d2.getDay();
    case 'monthly': return d1.getDate() === d2.getDate();
    case 'yearly':  return d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    default:        return false;
  }
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

  // Pickers
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerYear,    setPickerYear]    = useState(todayDate.getFullYear());

  // Add-event modal
  const [addVisible,      setAddVisible]      = useState(false);
  const [eventTitle,      setEventTitle]      = useState('');
  const [eventDate,       setEventDate]       = useState(todayISO);
  const [eventTime,       setEventTime]       = useState('09:00');
  const [eventColor,      setEventColor]      = useState(EVENT_COLORS[0]);
  const [eventRecurrence, setEventRecurrence] = useState<CalendarEvent['recurrence']>('none');

  useFocusEffect(useCallback(() => { loadEvents(); }, []));

  const loadEvents = async () => {
    try {
      const data = await AsyncStorage.getItem('calendarEvents');
      if (data) setEvents(JSON.parse(data));
    } catch (e) { console.log(e); }
  };

  const persist = async (updated: CalendarEvent[]) => {
    await AsyncStorage.setItem('calendarEvents', JSON.stringify(updated));
  };

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
    setMonth(m);
    setYear(pickerYear);
    setPickerVisible(false);
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
  const selectedEvts = events.filter(e => occursOn(e, selectedDate)).sort((a, b) => a.time.localeCompare(b.time));

  // ── Add event ─────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEventTitle(''); setEventDate(selectedDate); setEventTime('09:00');
    setEventColor(EVENT_COLORS[0]); setEventRecurrence('none');
    setAddVisible(true);
  };

  const handleAdd = async () => {
    if (!eventTitle.trim()) { showAlert('שגיאה', 'אנא הזן שם לאירוע'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) { showAlert('שגיאה', 'תאריך לא תקין (YYYY-MM-DD)'); return; }
    const newEvent: CalendarEvent = { id: Date.now(), title: eventTitle.trim(), date: eventDate, time: eventTime, color: eventColor, recurrence: eventRecurrence };
    const updated = [...events, newEvent];
    setEvents(updated);
    try { await persist(updated); setAddVisible(false); }
    catch (e) { showAlert('שגיאה', 'שמירה נכשלה'); }
  };

  const handleDelete = (id: number) => {
    showDestructiveConfirm('מחיקת אירוע', 'האם אתה בטוח שברצונך למחוק את האירוע?', 'מחק', async () => {
      const updated = events.filter(e => e.id !== id);
      setEvents(updated); await persist(updated);
    });
  };

  const displayDate = selectedDate.split('-').reverse().join('/');

  return (
    <View style={styles.container}>

      {/* ─── Fixed calendar block ─────────────────────────────────────── */}
      <View style={styles.calBlock}>

        {/* Header: prev | month+year (tap to pick) | next | today */}
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

        {/* Day-of-week labels */}
        <View style={styles.dayLabelRow}>
          {DAY_LABELS.map(h => (
            <Text key={h} style={styles.dayLabelText}>{h}</Text>
          ))}
        </View>

        {/* Grid */}
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
          selectedEvts.map(e => {
            const recurLabel = RECURRENCE_OPTIONS.find(r => r.key === e.recurrence)?.label;
            return (
              <View key={e.id} style={[styles.eventItem, { borderLeftColor: e.color }]}>
                <View style={[styles.eventColorBar, { backgroundColor: e.color }]} />
                <View style={styles.eventBody}>
                  <Text style={styles.eventTitle}>{e.title}</Text>
                  <View style={styles.eventMeta}>
                    <Text style={styles.eventTime}>{e.time}</Text>
                    {e.recurrence !== 'none' && <Text style={styles.eventRecur}>🔁 {recurLabel}</Text>}
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDelete(e.id)} style={styles.deleteBtn}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ff6b6b" />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ─── Month / Year picker modal ──────────────────────────────── */}
      <Modal visible={pickerVisible} animationType="fade" transparent>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <View style={styles.pickerBox} onStartShouldSetResponder={() => true}>
            {/* Year selector */}
            <View style={styles.pickerYearRow}>
              <TouchableOpacity onPress={() => setPickerYear(y => y - 1)} style={styles.pickerYearBtn}>
                <MaterialCommunityIcons name="chevron-right" size={22} color="#667eea" />
              </TouchableOpacity>
              <Text style={styles.pickerYearText}>{pickerYear}</Text>
              <TouchableOpacity onPress={() => setPickerYear(y => y + 1)} style={styles.pickerYearBtn}>
                <MaterialCommunityIcons name="chevron-left" size={22} color="#667eea" />
              </TouchableOpacity>
            </View>

            {/* Month grid 3×4 */}
            <View style={styles.pickerMonthGrid}>
              {HEBREW_MONTHS.map((name, i) => {
                const isActive = i === month && pickerYear === year;
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.pickerMonthCell, isActive && styles.pickerMonthCellActive]}
                    onPress={() => pickMonthYear(i)}
                  >
                    <Text style={[styles.pickerMonthText, isActive && styles.pickerMonthTextActive]}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Add Event modal ────────────────────────────────────────── */}
      <Modal visible={addVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>אירוע חדש</Text>
              <TouchableOpacity onPress={() => setAddVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>שם האירוע</Text>
                <TextInput style={styles.input} placeholder="למשל: הרצאת חדו״א" value={eventTitle} onChangeText={setEventTitle} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>תאריך</Text>
                <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={eventDate} onChangeText={setEventDate} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>שעה</Text>
                <TextInput style={styles.input} placeholder="HH:MM" value={eventTime} onChangeText={setEventTime} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>צבע</Text>
                <View style={styles.colorRow}>
                  {EVENT_COLORS.map(c => (
                    <TouchableOpacity key={c} style={[styles.colorCircle, { backgroundColor: c }, eventColor === c && styles.colorCircleSelected]} onPress={() => setEventColor(c)} />
                  ))}
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>חזרתיות</Text>
                <View style={styles.recurrenceRow}>
                  {RECURRENCE_OPTIONS.map(opt => (
                    <TouchableOpacity key={opt.key} style={[styles.recurrenceBtn, eventRecurrence === opt.key && styles.recurrenceBtnActive]} onPress={() => setEventRecurrence(opt.key)}>
                      <Text style={[styles.recurrenceBtnText, eventRecurrence === opt.key && styles.recurrenceBtnTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TouchableOpacity style={styles.submitBtn} onPress={handleAdd}>
                <Text style={styles.submitBtnText}>הוסף אירוע</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {alertNode}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f5f5f5' },

  // Calendar block — auto height, fits all cells
  calBlock:     { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8e8e8' },

  calHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: CAL_TOP_H },
  navBtn:       { padding: 6 },
  monthYearBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center' },
  monthLabel:   { fontSize: 15, fontWeight: '700', color: '#333' },
  todayBtn:     { backgroundColor: '#667eea', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  todayBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  dayLabelRow:  { flexDirection: 'row', height: DAY_ROW_H, alignItems: 'center', paddingHorizontal: 2 },
  dayLabelText: { width: CELL_W, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#aaa' },

  grid:         { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 2, paddingBottom: 6 },
  cell:         { width: CELL_W, height: CELL_H, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4, borderRadius: 6 },
  cellToday:    { backgroundColor: '#f0f3ff' },
  cellSelected: { backgroundColor: '#667eea' },
  cellText:     { fontSize: 12, fontWeight: '600', color: '#333' },
  cellTextToday:    { color: '#667eea', fontWeight: '800' },
  cellTextSelected: { color: '#fff',    fontWeight: '800' },
  dotRow:       { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot:          { width: 4, height: 4, borderRadius: 2 },

  // Events
  eventsScroll:       { flex: 1 },
  eventsContent:      { padding: 14, paddingBottom: 80 },
  eventsSectionTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 10 },
  noEventsText:       { fontSize: 13, color: '#bbb', textAlign: 'center', paddingVertical: 16 },
  eventItem:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3, elevation: 2, overflow: 'hidden' },
  eventColorBar:{ width: 4, alignSelf: 'stretch' },
  eventBody:    { flex: 1, paddingVertical: 10, paddingHorizontal: 12 },
  eventTitle:   { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 3 },
  eventMeta:    { flexDirection: 'row', gap: 10 },
  eventTime:    { fontSize: 12, color: '#667eea', fontWeight: '600' },
  eventRecur:   { fontSize: 12, color: '#999' },
  deleteBtn:    { padding: 12 },

  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#667eea', justifyContent: 'center', alignItems: 'center', shadowColor: '#667eea', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },

  // Month/Year picker
  pickerOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerBox:        { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: SCREEN_W * 0.85, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  pickerYearRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 20 },
  pickerYearBtn:    { padding: 4 },
  pickerYearText:   { fontSize: 18, fontWeight: '700', color: '#333', minWidth: 60, textAlign: 'center' },
  pickerMonthGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerMonthCell:  { width: '30%', paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#f5f5f5' },
  pickerMonthCellActive: { backgroundColor: '#667eea' },
  pickerMonthText:  { fontSize: 13, fontWeight: '600', color: '#555' },
  pickerMonthTextActive: { color: '#fff' },

  // Add event modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingVertical: 20, maxHeight: '90%' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: '#333' },
  formGroup:    { marginBottom: 18 },
  formLabel:    { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 8, textTransform: 'uppercase' },
  input:        { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 14, backgroundColor: '#f5f5f5' },
  colorRow:           { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorCircle:        { width: 32, height: 32, borderRadius: 16 },
  colorCircleSelected:{ borderWidth: 3, borderColor: '#333', transform: [{ scale: 1.15 }] },
  recurrenceRow:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  recurrenceBtn:      { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#f5f5f5' },
  recurrenceBtnActive:{ borderColor: '#667eea', backgroundColor: '#f0f3ff' },
  recurrenceBtnText:       { fontSize: 13, color: '#999', fontWeight: '600' },
  recurrenceBtnTextActive: { color: '#667eea' },
  submitBtn:     { backgroundColor: '#667eea', paddingVertical: 13, borderRadius: 10, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default ScheduleScreen;
