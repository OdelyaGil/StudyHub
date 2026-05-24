import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auth, db } from './src/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import ThemeContext, { buildTheme, ThemeMode } from './src/context/ThemeContext';
import HomeScreen    from './src/screens/HomeScreen';
import ChatsScreen   from './src/screens/ChatsScreen';
import EventsScreen  from './src/screens/EventsScreen';
import TasksScreen   from './src/screens/TasksScreen';
import GradesScreen  from './src/screens/GradesScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Tab = createBottomTabNavigator();

type Props = {
  navigation: any;
  accent: string;
  mode: ThemeMode;
  onSetAccent: (c: string) => void;
  onSetMode: (m: ThemeMode) => void;
  onLogout: () => void;
};

const ICONS: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  Home:    'home-variant',
  Chats:   'chat-processing-outline',
  Events:  'calendar-month-outline',
  Tasks:   'checkbox-multiple-marked-outline',
  Grades:  'school-outline',
  Library: 'bookshelf',
  Profile: 'account-circle-outline',
};

const DashboardScreen = ({ accent, mode, onSetAccent, onSetMode, onLogout }: Props) => {
  const [userName, setUserName] = useState('');
  const theme = buildTheme(mode, accent);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (snap.exists()) setUserName(snap.data().name || '');
    });
  }, []);

  return (
    <ThemeContext.Provider value={theme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerTitle: `שלום ${userName} 👋`,
          headerStyle: {
            backgroundColor: theme.bg,
            borderBottomWidth: 1,
            borderBottomColor: theme.accent + '33',
            shadowColor: 'transparent',
          },
          headerTintColor: theme.accent,
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textSub,
          tabBarStyle: {
            backgroundColor: theme.tabBg,
            borderTopWidth: 1,
            borderTopColor: theme.accent + '22',
            height: 66,
            paddingBottom: 10,
            paddingTop: 8,
          },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={ICONS[route.name] ?? 'circle'} size={size} color={color} />
          ),
        })}
      >
        <Tab.Screen name="Home"    component={HomeScreen}    options={{ tabBarLabel: 'ראשי' }} />
        <Tab.Screen name="Chats"   component={ChatsScreen}   options={{ tabBarLabel: 'שיחות' }} />
        <Tab.Screen name="Events"  component={EventsScreen}  options={{ tabBarLabel: 'אירועים' }} />
        <Tab.Screen name="Tasks"   component={TasksScreen}   options={{ tabBarLabel: 'משימות' }} />
        <Tab.Screen name="Grades"  component={GradesScreen}  options={{ tabBarLabel: 'ציונים' }} />
        <Tab.Screen name="Library" component={LibraryScreen} options={{ tabBarLabel: 'ספריה' }} />
        <Tab.Screen name="Profile" options={{ tabBarLabel: 'פרופיל' }}>
          {() => (
            <ProfileScreen
              accent={accent}
              mode={mode}
              onSetAccent={onSetAccent}
              onSetMode={onSetMode}
              onLogout={onLogout}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </ThemeContext.Provider>
  );
};

export default DashboardScreen;
