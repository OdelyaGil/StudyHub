import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './src/config/firebase';
import LoginScreen from './LoginScreen';
import DashboardScreen from './DashboardScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading]   = useState(true);
  const [theme, setTheme]           = useState('#D58EAC');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (snap.exists()) {
            const savedTheme = snap.data().theme;
            if (savedTheme) setTheme(savedTheme);
          }
        } catch (e) { console.log(e); }
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  if (isLoading) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
          {!isLoggedIn ? (
            <Stack.Screen name="Login">
              {(props) => <LoginScreen {...props} onLogin={() => setIsLoggedIn(true)} />}
            </Stack.Screen>
          ) : (
            <Stack.Screen name="Dashboard">
              {(props) => (
                <DashboardScreen
                  {...props}
                  theme={theme}
                  onSetTheme={setTheme}
                  onLogout={() => setIsLoggedIn(false)}
                />
              )}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
