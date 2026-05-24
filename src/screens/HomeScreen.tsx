import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadField } from '../utils/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';

const HomeScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [grades, setGrades]   = useState<any[]>([]);
  const [tasks, setTasks]     = useState<any[]>([]);
  const [topics, setTopics]   = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    try {
      const [g, t, tp] = await Promise.all([
        loadField('grades'),
        loadField('tasks'),
        loadField('topics'),
      ]);
      setGrades(g ?? []);
      setTasks(t  ?? []);
      setTopics(tp ?? []);
    } catch (e) { console.log(e); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const avg = grades.length > 0
    ? (grades.filter(g => g.value > 0).reduce((s: number, g: any) => s + g.value, 0) /
       (grades.filter(g => g.value > 0).length || 1)).toFixed(1)
    : '—';

  const activeTasks  = tasks.filter(t => !t.completed).length;
  const courseCount  = new Set(grades.map(g => g.name)).size;
  const topicsDone   = topics.filter(t => t.known).length;
  const topicsTotal  = topics.length;

  const nextTask = tasks.filter(t => !t.completed)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  const isDark = theme.mode === 'dark';

  const StatCard = ({ icon, label, value, onPress }: {
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    label: string;
    value: string | number;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      style={[s.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <MaterialCommunityIcons name={icon} size={22} color={theme.accent} />
      <Text style={[s.statValue, { color: theme.accent },
        isDark && { textShadowColor: theme.accent, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }
      ]}>
        {value}
      </Text>
      <Text style={[s.statLabel, { color: theme.textSub }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={[s.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
    >
      {/* Stats grid */}
      <View style={s.statsGrid}>
        <StatCard icon="chart-line"              label="ממוצע"    value={avg}          onPress={() => navigation.navigate('Grades')} />
        <StatCard icon="checkbox-multiple-marked" label="מטלות"   value={activeTasks} />
        <StatCard icon="school-outline"           label="קורסים"  value={courseCount}  onPress={() => navigation.navigate('Grades')} />
        <StatCard icon="brain"                    label="נושאים"  value={topicsTotal} />
      </View>

      {/* Progress bar */}
      {topicsTotal > 0 && (
        <View style={[s.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.sectionTitle, { color: theme.text }]}>📚 התקדמות למידה</Text>
          <View style={s.progressBarBg}>
            <View style={[s.progressBarFill, { width: `${Math.round((topicsDone / topicsTotal) * 100)}%` as any, backgroundColor: theme.accent }]} />
          </View>
          <Text style={[s.progressText, { color: theme.textSub }]}>
            {topicsDone}/{topicsTotal} נושאים נלמדו ({Math.round((topicsDone / topicsTotal) * 100)}%)
          </Text>
        </View>
      )}

      {/* Next task */}
      {nextTask && (
        <View style={[s.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.sectionTitle, { color: theme.text }]}>📌 המטלה הקרובה</Text>
          <View style={[s.taskRow, { borderLeftColor: theme.accent }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.taskName, { color: theme.text }]}>{nextTask.name}</Text>
              {nextTask.course ? <Text style={[s.taskCourse, { color: theme.textSub }]}>{nextTask.course}</Text> : null}
            </View>
            <View style={[s.badge, { borderColor: theme.accent + '88', backgroundColor: theme.accent + '22' }]}>
              <Text style={[s.badgeText, { color: theme.accent }]}>{nextTask.priority}</Text>
            </View>
          </View>
          <Text style={[s.dueText, { color: '#FF6B6B' }]}>
            ⏰ {Math.ceil((new Date(nextTask.dueDate).getTime() - Date.now()) / 86400000)} ימים עד ההגשה
          </Text>
        </View>
      )}

      {/* Grades tease */}
      {grades.length > 0 && (
        <TouchableOpacity
          style={[s.section, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => navigation.navigate('Grades')}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[s.sectionTitle, { color: theme.text }]}>🎓 ציונים אחרונים</Text>
            <MaterialCommunityIcons name="chevron-left" size={20} color={theme.accent} />
          </View>
          {grades.slice(-3).reverse().map((g: any) => (
            <View key={g.id} style={[s.gradeRow, { borderBottomColor: theme.border }]}>
              <Text style={[s.gradeName, { color: theme.text }]}>{g.name}</Text>
              <Text style={[s.gradeVal, { color: theme.accent },
                isDark && { textShadowColor: theme.accent, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 }
              ]}>
                {g.value > 0 ? g.value : '—'}
              </Text>
            </View>
          ))}
        </TouchableOpacity>
      )}

      {grades.length === 0 && tasks.length === 0 && topics.length === 0 && (
        <View style={s.empty}>
          <MaterialCommunityIcons name="rocket-launch-outline" size={64} color={theme.accent + '55'} />
          <Text style={[s.emptyTitle, { color: theme.text }]}>ברוכה הבאה ל-StudyHub</Text>
          <Text style={[s.emptyText, { color: theme.textSub }]}>התחילי בהוספת ציונים ומטלות</Text>
        </View>
      )}

    </ScrollView>
  );
};

const s = StyleSheet.create({
  container:      { flex: 1 },
  statsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    width: '47%', borderRadius: 16, padding: 16,
    alignItems: 'center', gap: 6,
    borderWidth: 1,
  },
  statValue:      { fontSize: 26, fontWeight: '800' },
  statLabel:      { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  section: {
    borderRadius: 16, padding: 16, marginBottom: 14,
    borderWidth: 1,
  },
  sectionTitle:   { fontSize: 14, fontWeight: '700', marginBottom: 12, textAlign: 'right' },
  progressBarBg:  { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, marginBottom: 8, overflow: 'hidden' },
  progressBarFill:{ height: 8, borderRadius: 4 },
  progressText:   { fontSize: 12, textAlign: 'right' },
  taskRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftWidth: 3, paddingLeft: 12, marginBottom: 8 },
  taskName:       { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  taskCourse:     { fontSize: 11, marginTop: 2, textAlign: 'right' },
  badge:          { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  badgeText:      { fontSize: 10, fontWeight: '700' },
  dueText:        { fontSize: 12, fontWeight: '600', textAlign: 'right' },
  gradeRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  gradeName:      { fontSize: 13, fontWeight: '600', textAlign: 'right' },
  gradeVal:       { fontSize: 18, fontWeight: '800' },
  empty:          { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle:     { fontSize: 18, fontWeight: '700' },
  emptyText:      { fontSize: 13 },
});

export default HomeScreen;
