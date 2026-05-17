import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Task {
  id: number;
  name: string;
  course: string;
  dueDate: string;
  priority: string;
  estimate: number;
  description: string;
  completed: boolean;
}

const TasksScreen = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskCourse, setTaskCourse] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState('בינונית');
  const [taskEstimate, setTaskEstimate] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const tasksData = await AsyncStorage.getItem('tasks');
      if (tasksData) {
        setTasks(JSON.parse(tasksData));
      }
    } catch (e) {
      console.log(e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  };

  const handleAddTask = async () => {
    if (!taskName || !taskDueDate) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות הנדרשים');
      return;
    }

    const newTask = {
      id: Date.now(),
      name: taskName,
      course: taskCourse,
      dueDate: taskDueDate,
      priority: taskPriority,
      estimate: taskEstimate ? parseInt(taskEstimate) : 0,
      description: taskDescription,
      completed: false,
    };

    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);

    try {
      await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));
      setTaskName('');
      setTaskCourse('');
      setTaskDueDate('');
      setTaskPriority('בינונית');
      setTaskEstimate('');
      setTaskDescription('');
      setModalVisible(false);
      Alert.alert('הצלחה', 'המטלה נשמרה בהצלחה');
    } catch (e) {
      Alert.alert('שגיאה', 'שמירת המטלה נכשלה');
    }
  };

  const handleToggleTask = async (id: number) => {
    const updatedTasks = tasks.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    setTasks(updatedTasks);
    try {
      await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));
    } catch (e) {
      console.log(e);
    }
  };

  const handleDeleteTask = async (id: number) => {
    Alert.alert('מחק מטלה', 'האם אתה בטוח?', [
      { text: 'ביטול', onPress: () => {} },
      {
        text: 'מחק',
        onPress: async () => {
          const updatedTasks = tasks.filter((t) => t.id !== id);
          setTasks(updatedTasks);
          try {
            await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));
          } catch (e) {
            console.log(e);
          }
        },
      },
    ]);
  };

  const getDaysLeft = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const daysLeft = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft;
  };

  const TaskItem = ({ item }: { item: Task }) => {
    const daysLeft = getDaysLeft(item.dueDate);
    const priorityColor =
      item.priority === 'גבוהה'
        ? '#ff6b6b'
        : item.priority === 'בינונית'
        ? '#ffa94d'
        : '#51cf66';

    return (
      <View
        style={[
          styles.taskItem,
          { opacity: item.completed ? 0.6 : 1 },
        ]}
      >
        <View style={styles.taskCheckBox}>
          <TouchableOpacity
            onPress={() => handleToggleTask(item.id)}
            style={[
              styles.checkbox,
              item.completed && styles.checkboxCompleted,
            ]}
          >
            {item.completed && (
              <MaterialCommunityIcons name="check" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.taskInfoContainer}>
          <Text
            style={[
              styles.taskNameText,
              item.completed && styles.taskNameCompleted,
            ]}
          >
            {item.name}
          </Text>
          {item.course && (
            <Text style={styles.taskCourseText}>{item.course}</Text>
          )}
          {item.description && (
            <Text style={styles.taskDescriptionText}>{item.description}</Text>
          )}
          <View style={styles.taskMeta}>
            <Text
              style={[
                styles.taskDueText,
                daysLeft < 0
                  ? { color: '#ff6b6b' }
                  : daysLeft <= 2
                  ? { color: '#ffa94d' }
                  : { color: '#999' },
              ]}
            >
              ⏰ {daysLeft >= 0 ? `${daysLeft} ימים` : 'חזר לאחור!'}
            </Text>
            {item.estimate > 0 && (
              <Text style={styles.taskEstimateText}>
                ⏱️ {item.estimate} דקות
              </Text>
            )}
          </View>
        </View>

        <View style={styles.taskRightSection}>
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: priorityColor },
            ]}
          >
            <Text style={styles.priorityText}>{item.priority}</Text>
          </View>

          <TouchableOpacity
            onPress={() => handleDeleteTask(item.id)}
            style={styles.deleteIcon}
          >
            <MaterialCommunityIcons name="trash-can" size={18} color="#ff6b6b" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    const priorityOrder: Record<string, number> = { 'גבוהה': 0, 'בינונית': 1, 'נמוכה': 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {tasks.length > 0 ? (
          <View style={styles.section}>
            <FlatList
              data={sortedTasks}
              renderItem={({ item }) => <TaskItem item={item} />}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="checkbox-multiple-marked"
              size={60}
              color="#ccc"
            />
            <Text style={styles.emptyStateText}>אין מטלות עדיין</Text>
          </View>
        )}
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Task Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>מטלה חדשה</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>שם המטלה</Text>
                <TextInput
                  style={styles.input}
                  placeholder="למשל: פתרון תרגיל 5"
                  value={taskName}
                  onChangeText={setTaskName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>קורס</Text>
                <TextInput
                  style={styles.input}
                  placeholder="שם הקורס"
                  value={taskCourse}
                  onChangeText={setTaskCourse}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>תאריך הגשה</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={taskDueDate}
                  onChangeText={setTaskDueDate}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>עדיפות</Text>
                <View style={styles.prioritySelector}>
                  {['גבוהה', 'בינונית', 'נמוכה'].map((priority) => (
                    <TouchableOpacity
                      key={priority}
                      style={[
                        styles.priorityBtn,
                        taskPriority === priority && styles.priorityBtnActive,
                      ]}
                      onPress={() => setTaskPriority(priority)}
                    >
                      <Text
                        style={[
                          styles.priorityBtnText,
                          taskPriority === priority &&
                            styles.priorityBtnTextActive,
                        ]}
                      >
                        {priority}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>משך זמן משוער (דקות)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  value={taskEstimate}
                  onChangeText={setTaskEstimate}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>תיאור המטלה</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="פרטים נוספים"
                  value={taskDescription}
                  onChangeText={setTaskDescription}
                  multiline={true}
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleAddTask}
              >
                <Text style={styles.submitBtnText}>הוסף מטלה</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 15,
  },
  section: {
    marginBottom: 20,
  },
  taskItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  taskCheckBox: {
    justifyContent: 'center',
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#51cf66',
    borderColor: '#51cf66',
  },
  taskInfoContainer: {
    flex: 1,
  },
  taskNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  taskNameCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  taskCourseText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  taskDescriptionText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  taskMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  taskDueText: {
    fontSize: 11,
    fontWeight: '600',
  },
  taskEstimateText: {
    fontSize: 11,
    color: '#999',
  },
  taskRightSection: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  priorityBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  priorityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  deleteIcon: {
    padding: 8,
  },
  separator: {
    height: 0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: '#f5f5f5',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  priorityBtnActive: {
    borderColor: '#667eea',
    backgroundColor: '#f0f3ff',
  },
  priorityBtnText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  priorityBtnTextActive: {
    color: '#667eea',
  },
  submitBtn: {
    backgroundColor: '#667eea',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default TasksScreen;
