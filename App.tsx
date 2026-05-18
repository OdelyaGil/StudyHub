import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import LoginScreen from './LoginScreen';
import DashboardScreen from './DashboardScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading]   = useState(true);
  const [theme, setTheme]           = useState('#CE6385');

  useEffect(() => { bootstrapAsync(); }, []);

  const bootstrapAsync = async () => {
    try {
      const [userToken, savedTheme] = await AsyncStorage.multiGet(['userToken', 'appTheme']);
      setIsLoggedIn(!!userToken[1]);
      if (savedTheme[1]) setTheme(savedTheme[1]);
    } catch (e) {
      console.log(e);
    } finally {
      setIsLoading(false);
    }
  };

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
