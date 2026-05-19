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
import { useTheme } from '../context/ThemeContext';

const darken = (hex: string, f = 0.75) => {
  const r = Math.round(parseInt(hex.slice(1,3),16) * f);
  const g = Math.round(parseInt(hex.slice(3,5),16) * f);
  const b = Math.round(parseInt(hex.slice(5,7),16) * f);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
};

interface Topic {
  id: number;
  course: string;
  name: string;
  known: boolean;
  needsReview: boolean;
}

const LearningScreen = () => {
  const theme = useTheme();
  const light = theme + '1F';
  const [topics, setTopics] = useState<Topic[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [topicCourse, setTopicCourse] = useState('');
  const [topicName, setTopicName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadTopics(); }, []);

  const loadTopics = async () => {
    try {
      const topicsData = await AsyncStorage.getItem('topics');
      if (topicsData) setTopics(JSON.parse(topicsData));
    } catch (e) { console.log(e); }
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
    const newTopic: Topic = { id: Date.now(), course: topicCourse, name: topicName, known: false, needsReview: false };
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

  const handleToggleKnown = async (id: number) => {
    const updatedTopics = topics.map(t => t.id === id ? { ...t, known: !t.known } : t);
    setTopics(updatedTopics);
    try { await AsyncStorage.setItem('topics', JSON.stringify(updatedTopics)); } catch (e) { console.log(e); }
  };

  const handleToggleReview = async (id: number) => {
    const updatedTopics = topics.map(t => t.id === id ? { ...t, needsReview: !t.needsReview } : t);
    setTopics(updatedTopics);
    try { await AsyncStorage.setItem('topics', JSON.stringify(updatedTopics)); } catch (e) { console.log(e); }
  };

  const handleDeleteTopic = async (id: number) => {
    Alert.alert('מחק נושא', 'האם אתה בטוח?', [
      { text: 'ביטול', onPress: () => {} },
      {
        text: 'מחק',
        onPress: async () => {
          const updatedTopics = topics.filter(t => t.id !== id);
          setTopics(updatedTopics);
          try { await AsyncStorage.setItem('topics', JSON.stringify(updatedTopics)); } catch (e) { console.log(e); }
        },
      },
    ]);
  };

  const topicsKnown = topics.filter(t => t.known).length;
  const topicsNeedReview = topics.filter(t => t.needsReview).length;

  const TopicItem = ({ item }: { item: Topic }) => (
    <View style={[styles.topicItem, { borderRightColor: theme }]}>
      <View style={styles.topicInfo}>
        <Text style={styles.topicName}>{item.name}</Text>
        {item.course ? <Text style={styles.topicCourse}>{item.course}</Text> : null}
      </View>
      <View style={styles.topicActions}>
        <TouchableOpacity style={[styles.actionBtn, item.known && styles.actionBtnActive]} onPress={() => handleToggleKnown(item.id)}>
          <MaterialCommunityIcons name={item.known ? 'check-circle' : 'check-circle-outline'} size={20} color={item.known ? theme : '#999'} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, item.needsReview && styles.actionBtnActive]} onPress={() => handleToggleReview(item.id)}>
          <MaterialCommunityIcons name="refresh" size={20} color={item.needsReview ? theme : '#999'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteTopic(item.id)} style={styles.actionBtn}>
          <MaterialCommunityIcons name="trash-can" size={20} color="#ff6b6b" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {topics.length > 0 && (
          <View style={styles.statsContainer}>
            <LinearGradient colors={[theme, darken(theme)]} style={styles.statCard}>
              <MaterialCommunityIcons name="check-circle" size={32} color="#fff" />
              <Text style={styles.statLabel}>נושאים שיודעת</Text>
              <Text style={styles.statValue}>{topicsKnown}</Text>
            </LinearGradient>
            <LinearGradient colors={[theme, darken(theme)]} style={styles.statCard}>
              <MaterialCommunityIcons name="refresh" size={32} color="#fff" />
              <Text style={styles.statLabel}>צריכים חזרה</Text>
              <Text style={styles.statValue}>{topicsNeedReview}</Text>
            </LinearGradient>
          </View>
        )}

        {topics.length > 0 ? (
          <View style={styles.section}>
            <FlatList
              data={topics}
              renderItem={({ item }) => <TopicItem item={item} />}
              keyExtractor={item => item.id.toString()}
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

      <TouchableOpacity style={[styles.fab, { backgroundColor: theme, shadowColor: theme }]} onPress={() => setModalVisible(true)}>
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

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
                <TextInput style={styles.input} placeholder="שם הקורס" value={topicCourse} onChangeText={setTopicCourse} textAlign="right" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>שם הנושא</Text>
                <TextInput style={styles.input} placeholder="למשל: פונקציות של משתנה אחד" value={topicName} onChangeText={setTopicName} textAlign="right" />
              </View>
              <View style={[styles.infoBox, { borderRightColor: theme, backgroundColor: light }]}>
                <Text style={[styles.infoText, { color: theme }]}>תוכל לסמן את הנושא כ"יודע" או "צריך חזרה" לאחר הוספה</Text>
                <MaterialCommunityIcons name="information" size={20} color={theme} />
              </View>
              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: theme }]} onPress={handleAddTopic}>
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
  container:      { flex: 1, backgroundColor: '#FFF5F7' },
  scrollView:     { flex: 1, padding: 15 },
  statsContainer: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard:       { flex: 1, borderRadius: 15, padding: 15, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
  statLabel:      { color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 8, opacity: 0.9 },
  statValue:      { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 4 },
  section:        { marginBottom: 20 },
  topicItem: {
    backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRightWidth: 4, borderRightColor: '#4CAFAE',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  topicInfo:       { flex: 1 },
  topicName:       { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 4, textAlign: 'right' },
  topicCourse:     { fontSize: 12, color: '#999', textAlign: 'right' },
  topicActions:    { flexDirection: 'row', gap: 8 },
  actionBtn:       { padding: 8, justifyContent: 'center', alignItems: 'center' },
  actionBtnActive: { backgroundColor: '#FFF0F5', borderRadius: 8 },
  separator:       { height: 0 },
  emptyState:      { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateText:  { fontSize: 14, color: '#999', marginTop: 12 },
  fab: {
    position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#CE6385', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#CE6385', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent:   { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingVertical: 20, maxHeight: '90%' },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:     { fontSize: 18, fontWeight: '700', color: '#333' },
  formGroup:      { marginBottom: 20 },
  label:          { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 8, textTransform: 'uppercase', textAlign: 'right' },
  input:          { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 14, backgroundColor: '#f5f5f5', textAlign: 'right' },
  infoBox:        { backgroundColor: '#FFF0F5', borderRightWidth: 4, borderRightColor: '#CE6385', borderRadius: 8, padding: 12, marginBottom: 20, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoText:       { fontSize: 12, color: '#CE6385', flex: 1, lineHeight: 18, textAlign: 'right' },
  submitBtn:      { backgroundColor: '#CE6385', paddingVertical: 13, borderRadius: 10, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  submitBtnText:  { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default LearningScreen;
