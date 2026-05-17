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
import { LinearGradient } from 'expo-linear-gradient';

const GradesScreen = () => {
  const [grades, setGrades] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [gradeValue, setGradeValue] = useState('');
  const [gradeType, setGradeType] = useState('בחינה סופית');
  const [avg, setAvg] = useState('-');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadGrades();
  }, []);

  const loadGrades = async () => {
    try {
      const gradesData = await AsyncStorage.getItem('grades');
      if (gradesData) {
        const parsed = JSON.parse(gradesData);
        setGrades(parsed);
        calculateAverage(parsed);
      }
    } catch (e) {
      console.log(e);
    }
  };

  const calculateAverage = (gradesList) => {
    if (gradesList.length === 0) {
      setAvg('-');
      return;
    }
    const average =
      gradesList.reduce((sum, g) => sum + g.value, 0) / gradesList.length;
    setAvg(average.toFixed(2));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGrades();
    setRefreshing(false);
  };

  const handleAddGrade = async () => {
    if (!courseName || !gradeValue) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות הנדרשים');
      return;
    }

    const newGrade = {
      id: Date.now(),
      name: courseName,
      code: courseCode,
      value: parseFloat(gradeValue),
      type: gradeType,
      date: new Date().toLocaleDateString('he-IL'),
    };

    const updatedGrades = [...grades, newGrade];
    setGrades(updatedGrades);
    calculateAverage(updatedGrades);

    try {
      await AsyncStorage.setItem('grades', JSON.stringify(updatedGrades));
      setCourseName('');
      setCourseCode('');
      setGradeValue('');
      setGradeType('בחינה סופית');
      setModalVisible(false);
      Alert.alert('הצלחה', 'הציון נשמר בהצלחה');
    } catch (e) {
      Alert.alert('שגיאה', 'שמירת הציון נכשלה');
    }
  };

  const handleDeleteGrade = async (id) => {
    Alert.alert('מחק ציון', 'האם אתה בטוח?', [
      { text: 'ביטול', onPress: () => {} },
      {
        text: 'מחק',
        onPress: async () => {
          const updatedGrades = grades.filter((g) => g.id !== id);
          setGrades(updatedGrades);
          calculateAverage(updatedGrades);
          try {
            await AsyncStorage.setItem('grades', JSON.stringify(updatedGrades));
          } catch (e) {
            console.log(e);
          }
        },
      },
    ]);
  };

  const GradeItem = ({ item }) => (
    <View style={styles.gradeItem}>
      <View style={styles.gradeInfo}>
        <Text style={styles.gradeName}>{item.name}</Text>
        {item.code && <Text style={styles.gradeCode}>קוד: {item.code}</Text>}
        <Text style={styles.gradeType}>{item.type}</Text>
      </View>
      <View style={styles.gradeRight}>
        <Text style={styles.gradeValue}>{item.value}</Text>
        <TouchableOpacity
          onPress={() => handleDeleteGrade(item.id)}
          style={styles.deleteBtn}
        >
          <MaterialCommunityIcons name="trash-can" size={18} color="#ff6b6b" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Average Card */}
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.avgCard}>
          <Text style={styles.avgLabel}>ממוצע כללי</Text>
          <Text style={styles.avgValue}>{avg}</Text>
        </LinearGradient>

        {/* Grades List */}
        {grades.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>רשימת הציונים</Text>
            <FlatList
              data={grades}
              renderItem={({ item }) => <GradeItem item={item} />}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="file-document-outline"
              size={60}
              color="#ccc"
            />
            <Text style={styles.emptyStateText}>אין ציונים עדיין</Text>
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

      {/* Add Grade Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>הוסף ציון חדש</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>שם הקורס</Text>
                <TextInput
                  style={styles.input}
                  placeholder="למשל: חדו״א 1"
                  value={courseName}
                  onChangeText={setCourseName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>קוד הקורס</Text>
                <TextInput
                  style={styles.input}
                  placeholder="למשל: 10101"
                  value={courseCode}
                  onChangeText={setCourseCode}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>הציון (0-100)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0-100"
                  value={gradeValue}
                  onChangeText={setGradeValue}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>סוג הציון</Text>
                <View style={styles.typeSelector}>
                  {['בחינה סופית', 'תרגיל', 'מטלה', 'הגשה'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeBtn,
                        gradeType === type && styles.typeBtnActive,
                      ]}
                      onPress={() => setGradeType(type)}
                    >
                      <Text
                        style={[
                          styles.typeText,
                          gradeType === type && styles.typeTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleAddGrade}
              >
                <Text style={styles.submitBtnText}>הוסף ציון</Text>
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
  avgCard: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  avgLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.9,
  },
  avgValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
    marginTop: 10,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  gradeItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
  },
  gradeInfo: {
    flex: 1,
  },
  gradeName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  gradeCode: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  gradeType: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },
  gradeRight: {
    alignItems: 'flex-end',
  },
  gradeValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#667eea',
    marginBottom: 8,
  },
  deleteBtn: {
    padding: 8,
  },
  separator: {
    height: 8,
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
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  typeBtnActive: {
    borderColor: '#667eea',
    backgroundColor: '#f0f3ff',
  },
  typeText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  typeTextActive: {
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

export default GradesScreen;
