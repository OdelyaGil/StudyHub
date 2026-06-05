import React, { useState, useEffect, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from './src/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import ThemeContext, { buildTheme, ThemeMode } from './src/context/ThemeContext';
import HomeScreen    from './src/screens/HomeScreen';
import EventsScreen  from './src/screens/EventsScreen';
import TasksScreen   from './src/screens/TasksScreen';
import GradesScreen  from './src/screens/GradesScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AppSidebar, { SIDEBAR_W, SIDEBAR_W_COLLAPSED, TOP_H } from './src/components/AppSidebar';

const Tab = createBottomTabNavigator();

type Props = {
  navigation:   any;
  accent:       string;
  mode:         ThemeMode;
  onSetAccent:  (c: string) => void;
  onSetMode:    (m: ThemeMode) => void;
  onLogout:     () => void;
};

const DashboardScreen = ({ accent, mode, onSetAccent, onSetMode, onLogout }: Props) => {
  const theme = buildTheme(mode, accent);
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 720;

  const [userName,     setUserName]     = useState('');
  const [userAvatar,   setUserAvatar]   = useState<string | null>(null);
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setUserName(data.name || '');
        setUserAvatar(data.photoURL || null);
      }
    });
  }, []);

  const renderTabBar = useCallback((props: any) => (
    <AppSidebar
      {...props}
      userName={userName}
      userAvatar={userAvatar ?? undefined}
      onLogout={onLogout}
      isWide={isWide}
      isOpen={sidebarOpen}
      onOpen={() => setSidebarOpen(true)}
      onClose={() => setSidebarOpen(false)}
      isCollapsed={sidebarCollapsed}
      onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
    />
  ), [userName, userAvatar, onLogout, isWide, sidebarOpen, sidebarCollapsed]);

  const hexToRgba = (hex: string, a: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  return (
    <ThemeContext.Provider value={theme}>
      {theme.accentGradient && (
        <LinearGradient
          colors={theme.accentGradient.map(c => hexToRgba(c, 0.6)) as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <Tab.Navigator
        tabBar={renderTabBar}
        sceneContainerStyle={[
          isWide
            ? { marginLeft: sidebarCollapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W }
            : { paddingTop: TOP_H },
          { backgroundColor: theme.accentGradient ? 'transparent' : theme.bg },
        ]}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Home"    component={HomeScreen} />
        <Tab.Screen name="Events"  component={EventsScreen} />
        <Tab.Screen name="Tasks"   component={TasksScreen} />
        <Tab.Screen name="Grades"  component={GradesScreen} />
        <Tab.Screen name="Library" component={LibraryScreen} />
        <Tab.Screen name="Profile">
          {() => (
            <ProfileScreen
              accent={accent}
              mode={mode}
              onSetAccent={onSetAccent}
              onSetMode={onSetMode}
              onLogout={onLogout}
              onAvatarChange={(url) => setUserAvatar(url)}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </ThemeContext.Provider>
  );
};

export default DashboardScreen;
