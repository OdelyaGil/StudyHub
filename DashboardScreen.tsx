import React, { useState, useEffect, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, useWindowDimensions } from 'react-native';
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

  return (
    <ThemeContext.Provider value={theme}>
      <Tab.Navigator
        tabBar={renderTabBar}
        sceneContainerStyle={
          isWide
            ? { marginLeft: sidebarCollapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W }
            : { paddingTop: TOP_H }
        }
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
