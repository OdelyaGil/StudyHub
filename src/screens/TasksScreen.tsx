import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  RefreshControl,
  Platform,
  Linking,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadField, saveField, appendToArrayField } from '../utils/firestore';
import * as DocumentPicker from 'expo-document-picker';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { useTheme } from '../context/ThemeContext';

// ── Date helpers ─────────────────────────────────────────────────────────────
const HEBREW_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const HEBREW_DAYS   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 16 }, (_, i) => THIS_YEAR - 5 + i);

const isValidDate = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && !isNaN(Date.parse(iso));

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

const getTodayISO = () => {
  const n = new Date();
  return buildDateISO(n.getDate(), n.getMonth() + 1, n.getFullYear());
};

// Collision-safe ID: timestamp × 10 000 + random suffix keeps id as number
// while making same-millisecond duplicates statistically impossible.
const genId = () => Date.now() * 10000 + Math.floor(Math.random() * 10000);

const fmtEstimate = (totalMinutes: number): string => {
  if (!totalMinutes) return '';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}ש' ${m}ד'`;
  if (h > 0) return `${h} שעות`;
  return `${m} דקות`;
};

const getDaysLeft = (dueDate: string) => {
  const due = new Date(dueDate);
  const today = new Date();
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

// ── Schedule scanning helpers ─────────────────────────────────────────────────
const timeToMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};
const minToTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const occursOnISO = (event: any, iso: string): boolean => {
  if (!event?.date || iso < event.date) return false;
  if (event.recurrenceEndDate && iso > event.recurrenceEndDate) return false;
  switch (event.recurrence) {
    case 'none':    return iso === event.date;
    case 'daily':   return true;
    case 'weekly': {
      const diff = Math.round(
        (new Date(iso + 'T12:00:00').getTime() - new Date(event.date + 'T12:00:00').getTime()) / 86400000,
      );
      return diff % 7 === 0;
    }
    case 'monthly': return iso.slice(8) === event.date.slice(8);
    case 'yearly':  return iso.slice(5) === event.date.slice(5);
    default:        return false;
  }
};

// ── Types ────────────────────────────────────────────────────────────────────
interface TaskFile {
  name: string;
  uri: string;
  size?: number;
  mimeType?: string;
}

interface Task {
  id: number;
  name: string;
  course: string;
  dueDate: string;
  priority: string;
  estimate: number;
  files: TaskFile[];
  completed: boolean;
}

interface FreeSlot { iso: string; startMin: number; endMin: number; }

// ── WebDatePicker ─────────────────────────────────────────────────────────────
const WebDatePicker = ({ iso, onChange }: { iso: string; onChange: (v: string) => void }) => {
  const { day, month: m, year: y } = parseDateParts(iso);
  const maxDay = new Date(y, m, 0).getDate();
  return (
    <View style={styles.webPickerRow}>
      <View style={styles.webPickerCol}>
        <Text style={styles.webPickerSubLabel}>שנה</Text>
        <Picker
          selectedValue={y}
          onValueChange={newY => onChange(buildDateISO(day, m, Number(newY)))}
          style={[styles.webPickerBase, styles.webPickerYear]}
        >
          {YEAR_OPTIONS.map(yr => (
            <Picker.Item key={yr} label={String(yr)} value={yr} />
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
    </View>
  );
};

// ── TaskItem ─────────────────────────────────────────────────────────────────
interface TaskItemProps {
  item: Task;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (task: Task) => void;
  onFileOpen: (file: TaskFile) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ item, onToggle, onDelete, onEdit, onFileOpen }) => {
  const themeObj = useTheme();
  const theme    = themeObj.accent;
  const surface  = themeObj.surface;
  const tabBg    = themeObj.tabBg;
  const textColor = themeObj.text;
  const textSub  = themeObj.textSub;
  const isDark   = themeObj.mode === 'dark';
  const darkShadow: object = isDark
    ? (Platform.select({ web: { boxShadow: `0 4px 20px ${theme}30, 0 1px 6px rgba(0,0,0,0.5)` } as any, default: { shadowColor: theme, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 6 } }) ?? {})
    : {};
  const [filesExpanded, setFilesExpanded] = useState(false);
  const daysLeft = getDaysLeft(item.dueDate);
  const priorityColor = theme;
  const files: TaskFile[] = (item as any).files ?? [];

  return (
    <View style={[styles.taskItem, { borderRightColor: theme, backgroundColor: surface, opacity: item.completed ? 0.5 : 1, borderWidth: 1, borderColor: themeObj.border }, darkShadow as any]}>
      {/* Checkbox */}
      <View style={styles.taskCheckBox}>
        <TouchableOpacity
          onPress={() => onToggle(item.id)}
          style={[styles.checkbox, item.completed && styles.checkboxCompleted]}
        >
          {item.completed && <MaterialCommunityIcons name="check" size={16} color="#fff" />}
        </TouchableOpacity>
      </View>

      {/* Main info */}
      <View style={styles.taskInfoContainer}>
        <Text style={[styles.taskNameText, { color: textColor }, item.completed && styles.taskNameCompleted]}>{item.name}</Text>
        {item.course ? <Text style={[styles.taskCourseText, { color: textSub }]}>{item.course}</Text> : null}

        {/* Files toggle */}
        {files.length > 0 && (
          <TouchableOpacity style={styles.taskFilesToggle} onPress={() => setFilesExpanded(v => !v)}>
            <Text style={styles.taskFilesText}>
              📎 {files.length} {files.length === 1 ? 'קובץ מצורף' : 'קבצים מצורפים'}
            </Text>
            <MaterialCommunityIcons
              name={filesExpanded ? 'chevron-up' : 'chevron-down'}
              size={13}
              color="#aaa"
            />
          </TouchableOpacity>
        )}

        {/* Expanded file list */}
        {filesExpanded && (
          <View style={styles.taskFilesList}>
            {files.map((file, i) => (
              <TouchableOpacity key={i} style={styles.taskFileItem} onPress={() => onFileOpen(file)}>
                <MaterialCommunityIcons name="file-outline" size={13} color={theme} />
                <Text style={styles.taskFileItemName} numberOfLines={1}>{file.name}</Text>
                <MaterialCommunityIcons name="download-outline" size={13} color={theme} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Meta row */}
        <View style={styles.taskMeta}>
          <Text style={[styles.taskDueText, daysLeft < 0 ? { color: '#ff6b6b' } : daysLeft <= 2 ? { color: '#ffa94d' } : { color: '#999' }]}>
            ⏰ {daysLeft >= 0 ? `${daysLeft} ימים` : 'חזר לאחור!'}
          </Text>
          {item.estimate > 0 && (
            <Text style={styles.taskEstimateText}>⏱️ {fmtEstimate(item.estimate)}</Text>
          )}
        </View>
      </View>

      {/* Right section: badge + actions */}
      <View style={styles.taskRightSection}>
        <View style={[styles.priorityBadge, { backgroundColor: priorityColor }]}>
          <Text style={styles.priorityText}>{item.priority}</Text>
        </View>
        <View style={styles.taskActions}>
          <TouchableOpacity onPress={() => onEdit(item)} style={styles.actionIcon}>
            <MaterialCommunityIcons name="pencil-outline" size={17} color={theme} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.actionIcon}>
            <MaterialCommunityIcons name="trash-can-outline" size={17} color="#ff6b6b" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ── TasksScreen ───────────────────────────────────────────────────────────────
const TasksScreen = () => {
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);

  // Form state
  const [taskName, setTaskName] = useState('');
  const [taskCourse, setTaskCourse] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(getTodayISO);
  const [taskPriority, setTaskPriority] = useState('בינונית');
  const [taskEstimateHours, setTaskEstimateHours] = useState(0);
  const [taskEstimateMinutes, setTaskEstimateMinutes] = useState(0);
  const [taskFiles, setTaskFiles] = useState<TaskFile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [dtPickerOpen, setDtPickerOpen] = useState(false);
  const [dtPickerTemp, setDtPickerTemp] = useState(new Date());
  const [suggestedSlots, setSuggestedSlots] = useState<FreeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [addedSlotKeys, setAddedSlotKeys] = useState<Set<string>>(new Set());
  const [pickerSlot, setPickerSlot] = useState<FreeSlot | null>(null);
  const [pickerStartMin, setPickerStartMin] = useState(0);

  useEffect(() => { loadTasks(); }, []);

  const scanFreeSlots = async (dueISO: string) => {
    if (!isValidDate(dueISO)) { setSuggestedSlots([]); return; }
    setLoadingSlots(true);
    try {
      const schedule: any[] = (await loadField('schedule')) ?? [];
      const slots: FreeSlot[] = [];
      const now  = new Date();
      const due  = new Date(dueISO + 'T23:59:59');
      const DAY_START = 8 * 60;
      const DAY_END   = 22 * 60;
      const MIN_GAP   = 30;

      const cur = new Date(now);
      while (cur <= due && slots.length < 10) {
        const iso = buildDateISO(cur.getDate(), cur.getMonth() + 1, cur.getFullYear());
        const busy = schedule
          .filter(e => occursOnISO(e, iso) && e.startTime)
          .map(e => ({
            start: timeToMin(e.startTime),
            end:   e.endTime ? timeToMin(e.endTime) : timeToMin(e.startTime) + 60,
          }))
          .sort((a, b) => a.start - b.start);

        let cursor = iso === getTodayISO()
          ? Math.max(DAY_START, now.getHours() * 60 + now.getMinutes() + 15)
          : DAY_START;

        for (const ev of busy) {
          if (ev.start > cursor && ev.start - cursor >= MIN_GAP) {
            slots.push({ iso, startMin: cursor, endMin: Math.min(ev.start, DAY_END) });
          }
          cursor = Math.max(cursor, ev.end);
        }
        if (cursor < DAY_END && DAY_END - cursor >= MIN_GAP) {
          slots.push({ iso, startMin: cursor, endMin: DAY_END });
        }
        cur.setDate(cur.getDate() + 1);
      }
      setSuggestedSlots(slots.slice(0, 8));
    } catch (_) {
      setSuggestedSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const openSlotPicker = (slot: FreeSlot) => {
    setPickerSlot(slot);
    setPickerStartMin(slot.startMin);
  };

  const confirmAddSlot = async () => {
    if (!pickerSlot) return;
    const key = pickerSlot.iso + pickerSlot.startMin;
    try {
      const estimateMins = taskEstimateHours * 60 + taskEstimateMinutes;
      const duration     = estimateMins > 0 ? estimateMins : 60;
      const endMin       = Math.min(pickerStartMin + duration, pickerSlot.endMin);
      const newEvent = {
        id:         genId(),
        title:      taskName.trim() || 'עבודה על מטלה',
        date:       pickerSlot.iso,
        startTime:  minToTime(pickerStartMin),
        endTime:    minToTime(endMin),
        color:      '#4CAFAE',
        recurrence: 'none',
      };
      await appendToArrayField('schedule', newEvent);
      setAddedSlotKeys(prev => new Set(prev).add(key));
      setPickerSlot(null);
      showAlert('נוסף ללוח הזמנים', `${newEvent.title}\n${newEvent.date.split('-').reverse().join('/')}  ${newEvent.startTime}–${newEvent.endTime}`);
    } catch (_) {
      showAlert('שגיאה', 'לא ניתן להוסיף את האירוע ללוח הזמנים');
      setPickerSlot(null);
    }
  };

  useEffect(() => {
    if (modalVisible && isValidDate(taskDueDate)) {
      setAddedSlotKeys(new Set());
      scanFreeSlots(taskDueDate);
    } else {
      setSuggestedSlots([]);
      setAddedSlotKeys(new Set());
    }
  }, [taskDueDate, modalVisible]);

  const loadTasks = async () => {
    try {
      const data = await loadField('tasks');
      if (data) setTasks(data);
    } catch (e) { console.log(e); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  };

  const resetForm = () => {
    setTaskName('');
    setTaskCourse('');
    setTaskDueDate(getTodayISO());
    setTaskPriority('בינונית');
    setTaskEstimateHours(0);
    setTaskEstimateMinutes(0);
    setTaskFiles([]);
  };

  const openEditModal = (task: Task) => {
    setEditingTaskId(task.id);
    setTaskName(task.name);
    setTaskCourse(task.course ?? '');
    setTaskDueDate(task.dueDate ?? getTodayISO());
    setTaskPriority(task.priority ?? 'בינונית');
    setTaskEstimateHours(Math.floor((task.estimate ?? 0) / 60));
    setTaskEstimateMinutes((task.estimate ?? 0) % 60);
    setTaskFiles((task as any).files ?? []);
    setModalVisible(true);
  };

  const closeModal = () => {
    resetForm();
    setEditingTaskId(null);
    setModalVisible(false);
  };

  const handlePickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (result.canceled || !result.assets) return;

      const newFiles: TaskFile[] = [];
      const MAX_FILE  = 100 * 1024;   // 100 KB per file (base64 ≈ 133 KB)
      const MAX_TOTAL = 300 * 1024;   // 300 KB total to stay well under Firestore 1 MB limit
      let runningTotal = taskFiles.reduce((s, f) => s + (f.size ?? 0), 0);

      for (const asset of result.assets) {
        if ((asset.size ?? 0) > MAX_FILE) {
          showAlert('קובץ גדול מדי', `"${asset.name}" גדול מ-100KB ולא ניתן לשמור אותו.\nטיפ: דחוס את הקובץ לפני הצירוף.`);
          continue;
        }
        if (runningTotal + (asset.size ?? 0) > MAX_TOTAL) {
          showAlert('מגבלת גודל', 'סך הקבצים המצורפים חרג מהמגבלה המותרת (300KB סה"כ).');
          break;
        }
        runningTotal += (asset.size ?? 0);
        if (Platform.OS === 'web') {
          try {
            const res = await fetch(asset.uri);
            const blob = await res.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            newFiles.push({ name: asset.name, uri: dataUrl, size: asset.size, mimeType: asset.mimeType });
          } catch {
            newFiles.push({ name: asset.name, uri: asset.uri, size: asset.size, mimeType: asset.mimeType });
          }
        } else {
          newFiles.push({ name: asset.name, uri: asset.uri, size: asset.size, mimeType: asset.mimeType });
        }
      }
      setTaskFiles(prev => [...prev, ...newFiles]);
    } catch (e) {
      showAlert('שגיאה', 'לא ניתן לפתוח את בורר הקבצים');
    }
  };

  const removeFile = (index: number) => {
    setTaskFiles(prev => prev.filter((_, i) => i !== index));
  };

  const openFile = (file: TaskFile) => {
    if (Platform.OS === 'web') {
      const a = (document as any).createElement('a');
      a.href = file.uri;
      a.download = file.name;
      a.target = '_blank';
      (document as any).body.appendChild(a);
      a.click();
      (document as any).body.removeChild(a);
    } else {
      Linking.openURL(file.uri).catch(() =>
        showAlert('שגיאה', 'לא ניתן לפתוח את הקובץ')
      );
    }
  };

  const handleSaveTask = async () => {
    if (!taskName || !taskDueDate) {
      showAlert('שגיאה', 'אנא מלא את כל השדות הנדרשים');
      return;
    }

    const taskData = {
      name: taskName,
      course: taskCourse,
      dueDate: taskDueDate,
      priority: taskPriority,
      estimate: taskEstimateHours * 60 + taskEstimateMinutes,
      files: taskFiles,
    };

    let updatedTasks: Task[];
    if (editingTaskId !== null) {
      updatedTasks = tasks.map(t => t.id === editingTaskId ? { ...t, ...taskData } : t);
    } else {
      updatedTasks = [...tasks, { id: genId(), ...taskData, completed: false }];
    }

    setTasks(updatedTasks);
    try {
      await saveField('tasks', updatedTasks);
      const isEdit = editingTaskId !== null;
      closeModal();
      showAlert('הצלחה', isEdit ? 'המטלה עודכנה בהצלחה' : 'המטלה נשמרה בהצלחה');
    } catch (e) {
      showAlert('שגיאה', 'שמירת המטלה נכשלה');
    }
  };

  const handleToggleTask = async (id: number) => {
    const updatedTasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTasks(updatedTasks);
    try { await saveField('tasks', updatedTasks); } catch (e) { console.log(e); }
  };

  const handleDeleteTask = (id: number) => {
    showDestructiveConfirm('מחק מטלה', 'האם אתה בטוח שברצונך למחוק את המטלה?', 'מחק', async () => {
      const updatedTasks = tasks.filter(t => t.id !== id);
      setTasks(updatedTasks);
      try { await saveField('tasks', updatedTasks); } catch (e) { console.log(e); }
    });
  };

  // Sort: incomplete first → priority → due date; completed sink to bottom
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const order: Record<string, number> = { 'גבוהה': 0, 'בינונית': 1, 'נמוכה': 2 };
    const pd = (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
    if (pd !== 0) return pd;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme} />}
      >
        {tasks.length > 0 ? (
          <View style={styles.section}>
            <FlatList
              data={sortedTasks}
              renderItem={({ item }) => (
                <TaskItem
                  item={item}
                  onToggle={handleToggleTask}
                  onDelete={handleDeleteTask}
                  onEdit={openEditModal}
                  onFileOpen={openFile}
                />
              )}
              keyExtractor={item => item.id.toString()}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="checkbox-multiple-marked" size={60} color={textSub} />
            <Text style={[styles.emptyStateText, { color: textSub }]}>אין מטלות עדיין</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { backgroundColor: theme, shadowColor: theme }]} onPress={() => setModalVisible(true)}>
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add / Edit Task Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: tabBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>
                {editingTaskId !== null ? 'עריכת מטלה' : 'מטלה חדשה'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <MaterialCommunityIcons name="close" size={24} color={textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              {/* Task name */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: textSub }]}>שם המטלה</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: surface, borderColor: borderClr, color: textColor }]}
                  placeholder="למשל: פתרון תרגיל 5" placeholderTextColor={textSub}
                  value={taskName}
                  onChangeText={setTaskName}
                />
              </View>

              {/* Course */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: textSub }]}>קורס</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: surface, borderColor: borderClr, color: textColor }]}
                  placeholder="שם הקורס" placeholderTextColor={textSub}
                  value={taskCourse}
                  onChangeText={setTaskCourse}
                />
              </View>

              {/* Due date */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: textSub }]}>תאריך הגשה</Text>
                {Platform.OS === 'web' ? (
                  <WebDatePicker iso={taskDueDate} onChange={setTaskDueDate} />
                ) : (
                  <TouchableOpacity
                    style={[styles.input, styles.pickerBtn, { backgroundColor: surface, borderColor: borderClr }]}
                    onPress={() => {
                      const d = isValidDate(taskDueDate) ? new Date(taskDueDate + 'T12:00:00') : new Date();
                      setDtPickerTemp(d);
                      setDtPickerOpen(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerBtnText, { color: textColor }]}>
                      {taskDueDate ? taskDueDate.split('-').reverse().join('/') : 'בחר תאריך'}
                    </Text>
                    <MaterialCommunityIcons name="calendar" size={18} color={theme} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Priority */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: textSub }]}>עדיפות</Text>
                <View style={styles.prioritySelector}>
                  {['גבוהה', 'בינונית', 'נמוכה'].map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.priorityBtn, { borderColor: borderClr, backgroundColor: surface }, taskPriority === p && { borderColor: theme, backgroundColor: light }]}
                      onPress={() => setTaskPriority(p)}
                    >
                      <Text style={[styles.priorityBtnText, { color: textSub }, taskPriority === p && { color: theme }]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Estimate */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: textSub }]}>משך זמן משוער</Text>
                <View style={styles.estimateRow}>
                  <View style={styles.estimateCol}>
                    <Text style={[styles.webPickerSubLabel, { color: textSub }]}>שעות</Text>
                    <TextInput
                      style={[styles.estimateInput, { borderColor: borderClr, backgroundColor: surface, color: textColor }]}
                      value={taskEstimateHours === 0 ? '' : String(taskEstimateHours)}
                      onChangeText={v => setTaskEstimateHours(Math.max(0, Math.min(23, parseInt(v) || 0)))}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={textSub}
                      maxLength={2}
                      textAlign="center"
                    />
                  </View>
                  <Text style={[styles.webPickerColon, { color: theme, paddingTop: 22 }]}>:</Text>
                  <View style={styles.estimateCol}>
                    <Text style={[styles.webPickerSubLabel, { color: textSub }]}>דקות</Text>
                    <TextInput
                      style={[styles.estimateInput, { borderColor: borderClr, backgroundColor: surface, color: textColor }]}
                      value={taskEstimateMinutes === 0 ? '' : String(taskEstimateMinutes)}
                      onChangeText={v => setTaskEstimateMinutes(Math.max(0, Math.min(59, parseInt(v) || 0)))}
                      keyboardType="number-pad"
                      placeholder="00"
                      placeholderTextColor={textSub}
                      maxLength={2}
                      textAlign="center"
                    />
                  </View>
                </View>
              </View>

              {/* Suggested free slots */}
              {isValidDate(taskDueDate) && (() => {
                const estimateMins  = taskEstimateHours * 60 + taskEstimateMinutes;
                const minDuration   = Math.max(30, estimateMins);
                const visibleSlots  = suggestedSlots.filter(s => s.endMin - s.startMin >= minDuration);
                return (
                  <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: textSub }]}>זמנים פנויים לביצוע</Text>
                    {loadingSlots ? (
                      <ActivityIndicator color={theme} size="small" style={{ marginTop: 6 }} />
                    ) : visibleSlots.length === 0 ? (
                      <Text style={[styles.noSlotsText, { color: textSub }]}>לא נמצאו זמנים פנויים מתאימים בלוח הזמנים</Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.slotsScroll}>
                        {visibleSlots.map((slot, i) => {
                          const key     = slot.iso + slot.startMin;
                          const added   = addedSlotKeys.has(key);
                          const d       = new Date(slot.iso + 'T12:00:00');
                          const dayName = HEBREW_DAYS[d.getDay()];
                          const dateFmt = slot.iso.split('-').reverse().join('/');
                          return (
                            <TouchableOpacity
                              key={i}
                              onPress={() => !added && openSlotPicker(slot)}
                              activeOpacity={added ? 1 : 0.7}
                              style={[
                                styles.slotChip,
                                added
                                  ? { backgroundColor: theme + '33', borderColor: theme }
                                  : { backgroundColor: light, borderColor: theme },
                              ]}
                            >
                              {added && (
                                <MaterialCommunityIcons name="check-circle" size={14} color={theme} style={{ marginBottom: 2 }} />
                              )}
                              <Text style={[styles.slotChipDay, { color: theme, opacity: added ? 0.7 : 1 }]}>{dayName}</Text>
                              <Text style={[styles.slotChipDate, { color: textSub }]}>{dateFmt}</Text>
                              <Text style={[styles.slotChipTime, { color: textColor, opacity: added ? 0.6 : 1 }]}>
                                {minToTime(slot.startMin)}–{minToTime(slot.endMin)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>
                );
              })()}

              {/* Files */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: textSub }]}>קבצים מצורפים</Text>
                <TouchableOpacity style={[styles.filePickerBtn, { borderColor: theme, backgroundColor: light }]} onPress={handlePickFiles}>
                  <MaterialCommunityIcons name="paperclip" size={18} color={theme} />
                  <Text style={[styles.filePickerBtnText, { color: theme }]}>הוסף קבצים</Text>
                </TouchableOpacity>
                {taskFiles.length > 0 && (
                  <View style={styles.fileList}>
                    {taskFiles.map((file, i) => (
                      <View key={i} style={styles.fileChip}>
                        <MaterialCommunityIcons name="file-outline" size={14} color={theme} />
                        <Text style={styles.fileChipText} numberOfLines={1}>{file.name}</Text>
                        {file.size != null && (
                          <Text style={styles.fileChipSize}>{(file.size / 1024).toFixed(0)}KB</Text>
                        )}
                        <TouchableOpacity onPress={() => removeFile(i)} style={styles.fileChipRemove}>
                          <MaterialCommunityIcons name="close-circle" size={14} color="#bbb" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: theme }]} onPress={handleSaveTask}>
                <Text style={styles.submitBtnText}>
                  {editingTaskId !== null ? 'עדכן מטלה' : 'הוסף מטלה'}
                </Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Slot time-picker modal */}
      {pickerSlot && (() => {
        const estimateMins = taskEstimateHours * 60 + taskEstimateMinutes || 60;
        const d            = new Date(pickerSlot.iso + 'T12:00:00');
        const dayName      = HEBREW_DAYS[d.getDay()];
        const dateFmt      = pickerSlot.iso.split('-').reverse().join('/');
        const endPreview   = Math.min(pickerStartMin + estimateMins, pickerSlot.endMin);
        // 30-min steps that leave room for the full duration
        const options: number[] = [];
        for (let t = pickerSlot.startMin; t + estimateMins <= pickerSlot.endMin; t += 30) {
          options.push(t);
        }
        if (options.length === 0) options.push(pickerSlot.startMin);
        return (
          <Modal visible animationType="fade" transparent onRequestClose={() => setPickerSlot(null)}>
            <View style={styles.slotPickerOverlay}>
              <View style={[styles.slotPickerPanel, { backgroundColor: tabBg, borderColor: theme + '55' }]}>
                <Text style={[styles.slotPickerTitle, { color: textColor }]}>{dayName}, {dateFmt}</Text>
                <Text style={[styles.slotPickerSub, { color: textSub }]}>
                  חלון פנוי: {minToTime(pickerSlot.startMin)}–{minToTime(pickerSlot.endMin)}
                </Text>

                <Text style={[styles.slotPickerLabel, { color: textSub }]}>בחרי שעת התחלה:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeOptionsScroll}>
                  {options.map(t => {
                    const selected = pickerStartMin === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        onPress={() => setPickerStartMin(t)}
                        style={[styles.timeOptionBtn, { borderColor: theme }, selected && { backgroundColor: theme }]}
                      >
                        <Text style={[styles.timeOptionText, { color: selected ? '#fff' : theme }]}>{minToTime(t)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.slotPickerEndPreview, { color: textSub }]}>
                  סיום משוער: <Text style={{ color: textColor, fontWeight: '700' }}>{minToTime(endPreview)}</Text>
                </Text>

                <View style={styles.slotPickerActions}>
                  <TouchableOpacity onPress={() => setPickerSlot(null)} style={[styles.slotPickerCancelBtn, { borderColor: borderClr }]}>
                    <Text style={[styles.slotPickerCancelText, { color: textSub }]}>ביטול</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmAddSlot} style={[styles.slotPickerConfirmBtn, { backgroundColor: theme }]}>
                    <MaterialCommunityIcons name="calendar-plus" size={16} color="#fff" />
                    <Text style={styles.slotPickerConfirmText}>הוסף ליומן</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        );
      })()}

      {/* iOS DateTimePicker bottom sheet */}
      {dtPickerOpen && Platform.OS === 'ios' && (
        <Modal visible animationType="slide" transparent>
          <TouchableOpacity style={styles.dtPickerOverlay} activeOpacity={1} onPress={() => setDtPickerOpen(false)}>
            <View style={styles.dtPickerSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.dtPickerHeader}>
                <TouchableOpacity onPress={() => setDtPickerOpen(false)} style={styles.dtPickerHeaderBtn}>
                  <Text style={styles.dtPickerCancelText}>ביטול</Text>
                </TouchableOpacity>
                <Text style={styles.dtPickerTitle}>בחר תאריך</Text>
                <TouchableOpacity
                  onPress={() => {
                    setTaskDueDate(buildDateISO(dtPickerTemp.getDate(), dtPickerTemp.getMonth() + 1, dtPickerTemp.getFullYear()));
                    setDtPickerOpen(false);
                  }}
                  style={styles.dtPickerHeaderBtn}
                >
                  <Text style={[styles.dtPickerDoneText, { color: theme }]}>אישור</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dtPickerTemp}
                mode="date"
                display="spinner"
                onChange={(_, date) => { if (date) setDtPickerTemp(date); }}
                style={styles.dtPickerControl}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Android DateTimePicker */}
      {dtPickerOpen && Platform.OS === 'android' && (
        <DateTimePicker
          value={dtPickerTemp}
          mode="date"
          display="default"
          onChange={(ev, date) => {
            setDtPickerOpen(false);
            if ((ev as any).type === 'set' && date) {
              setTaskDueDate(buildDateISO(date.getDate(), date.getMonth() + 1, date.getFullYear()));
            }
          }}
        />
      )}

      {alertNode}
    </View>
  );
};

const styles = StyleSheet.create({
  container:       { flex: 1 },
  scrollView:      { flex: 1, padding: 15 },
  section:         { marginBottom: 20 },
  separator:       { height: 0 },

  // Task card
  taskItem: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    borderRightWidth: 4,
    borderRightColor: '#CE6385',
    shadowColor: '#3D1568',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.11,
    shadowRadius: 20,
    elevation: 6,
    ...Platform.select({ web: { boxShadow: '6px 6px 20px rgba(61,21,104,0.11), -3px -3px 12px rgba(255,255,255,0.90)' } as any, default: {} }),
  },
  taskCheckBox:        { justifyContent: 'center', marginRight: 12 },
  checkbox:            { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' },
  checkboxCompleted:   { backgroundColor: '#51cf66', borderColor: '#51cf66' },
  taskInfoContainer:   { flex: 1 },
  taskNameText:        { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 3, textAlign: 'right' },
  taskNameCompleted:   { textDecorationLine: 'line-through', color: '#999' },
  taskCourseText:      { fontSize: 12, color: '#999', marginBottom: 3, textAlign: 'right' },
  taskFilesToggle:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  taskFilesText:       { fontSize: 11, color: '#aaa' },
  taskFilesList:       { gap: 4, marginBottom: 5 },
  taskFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF0F5',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  taskFileItemName:    { flex: 1, fontSize: 12, color: '#333' },
  taskMeta:            { flexDirection: 'row', gap: 12, marginTop: 4 },
  taskDueText:         { fontSize: 11, fontWeight: '600' },
  taskEstimateText:    { fontSize: 11, color: '#999' },
  taskRightSection:    { alignItems: 'flex-end', justifyContent: 'space-between' },
  priorityBadge:       { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  priorityText:        { color: '#fff', fontSize: 10, fontWeight: '700' },
  taskActions:         { flexDirection: 'row', gap: 2, marginTop: 6 },
  actionIcon:          { padding: 5 },

  // Empty state
  emptyState:     { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateText: { fontSize: 14, color: '#999', marginTop: 12 },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#CE6385',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#CE6385',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },

  // Modal
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    maxHeight: '90%',
  },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: '#333' },

  // Form
  formGroup: { marginBottom: 20 },
  label:     { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 8, textTransform: 'uppercase', textAlign: 'right' },
  input:     { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 14, backgroundColor: '#f5f5f5', textAlign: 'right' },

  prioritySelector:    { flexDirection: 'row', gap: 8 },
  priorityBtn:         { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#f5f5f5', alignItems: 'center' },
  priorityBtnActive:   { borderColor: '#CE6385', backgroundColor: '#FFF0F5' },
  priorityBtnText:     { fontSize: 12, color: '#999', fontWeight: '600' },
  priorityBtnTextActive: { color: '#CE6385' },

  submitBtn:     { backgroundColor: '#CE6385', paddingVertical: 13, borderRadius: 10, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Web Pickers — same as ScheduleScreen
  webPickerRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, justifyContent: 'flex-end' },
  webPickerCol:       { flexDirection: 'column' },
  webPickerSubLabel:  { fontSize: 11, color: '#aaa', fontWeight: '600', marginBottom: 5 },
  webPickerBase:      { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, height: 44, fontSize: 14, color: '#333' },
  webPickerDay:       { width: 72 },
  webPickerMonth:     { minWidth: 100 },
  webPickerYear:      { width: 92 },
  webPickerHour:      { width: 80 },
  webPickerMinute:    { width: 80 },
  webPickerColonWrap: { paddingBottom: 11 },
  webPickerColon:     { fontSize: 20, fontWeight: '700', color: '#CE6385' },

  // Picker btn (native date)
  pickerBtn:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerBtnText:  { fontSize: 14, color: '#333' },

  // Estimate inputs
  estimateRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  estimateCol:   { flex: 1 },
  estimateInput: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, backgroundColor: '#f5f5f5', textAlign: 'center', color: '#333' },

  // DateTimePicker bottom sheet
  dtPickerOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  dtPickerSheet:      { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  dtPickerHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dtPickerHeaderBtn:  { padding: 4, minWidth: 60 },
  dtPickerTitle:      { fontSize: 15, fontWeight: '700', color: '#333' },
  dtPickerCancelText: { fontSize: 15, color: '#999' },
  dtPickerDoneText:   { fontSize: 15, fontWeight: '700' },
  dtPickerControl:    { height: 200 },

  // File attachment
  filePickerBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#CE6385', borderRadius: 10, borderStyle: 'dashed', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#f8f6ff' },
  filePickerBtnText: { fontSize: 14, color: '#CE6385', fontWeight: '600' },
  fileList:          { marginTop: 10, gap: 6 },
  fileChip:          { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF0F5', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10 },
  fileChipText:      { flex: 1, fontSize: 13, color: '#333' },
  fileChipSize:      { fontSize: 11, color: '#aaa' },
  fileChipRemove:    { padding: 2 },

  // Free slot suggestions
  slotsScroll:    { flexDirection: 'row', marginTop: 4 },
  slotChip:       { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, alignItems: 'center', minWidth: 105 },
  slotChipDay:    { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  slotChipDate:   { fontSize: 11, textAlign: 'center', marginTop: 2 },
  slotChipTime:   { fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  noSlotsText:    { fontSize: 13, textAlign: 'right', marginTop: 4 },

  // Slot time-picker panel
  slotPickerOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  slotPickerPanel:       { width: '100%', borderRadius: 18, padding: 20, borderWidth: 1 },
  slotPickerTitle:       { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  slotPickerSub:         { fontSize: 12, textAlign: 'center', marginBottom: 16 },
  slotPickerLabel:       { fontSize: 12, fontWeight: '600', textAlign: 'right', marginBottom: 10, textTransform: 'uppercase' },
  timeOptionsScroll:     { flexDirection: 'row', marginBottom: 16 },
  timeOptionBtn:         { borderWidth: 1.5, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, marginRight: 8 },
  timeOptionText:        { fontSize: 14, fontWeight: '700' },
  slotPickerEndPreview:  { fontSize: 13, textAlign: 'center', marginBottom: 20 },
  slotPickerActions:     { flexDirection: 'row', gap: 10 },
  slotPickerCancelBtn:   { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  slotPickerCancelText:  { fontSize: 14, fontWeight: '600' },
  slotPickerConfirmBtn:  { flex: 2, borderRadius: 10, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  slotPickerConfirmText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default TasksScreen;
