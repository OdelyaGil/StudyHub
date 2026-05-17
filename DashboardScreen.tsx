import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OverviewScreen from './src/screens/OverviewScreen';
import GradesScreen from './src/screens/GradesScreen';
import TasksScreen from './src/screens/TasksScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import LearningScreen from './src/screens/LearningScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Tab = createBottomTabNavigator();

type Props = { navigation: any; theme: string; onSetTheme: (c: string) => void; onLogout: () => void };

const ICONS: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  Overview: 'chart-box',
  Grades:   'file-document',
  Tasks:    'checkbox-multiple-marked',
  Schedule: 'calendar',
  Learning: 'brain',
  Profile:  'account-circle',
};

const DashboardScreen = ({ theme, onSetTheme, onLogout }: Props) => {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('userName').then((name) => setUserName(name || ''));
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitle: `שלום ${userName} 👋`,
        headerStyle: { backgroundColor: theme, borderBottomWidth: 0, shadowColor: 'transparent' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        tabBarActiveTintColor: theme,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name={ICONS[route.name] ?? 'circle'} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Overview" component={OverviewScreen} options={{ tabBarLabel: 'סקירה כללית' }} />
      <Tab.Screen name="Grades"   component={GradesScreen}   options={{ tabBarLabel: 'ציונים' }} />
      <Tab.Screen name="Tasks"    component={TasksScreen}    options={{ tabBarLabel: 'מטלות' }} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} options={{ tabBarLabel: 'לוח זמנים' }} />
      <Tab.Screen name="Learning" component={LearningScreen} options={{ tabBarLabel: 'למידה' }} />
      <Tab.Screen name="Profile"  options={{ tabBarLabel: 'פרופיל' }}>
        {() => <ProfileScreen theme={theme} onSetTheme={onSetTheme} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default DashboardScreen;
