import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

const OverviewScreen = () => {
  const [grades, setGrades]   = useState<any[]>([]);
  const [tasks, setTasks]     = useState<any[]>([]);
  const [topics, setTopics]   = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [avg, setAvg]         = useState('-');

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    try {
      const gradesData = await AsyncStorage.getItem('grades');
      const tasksData  = await AsyncStorage.getItem('tasks');
      const topicsData = await AsyncStorage.getItem('topics');
      if (gradesData) setGrades(JSON.parse(gradesData));
      if (tasksData)  setTasks(JSON.parse(tasksData));
      if (topicsData) setTopics(JSON.parse(topicsData));
      if (gradesData) {
        const list = JSON.parse(gradesData);
        if (list.length > 0) setAvg((list.reduce((s: number, g: any) => s + g.value, 0) / list.length).toFixed(2));
      }
    } catch (e) { console.log(e); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const activeTasks       = tasks.filter(t => !t.completed).length;
  const topicsKnown       = topics.filter(t => t.known).length;
  const topicsNeedReview  = topics.filter(t => t.needsReview).length;
  const courseCount       = new Set(grades.map(g => g.name)).size;

  const nextTask = tasks.filter(t => !t.completed).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  const StatCard = ({ title, value, icon, colors }: { title: string; value: any; icon: any; colors: [string, string] }) => (
    <LinearGradient colors={colors} style={styles.statCard}>
      <MaterialCommunityIcons name={icon} size={32} color="#fff" />
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </LinearGradient>
  );

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.statsGrid}>
        <StatCard title="ממוצע"   value={avg}          icon="chart-line"             colors={['#CE6385', '#9E3F65']} />
        <StatCard title="מטלות"   value={activeTasks}  icon="checkbox-multiple-marked" colors={['#4CAFAE', '#2A8F8E']} />
        <StatCard title="קורסים"  value={courseCount}  icon="school"                 colors={['#EB98B4', '#CE6385']} />
        <StatCard title="נושאים"  value={topics.length} icon="brain"                 colors={['#FCCE90', '#F5A623']} />
      </View>

      {nextTask && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📌 המטלה הקרובה</Text>
          <TouchableOpacity style={styles.taskCard}>
            <View style={styles.taskHeader}>
              <View>
                <Text style={styles.taskName}>{nextTask.name}</Text>
                {nextTask.course ? <Text style={styles.taskCourse}>{nextTask.course}</Text> : null}
              </View>
              <View style={[styles.priorityBadge, {
                backgroundColor: nextTask.priority === 'גבוהה' ? '#CE6385' : nextTask.priority === 'בינונית' ? '#EB98B4' : '#4CAFAE'
              }]}>
                <Text style={styles.priorityText}>{nextTask.priority}</Text>
              </View>
            </View>
            <Text style={styles.taskDueDate}>
              ⏰ {Math.ceil((new Date(nextTask.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} ימים עד ההגשה
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {topics.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📚 התקדמות למידה</Text>
          <View style={styles.progressGrid}>
            <View style={styles.progressCard}>
              <Text style={styles.progressLabel}>נושאים שיודעת</Text>
              <Text style={styles.progressValue}>{topicsKnown}</Text>
            </View>
            <View style={styles.progressCard}>
              <Text style={styles.progressLabel}>צריכים חזרה</Text>
              <Text style={styles.progressValue}>{topicsNeedReview}</Text>
            </View>
          </View>
        </View>
      )}

      {grades.length === 0 && tasks.length === 0 && topics.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="inbox-multiple" size={60} color="#ccc" />
          <Text style={styles.emptyStateText}>התחל בהוספת ציונים ומטלות</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#FFF5F7', padding: 15 },
  statsGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statCard:      { width: '48%', borderRadius: 20, padding: 15, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  statTitle:     { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 10, opacity: 0.9 },
  statValue:     { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 5 },
  section:       { marginBottom: 20 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 12, textAlign: 'right' },
  taskCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 15,
    borderRightWidth: 4, borderRightColor: '#CE6385',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  taskHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  taskName:      { fontSize: 15, fontWeight: '700', color: '#333', textAlign: 'right' },
  taskCourse:    { fontSize: 12, color: '#999', marginTop: 4, textAlign: 'right' },
  priorityBadge: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 12 },
  priorityText:  { color: '#fff', fontSize: 11, fontWeight: '600' },
  taskDueDate:   { fontSize: 13, color: '#ff6b6b', fontWeight: '600', textAlign: 'right' },
  progressGrid:  { flexDirection: 'row', gap: 12 },
  progressCard:  { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 15, alignItems: 'center', borderTopWidth: 3, borderTopColor: '#4CAFAE', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  progressLabel: { fontSize: 12, color: '#999', fontWeight: '600' },
  progressValue: { fontSize: 24, fontWeight: '700', color: '#CE6385', marginTop: 8 },
  emptyState:    { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyStateText:{ fontSize: 14, color: '#999', marginTop: 12 },
});

export default OverviewScreen;
