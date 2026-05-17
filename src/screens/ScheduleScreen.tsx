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

const ScheduleScreen = () => {
  const [schedule, setSchedule] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState('ראשון');
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [duration, setDuration] = useState('60');
  const [activity, setActivity] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    try {
      const scheduleData = await AsyncStorage.getItem('schedule');
      if (scheduleData) {
        setSchedule(JSON.parse(scheduleData));
      }
    } catch (e) {
      console.log(e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSchedule();
    setRefreshing(false);
  };

  const handleAddSchedule = async () => {
    if (!activity) {
      Alert.alert('שגיאה', 'אנא מלא את שם הפעילות');
      return;
    }

    const newSchedule = {
      id: Date.now(),
      day: selectedDay,
      time: selectedTime,
      duration: parseInt(duration),
      activity: activity,
    };

    const updatedSchedule = [...schedule, newSchedule];
    setSchedule(updatedSchedule);

    try {
      await AsyncStorage.setItem('schedule', JSON.stringify(updatedSchedule));
      setActivity('');
      setSelectedDay('ראשון');
      setSelectedTime('09:00');
      setDuration('60');
      setModalVisible(false);
      Alert.alert('הצלחה', 'השיבוץ נשמר בהצלחה');
    } catch (e) {
      Alert.alert('שגיאה', 'שמירת השיבוץ נכשלה');
    }
  };

  const handleDeleteSchedule = async (id) => {
    Alert.alert('מחק שיבוץ', 'האם אתה בטוח?', [
      { text: 'ביטול', onPress: () => {} },
      {
        text: 'מחק',
        onPress: async () => {
          const updatedSchedule = schedule.filter((s) => s.id !== id);
          setSchedule(updatedSchedule);
          try {
            await AsyncStorage.setItem(
              'schedule',
              JSON.stringify(updatedSchedule)
            );
          } catch (e) {
            console.log(e);
          }
        },
      },
    ]);
  };

  const ScheduleDay = ({ day }) => {
    const daySchedule = schedule
      .filter((s) => s.day === day)
      .sort((a, b) => a.time.localeCompare(b.time));

    return (
      <View style={styles.dayCard}>
        <Text style={styles.dayTitle}>{day}</Text>
        {daySchedule.length > 0 ? (
          daySchedule.map((item) => (
            <View key={item.id} style={styles.scheduleItem}>
              <View style={styles.scheduleTime}>
                <Text style={styles.timeText}>{item.time}</Text>
                <Text style={styles.durationText}>{item.duration}m</Text>
              </View>
              <Text style={styles.activityText}>{item.activity}</Text>
              <TouchableOpacity
                onPress={() => handleDeleteSchedule(item.id)}
                style={styles.deleteScheduleBtn}
              >
                <MaterialCommunityIcons name="close" size={16} color="#ff6b6b" />
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.emptyDayText}>אין פעילויות</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.daysGrid}>
          {days.map((day) => (
            <ScheduleDay key={day} day={day} />
          ))}
        </View>
        {schedule.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="calendar-blank"
              size={60}
              color="#ccc"
            />
            <Text style={styles.emptyStateText}>אין שיבוצים עדיין</Text>
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

      {/* Add Schedule Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>שיבוץ חדש</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>בחר יום</Text>
                <View style={styles.daySelector}>
                  {days.map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayBtn,
                        selectedDay === day && styles.dayBtnActive,
                      ]}
                      onPress={() => setSelectedDay(day)}
                    >
                      <Text
                        style={[
                          styles.dayBtnText,
                          selectedDay === day && styles.dayBtnTextActive,
                        ]}
                      >
                        {day.substring(0, 1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>שעה</Text>
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM"
                  value={selectedTime}
                  onChangeText={setSelectedTime}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>משך (דקות)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>שם הפעילות</Text>
                <TextInput
                  style={styles.input}
                  placeholder="למשל: הרצאה בחדו״א"
                  value={activity}
                  onChangeText={setActivity}
                />
              </View>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleAddSchedule}
              >
                <Text style={styles.submitBtnText}>הוסף שיבוץ</Text>
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
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  dayCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderTopWidth: 3,
    borderTopColor: '#667eea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  dayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667eea',
    marginBottom: 10,
  },
  scheduleItem: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#667eea',
  },
  scheduleTime: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
  },
  durationText: {
    fontSize: 11,
    color: '#999',
  },
  activityText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  deleteScheduleBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  emptyDayText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
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
  daySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayBtn: {
    width: '13%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayBtnActive: {
    borderColor: '#667eea',
    backgroundColor: '#f0f3ff',
  },
  dayBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#999',
  },
  dayBtnTextActive: {
    color: '#667eea',
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

export default ScheduleScreen;
