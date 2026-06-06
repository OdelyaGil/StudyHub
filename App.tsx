import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './src/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './LoginScreen';
import DashboardScreen from './DashboardScreen';
import { ThemeMode } from './src/context/ThemeContext';
import { requestNotificationPermission } from './src/utils/notifications';
import ErrorBoundary from './src/components/ErrorBoundary';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading]   = useState(true);
  const [accent, setAccent]         = useState('#CBD8E8');
  const [mode, setMode]             = useState<ThemeMode>('dark');
  const [savedAccent, setSavedAccent] = useState<string | undefined>(undefined);
  const [savedMode,   setSavedMode]   = useState<ThemeMode | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem('savedAccent').then(v => { if (v) { setAccent(v); setSavedAccent(v); } });
    AsyncStorage.getItem('savedMode').then(v => { if (v) { setMode(v as ThemeMode); setSavedMode(v as ThemeMode); } });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (snap.exists()) {
            const d = snap.data();
            if (d.accent) setAccent(d.accent);
            if (d.mode)   setMode(d.mode);
          }
        } catch (e) { console.log(e); }
        requestNotificationPermission();
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  if (isLoading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D0D1A' }}>
      <ActivityIndicator size="large" color="#CBD8E8" />
    </View>
  );

  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
          {!isLoggedIn ? (
            <Stack.Screen name="Login">
              {(props) => <LoginScreen {...props} onLogin={(a, m) => { if (a) setAccent(a); if (m) setMode(m as ThemeMode); setIsLoggedIn(true); }} savedAccent={savedAccent} savedMode={savedMode} />}
            </Stack.Screen>
          ) : (
            <Stack.Screen name="Dashboard">
              {(props) => (
                <DashboardScreen
                  {...props}
                  accent={accent}
                  mode={mode}
                  onSetAccent={setAccent}
                  onSetMode={setMode}
                  onLogout={() => setIsLoggedIn(false)}
                />
              )}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
