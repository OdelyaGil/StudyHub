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

const LearningScreen = () => {
  const [topics, setTopics] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [topicCourse, setTopicCourse] = useState('');
  const [topicName, setTopicName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    try {
      const topicsData = await AsyncStorage.getItem('topics');
      if (topicsData) {
        setTopics(JSON.parse(topicsData));
      }
    } catch (e) {
      console.log(e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTopics();
    setRefreshing(false);
  };

  const handleAddTopic = async () => {
    if (!topicName) {
      Alert.alert('שגיאה', 'אנא הזן שם הנושא');
      return;
    }

    const newTopic = {
      id: Date.now(),
      course: topicCourse,
      name: topicName,
      known: false,
      needsReview: false,
    };

    const updatedTopics = [...topics, newTopic];
    setTopics(updatedTopics);

    try {
      await AsyncStorage.setItem('topics', JSON.stringify(updatedTopics));
      setTopicCourse('');
      setTopicName('');
      setModalVisible(false);
      Alert.alert('הצלחה', 'הנושא נשמר בהצלחה');
    } catch (e) {
      Alert.alert('שגיאה', 'שמירת הנושא נכשלה');
    }
  };

  const handleToggleKnown = async (id) => {
    const updatedTopics = topics.map((t) =>
      t.id === id ? { ...t, known: !t.known } : t
    );
    setTopics(updatedTopics);
    try {
      await AsyncStorage.setItem('topics', JSON.stringify(updatedTopics));
    } catch (e) {
      console.log(e);
    }
  };

  const handleToggleReview = async (id) => {
    const updatedTopics = topics.map((t) =>
      t.id === id ? { ...t, needsReview: !t.needsReview } : t
    );
    setTopics(updatedTopics);
    try {
      await AsyncStorage.setItem('topics', JSON.stringify(updatedTopics));
    } catch (e) {
      console.log(e);
    }
  };

  const handleDeleteTopic = async (id) => {
    Alert.alert('מחק נושא', 'האם אתה בטוח?', [
      { text: 'ביטול', onPress: () => {} },
      {
        text: 'מחק',
        onPress: async () => {
          const updatedTopics = topics.filter((t) => t.id !== id);
          setTopics(updatedTopics);
          try {
            await AsyncStorage.setItem('topics', JSON.stringify(updatedTopics));
          } catch (e) {
            console.log(e);
          }
        },
      },
    ]);
  };

  const topicsKnown = topics.filter((t) => t.known).length;
  const topicsNeedReview = topics.filter((t) => t.needsReview).length;

  const TopicItem = ({ item }) => (
    <View style={styles.topicItem}>
      <View style={styles.topicInfo}>
        <Text style={styles.topicName}>{item.name}</Text>
        {item.course && <Text style={styles.topicCourse}>{item.course}</Text>}
      </View>

      <View style={styles.topicActions}>
        <TouchableOpacity
          style={[styles.actionBtn, item.known && styles.actionBtnActive]}
          onPress={() => handleToggleKnown(item.id)}
        >
          <MaterialCommunityIcons
            name={item.known ? 'check-circle' : 'check-circle-outline'}
            size={20}
            color={item.known ? '#51cf66' : '#999'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, item.needsReview && styles.actionBtnActive]}
          onPress={() => handleToggleReview(item.id)}
        >
          <MaterialCommunityIcons
            name="refresh"
            size={20}
            color={item.needsReview ? '#ffa94d' : '#999'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleDeleteTopic(item.id)}
          style={styles.actionBtn}
        >
          <MaterialCommunityIcons name="trash-can" size={20} color="#ff6b6b" />
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
        {/* Progress Stats */}
        {topics.length > 0 && (
          <View style={styles.statsContainer}>
            <LinearGradient
              colors={['#51cf66', '#2f9e44']}
              style={styles.statCard}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={32}
                color="#fff"
              />
              <Text style={styles.statLabel}>נושאים שיודעת</Text>
              <Text style={styles.statValue}>{topicsKnown}</Text>
            </LinearGradient>

            <LinearGradient
              colors={['#ffa94d', '#e8590f']}
              style={styles.statCard}
            >
              <MaterialCommunityIcons name="refresh" size={32} color="#fff" />
              <Text style={styles.statLabel}>צריכים חזרה</Text>
              <Text style={styles.statValue}>{topicsNeedReview}</Text>
            </LinearGradient>
          </View>
        )}

        {/* Topics List */}
        {topics.length > 0 ? (
          <View style={styles.section}>
            <FlatList
              data={topics}
              renderItem={({ item }) => <TopicItem item={item} />}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="brain" size={60} color="#ccc" />
            <Text style={styles.emptyStateText}>אין נושאי למידה עדיין</Text>
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

      {/* Add Topic Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>נושא חדש</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>קורס (אופציונלי)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="שם הקורס"
                  value={topicCourse}
                  onChangeText={setTopicCourse}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>שם הנושא</Text>
                <TextInput
                  style={styles.input}
                  placeholder="למשל: פונקציות של משתנה אחד"
                  value={topicName}
                  onChangeText={setTopicName}
                />
              </View>

              <View style={styles.infoBox}>
                <MaterialCommunityIcons
                  name="information"
                  size={20}
                  color="#667eea"
                />
                <Text style={styles.infoText}>
                  תוכל לסמן את הנושא כ"יודע" או "צריך חזרה" לאחר הוספה
                </Text>
              </View>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleAddTopic}
              >
                <Text style={styles.submitBtnText}>הוסף נושא</Text>
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
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  statLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
    opacity: 0.9,
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  topicItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  topicInfo: {
    flex: 1,
  },
  topicName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  topicCourse: {
    fontSize: 12,
    color: '#999',
  },
  topicActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnActive: {
    backgroundColor: '#f0f3ff',
    borderRadius: 8,
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
  infoBox: {
    backgroundColor: '#f0f3ff',
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  infoText: {
    fontSize: 12,
    color: '#667eea',
    flex: 1,
    lineHeight: 18,
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

export default LearningScreen;
