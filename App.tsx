import React, { useState, useEffect } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './src/config/firebase';
import { clearCache } from './src/utils/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './LoginScreen';
import DashboardScreen from './DashboardScreen';
import { ThemeMode } from './src/context/ThemeContext';
import { requestNotificationPermission } from './src/utils/notifications';
import { isFaceLockEnabled } from './src/utils/faceLock';
import FaceLockGate from './src/components/FaceLockGate';
import ErrorBoundary from './src/components/ErrorBoundary';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading]   = useState(true);
  const [mode, setMode]             = useState<ThemeMode>('light');
  const [savedMode,   setSavedMode]   = useState<ThemeMode | undefined>(undefined);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | undefined>(undefined);
  // Privacy gate (Face ID / Touch ID via WebAuthn), independent of Firebase auth —
  // see src/utils/faceLock.ts. faceLockPassed is intentionally plain in-memory
  // state: it must reset to false on every fresh page load, which is exactly what
  // an already-logged-in-but-not-yet-unlocked PWA reopened from the home screen
  // needs (iOS suspends/kills backgrounded PWAs, so "reopen" is effectively reload).
  const [faceLockNeeded, setFaceLockNeeded] = useState(false);
  const [faceLockPassed, setFaceLockPassed] = useState(false);

  const handleLogout = async () => {
    clearCache();
    setFaceLockPassed(false);
    try { await signOut(auth); } catch { setIsLoggedIn(false); }
  };

  useEffect(() => {
    AsyncStorage.getItem('savedMode').then(v => { if (v) { setMode(v as ThemeMode); setSavedMode(v as ThemeMode); } });
  }, []);

  // Global Enter-key support for all buttons on web.
  // TouchableOpacity/Pressable render as <div role="button" tabIndex="0"> in React Native Web.
  // Native elements (INPUT, TEXTAREA, BUTTON, A) handle Enter themselves and are excluded.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const el = document.activeElement as HTMLElement | null;
      if (!el) return;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A' || tag === 'SELECT') return;
      if (el.getAttribute('role') === 'button') {
        e.preventDefault();
        el.click();
      }
    };
    document.addEventListener('keydown', handleEnter);
    return () => document.removeEventListener('keydown', handleEnter);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (!user.emailVerified) {
          setPendingVerificationEmail(user.email ?? undefined);
          setIsLoading(false);
          return;
        }
        // When arriving via the email verification link (?emailVerified=1) the
        // user lands on a new tab.  Do NOT auto-login there — LoginScreen will
        // show the success screen and let the user decide what to do next.
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          if (params.get('emailVerified') === '1') {
            setIsLoading(false);
            return;
          }
        }
        setPendingVerificationEmail(undefined);
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (snap.exists()) {
            const d = snap.data();
            if (d.mode) setMode(d.mode);
          }
        } catch { }
        setFaceLockPassed(false);
        setFaceLockNeeded(await isFaceLockEnabled(user.uid));
        requestNotificationPermission();
        setIsLoggedIn(true);
      } else {
        setPendingVerificationEmail(undefined);
        setFaceLockNeeded(false);
        setFaceLockPassed(false);
        setIsLoggedIn(false);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  if (isLoading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: savedMode === 'dark' ? '#0D0D1A' : '#F4EEF9' }}>
      <ActivityIndicator size="large" color={savedMode === 'dark' ? '#FFB347' : '#FF8C42'} />
    </View>
  );

  return (
    <SafeAreaProvider>
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
          {!isLoggedIn ? (
            <Stack.Screen name="Login">
              {(props) => <LoginScreen {...props} onLogin={() => { setPendingVerificationEmail(undefined); setIsLoggedIn(true); }} savedMode={savedMode} initialPendingEmail={pendingVerificationEmail} />}
            </Stack.Screen>
          ) : faceLockNeeded && !faceLockPassed ? (
            <Stack.Screen name="FaceLock">
              {() => (
                <FaceLockGate
                  uid={auth.currentUser?.uid ?? ''}
                  mode={mode}
                  onUnlock={() => setFaceLockPassed(true)}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>
          ) : (
            <Stack.Screen name="Dashboard">
              {(props) => (
                <DashboardScreen
                  {...props}
                  mode={mode}
                  onSetMode={setMode}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
    </ErrorBoundary>
    </SafeAreaProvider>
  );
}
