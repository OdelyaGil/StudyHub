import React, { useState, useEffect, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import SwipeBackEdge, { withSwipeBack } from './src/components/SwipeBackEdge';
import { TabHistoryProvider } from './src/context/TabHistoryContext';

const Tab = createBottomTabNavigator();

// Created once at module scope so Tab.Screen's `component=` prop gets a stable
// reference across renders (required for React Navigation's own memoization —
// see withSwipeBack's comment).
const HomeTab    = withSwipeBack(HomeScreen);
const EventsTab  = withSwipeBack(EventsScreen);
const TasksTab   = withSwipeBack(TasksScreen);
const GradesTab  = withSwipeBack(GradesScreen);
const LibraryTab = withSwipeBack(LibraryScreen);

type Props = {
  navigation:   NavigationProp<ParamListBase>;
  mode:         ThemeMode;
  onSetMode:    (m: ThemeMode) => void;
  onLogout:     () => void;
};

const DashboardScreen = ({ mode, onSetMode, onLogout }: Props) => {
  const theme = buildTheme(mode);
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 720;
  const { top: safeTop } = useSafeAreaInsets();

  const [userName,    setUserName]    = useState('');
  const [userAvatar,  setUserAvatar]  = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_W);

  const [activeTabName, setActiveTabName] = useState('Home');
  const tabNavigationRef = React.useRef<NavigationProp<ParamListBase> | null>(null);
  const navigateTab = useCallback((name: string) => tabNavigationRef.current?.navigate(name as never), []);

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

  const renderTabBar = useCallback((props: any) => {
    tabNavigationRef.current = props.navigation;
    return (
      <AppSidebar
        {...props}
        userName={userName}
        userAvatar={userAvatar ?? undefined}
        onLogout={onLogout}
        isWide={isWide}
        isOpen={sidebarOpen}
        onOpen={() => setSidebarOpen(true)}
        onClose={() => setSidebarOpen(false)}
        onCollapsedChange={(c) => setSidebarWidth(c ? SIDEBAR_W_COLLAPSED : SIDEBAR_W)}
      />
    );
  }, [userName, userAvatar, onLogout, isWide, sidebarOpen]);

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
      <TabHistoryProvider activeName={activeTabName} navigate={navigateTab}>
        <Tab.Navigator
          tabBar={renderTabBar}
          screenListeners={{
            state: (e) => {
              const s = (e.data as any)?.state;
              const name = s?.routes?.[s.index]?.name;
              if (name) setActiveTabName(name);
            },
          }}
          sceneContainerStyle={[
            isWide
              ? { marginLeft: sidebarWidth }
              : { paddingTop: TOP_H + safeTop },
            { backgroundColor: (theme.accentGradient && theme.mode === 'light') ? 'transparent' : theme.bg },
          ]}
          screenOptions={{ headerShown: false }}
        >
          <Tab.Screen name="Home"    component={HomeTab} />
          <Tab.Screen name="Events"  component={EventsTab} />
          <Tab.Screen name="Tasks"   component={TasksTab} />
          <Tab.Screen name="Grades"  component={GradesTab} />
          <Tab.Screen name="Library" component={LibraryTab} />
          <Tab.Screen name="Profile">
            {() => (
              <SwipeBackEdge>
                <ProfileScreen
                  mode={mode}
                  onSetMode={onSetMode}
                  onLogout={onLogout}
                  onAvatarChange={(url) => setUserAvatar(url)}
                  onNameChange={(name) => setUserName(name)}
                />
              </SwipeBackEdge>
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </TabHistoryProvider>
    </ThemeContext.Provider>
  );
};

export default DashboardScreen;
