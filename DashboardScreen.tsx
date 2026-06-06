import React, { useState, useEffect, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from './src/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { loadField } from './src/utils/firestore';
import { hexToRgba } from './src/utils/helpers';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
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
  navigation:   NavigationProp<ParamListBase>;
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
    let active = true;
    const user = auth.currentUser;
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then(async snap => {
      if (!active) return;
      if (snap.exists()) setUserName(snap.data().name || '');
      const photo = await loadField('photoURL');
      if (active) setUserAvatar(photo || null);
    });
    return () => { active = false; };
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

  return (
    <ThemeContext.Provider value={theme}>
      {theme.accentGradient && theme.mode === 'light' && (
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
          { backgroundColor: (theme.accentGradient && theme.mode === 'light') ? 'transparent' : theme.bg },
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
