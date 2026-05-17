import React, { useState, useEffect } from 'react';
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

const OverviewScreen = () => {
  const [grades, setGrades] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [topics, setTopics] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [avg, setAvg] = useState('-');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const gradesData = await AsyncStorage.getItem('grades');
      const tasksData = await AsyncStorage.getItem('tasks');
      const topicsData = await AsyncStorage.getItem('topics');

      if (gradesData) setGrades(JSON.parse(gradesData));
      if (tasksData) setTasks(JSON.parse(tasksData));
      if (topicsData) setTopics(JSON.parse(topicsData));

      // Calculate average
      if (gradesData) {
        const gradesList = JSON.parse(gradesData);
        if (gradesList.length > 0) {
          const average =
            gradesList.reduce((sum, g) => sum + g.value, 0) / gradesList.length;
          setAvg(average.toFixed(2));
        }
      }
    } catch (e) {
      console.log(e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const activeTasks = tasks.filter((t) => !t.completed).length;
  const topicsKnown = topics.filter((t) => t.known).length;
  const topicsNeedReview = topics.filter((t) => t.needsReview).length;
  const courseCount = new Set(grades.map((g) => g.name)).size;
  const fileCount = 0; // Placeholder

  const StatCard = ({ title, value, icon, colors }) => (
    <LinearGradient colors={colors} style={styles.statCard}>
      <MaterialCommunityIcons name={icon} size={32} color="#fff" />
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </LinearGradient>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          title="ממוצע"
          value={avg}
          icon="chart-line"
          colors={['#667eea', '#764ba2']}
        />
        <StatCard
          title="מטלות"
          value={activeTasks}
          icon="checkbox-multiple-marked"
          colors={['#f093fb', '#f5576c']}
        />
        <StatCard
          title="קורסים"
          value={courseCount}
          icon="school"
          colors={['#4facfe', '#00f2fe']}
        />
        <StatCard
          title="קובצים"
          value={fileCount}
          icon="file-multiple"
          colors={['#fa709a', '#fee140']}
        />
      </View>

      {/* Next Task Section */}
      {activeTasks > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📌 המטלה הקרובה</Text>
          <TouchableOpacity style={styles.taskCard}>
            {tasks
              .filter((t) => !t.completed)
              .sort(
                (a, b) => new Date(a.dueDate) - new Date(b.dueDate)
              )[0] && (
              <>
                <View style={styles.taskHeader}>
                  <View>
                    <Text style={styles.taskName}>
                      {
                        tasks
                          .filter((t) => !t.completed)
                          .sort(
                            (a, b) =>
                              new Date(a.dueDate) - new Date(b.dueDate)
                          )[0].name
                      }
                    </Text>
                    {tasks
                      .filter((t) => !t.completed)
                      .sort(
                        (a, b) => new Date(a.dueDate) - new Date(b.dueDate)
                      )[0].course && (
                      <Text style={styles.taskCourse}>
                        {
                          tasks
                            .filter((t) => !t.completed)
                            .sort(
                              (a, b) =>
                                new Date(a.dueDate) - new Date(b.dueDate)
                            )[0].course
                        }
                      </Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.priorityBadge,
                      {
                        backgroundColor:
                          tasks
                            .filter((t) => !t.completed)
                            .sort(
                              (a, b) =>
                                new Date(a.dueDate) - new Date(b.dueDate)
                            )[0].priority === 'גבוהה'
                            ? '#ff6b6b'
                            : tasks
                                .filter((t) => !t.completed)
                                .sort(
                                  (a, b) =>
                                    new Date(a.dueDate) - new Date(b.dueDate)
                                )[0].priority === 'בינונית'
                            ? '#ffa94d'
                            : '#51cf66',
                      },
                    ]}
                  >
                    <Text style={styles.priorityText}>
                      {
                        tasks
                          .filter((t) => !t.completed)
                          .sort(
                            (a, b) =>
                              new Date(a.dueDate) - new Date(b.dueDate)
                          )[0].priority
                      }
                    </Text>
                  </View>
                </View>
                <Text style={styles.taskDueDate}>
                  ⏰{' '}
                  {Math.ceil(
                    (new Date(
                      tasks
                        .filter((t) => !t.completed)
                        .sort(
                          (a, b) =>
                            new Date(a.dueDate) - new Date(b.dueDate)
                        )[0].dueDate
                    ) -
                      new Date()) /
                      (1000 * 60 * 60 * 24)
                  )}{' '}
                  ימים עד ההגשה
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Learning Progress */}
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

      {/* Empty State */}
      {grades.length === 0 && tasks.length === 0 && topics.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="inbox-multiple"
            size={60}
            color="#ccc"
          />
          <Text style={styles.emptyStateText}>התחל בהוספת ציונים ומטלות</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  statTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    opacity: 0.9,
  },
  statValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 5,
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
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  taskName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  taskCourse: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  priorityBadge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  priorityText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  taskDueDate: {
    fontSize: 13,
    color: '#ff6b6b',
    fontWeight: '600',
  },
  progressGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  progressCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderTopWidth: 3,
    borderTopColor: '#667eea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  progressLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  progressValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#667eea',
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
});

export default OverviewScreen;
