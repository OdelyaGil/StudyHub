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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Picker } from '@react-native-picker/picker';
import { useCustomAlert } from '../hooks/useCustomAlert';

// ── Date helpers ─────────────────────────────────────────────────────────────
const HEBREW_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 16 }, (_, i) => THIS_YEAR - 5 + i);
const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => i);
const MINUTE_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

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

const todayISO = (() => {
  const n = new Date();
  return buildDateISO(n.getDate(), n.getMonth() + 1, n.getFullYear());
})();

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
  const [filesExpanded, setFilesExpanded] = useState(false);
  const daysLeft = getDaysLeft(item.dueDate);
  const priorityColor = item.priority === 'גבוהה' ? '#CE6385' : item.priority === 'בינונית' ? '#EB98B4' : '#4CAFAE';
  const files: TaskFile[] = (item as any).files ?? [];

  return (
    <View style={[styles.taskItem, { opacity: item.completed ? 0.5 : 1 }]}>
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
        <Text style={[styles.taskNameText, item.completed && styles.taskNameCompleted]}>{item.name}</Text>
        {item.course ? <Text style={styles.taskCourseText}>{item.course}</Text> : null}

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
                <MaterialCommunityIcons name="file-outline" size={13} color="#CE6385" />
                <Text style={styles.taskFileItemName} numberOfLines={1}>{file.name}</Text>
                <MaterialCommunityIcons name="download-outline" size={13} color="#CE6385" />
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
            <MaterialCommunityIcons name="pencil-outline" size={17} color="#CE6385" />
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
  const { showAlert, showDestructiveConfirm, alertNode } = useCustomAlert();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);

  // Form state
  const [taskName, setTaskName] = useState('');
  const [taskCourse, setTaskCourse] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(todayISO);
  const [taskPriority, setTaskPriority] = useState('בינונית');
  const [taskEstimateHours, setTaskEstimateHours] = useState(0);
  const [taskEstimateMinutes, setTaskEstimateMinutes] = useState(0);
  const [taskFiles, setTaskFiles] = useState<TaskFile[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadTasks(); }, []);

  const loadTasks = async () => {
    try {
      const data = await AsyncStorage.getItem('tasks');
      if (data) setTasks(JSON.parse(data));
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
    setTaskDueDate(todayISO);
    setTaskPriority('בינונית');
    setTaskEstimateHours(0);
    setTaskEstimateMinutes(0);
    setTaskFiles([]);
  };

  const openEditModal = (task: Task) => {
    setEditingTaskId(task.id);
    setTaskName(task.name);
    setTaskCourse(task.course ?? '');
    setTaskDueDate(task.dueDate ?? todayISO);
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
      for (const asset of result.assets) {
        if ((asset.size ?? 0) > 2 * 1024 * 1024) {
          showAlert('קובץ גדול מדי', `"${asset.name}" גדול מ-2MB ולא ניתן לשמור אותו`);
          continue;
        }
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
      updatedTasks = [...tasks, { id: Date.now(), ...taskData, completed: false }];
    }

    setTasks(updatedTasks);
    try {
      await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));
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
    try { await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks)); } catch (e) { console.log(e); }
  };

  const handleDeleteTask = (id: number) => {
    showDestructiveConfirm('מחק מטלה', 'האם אתה בטוח שברצונך למחוק את המטלה?', 'מחק', async () => {
      const updatedTasks = tasks.filter(t => t.id !== id);
      setTasks(updatedTasks);
      try { await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks)); } catch (e) { console.log(e); }
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
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
            <MaterialCommunityIcons name="checkbox-multiple-marked" size={60} color="#ccc" />
            <Text style={styles.emptyStateText}>אין מטלות עדיין</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add / Edit Task Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTaskId !== null ? 'עריכת מטלה' : 'מטלה חדשה'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <MaterialCommunityIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              {/* Task name */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>שם המטלה</Text>
                <TextInput
                  style={styles.input}
                  placeholder="למשל: פתרון תרגיל 5"
                  value={taskName}
                  onChangeText={setTaskName}
                />
              </View>

              {/* Course */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>קורס</Text>
                <TextInput
                  style={styles.input}
                  placeholder="שם הקורס"
                  value={taskCourse}
                  onChangeText={setTaskCourse}
                />
              </View>

              {/* Due date */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>תאריך הגשה</Text>
                <WebDatePicker iso={taskDueDate} onChange={setTaskDueDate} />
              </View>

              {/* Priority */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>עדיפות</Text>
                <View style={styles.prioritySelector}>
                  {['גבוהה', 'בינונית', 'נמוכה'].map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.priorityBtn, taskPriority === p && styles.priorityBtnActive]}
                      onPress={() => setTaskPriority(p)}
                    >
                      <Text style={[styles.priorityBtnText, taskPriority === p && styles.priorityBtnTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Estimate */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>משך זמן משוער</Text>
                <View style={styles.webPickerRow}>
                  <View style={styles.webPickerCol}>
                    <Text style={styles.webPickerSubLabel}>שעות</Text>
                    <Picker
                      selectedValue={taskEstimateHours}
                      onValueChange={v => setTaskEstimateHours(Number(v))}
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
                      selectedValue={taskEstimateMinutes}
                      onValueChange={v => setTaskEstimateMinutes(Number(v))}
                      style={[styles.webPickerBase, styles.webPickerMinute]}
                    >
                      {MINUTE_OPTIONS.map(m => (
                        <Picker.Item key={m} label={String(m).padStart(2, '0')} value={m} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>

              {/* Files */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>קבצים מצורפים</Text>
                <TouchableOpacity style={styles.filePickerBtn} onPress={handlePickFiles}>
                  <MaterialCommunityIcons name="paperclip" size={18} color="#CE6385" />
                  <Text style={styles.filePickerBtnText}>הוסף קבצים</Text>
                </TouchableOpacity>
                {taskFiles.length > 0 && (
                  <View style={styles.fileList}>
                    {taskFiles.map((file, i) => (
                      <View key={i} style={styles.fileChip}>
                        <MaterialCommunityIcons name="file-outline" size={14} color="#CE6385" />
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

              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveTask}>
                <Text style={styles.submitBtnText}>
                  {editingTaskId !== null ? 'עדכן מטלה' : 'הוסף מטלה'}
                </Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
      </Modal>
      {alertNode}
    </View>
  );
};

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#FFF5F7' },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
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

  // File attachment
  filePickerBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#CE6385', borderRadius: 10, borderStyle: 'dashed', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#f8f6ff' },
  filePickerBtnText: { fontSize: 14, color: '#CE6385', fontWeight: '600' },
  fileList:          { marginTop: 10, gap: 6 },
  fileChip:          { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF0F5', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10 },
  fileChipText:      { flex: 1, fontSize: 13, color: '#333' },
  fileChipSize:      { fontSize: 11, color: '#aaa' },
  fileChipRemove:    { padding: 2 },
});

export default TasksScreen;
