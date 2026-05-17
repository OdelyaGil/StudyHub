import React from 'react';
import {
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OverviewScreen from './src/screens/OverviewScreen';
import GradesScreen from './src/screens/GradesScreen';
import TasksScreen from './src/screens/TasksScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import LearningScreen from './src/screens/LearningScreen';

const Tab = createBottomTabNavigator();

const DashboardScreen = ({ onLogout }: { navigation: any; onLogout: () => void }) => {
  const handleLogout = async () => {
    const doLogout = async () => {
      await AsyncStorage.removeItem('userToken');
      onLogout();
    };

    if (Platform.OS === 'web') {
      if (window.confirm('האם אתה בטוח שברצונך להתנתק?')) {
        await doLogout();
      }
    } else {
      Alert.alert('התנתקות', 'האם אתה בטוח שברצונך להתנתק?', [
        { text: 'ביטול' },
        { text: 'התנתקות', onPress: doLogout },
      ]);
    }
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: '#667eea',
          borderBottomWidth: 0,
          shadowColor: 'transparent',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
        headerRight: () => (
          <Pressable
            style={{ marginRight: 15 }}
            onPress={handleLogout}
          >
            <MaterialCommunityIcons name="logout" size={24} color="#fff" />
          </Pressable>
        ),
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: React.ComponentProps<typeof MaterialCommunityIcons>['name'] = 'circle';

          if (route.name === 'Overview') {
            iconName = 'chart-box';
          } else if (route.name === 'Grades') {
            iconName = 'file-document';
          } else if (route.name === 'Tasks') {
            iconName = 'checkbox-multiple-marked';
          } else if (route.name === 'Schedule') {
            iconName = 'calendar';
          } else if (route.name === 'Learning') {
            iconName = 'brain';
          }

          return (
            <MaterialCommunityIcons name={iconName} size={size} color={color} />
          );
        },
      })}
    >
      <Tab.Screen
        name="Overview"
        component={OverviewScreen}
        options={{ title: 'סקירה כללית' }}
      />
      <Tab.Screen
        name="Grades"
        component={GradesScreen}
        options={{ title: 'ציונים' }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{ title: 'מטלות' }}
      />
      <Tab.Screen
        name="Schedule"
        component={ScheduleScreen}
        options={{ title: 'לוח זמנים' }}
      />
      <Tab.Screen
        name="Learning"
        component={LearningScreen}
        options={{ title: 'למידה' }}
      />
    </Tab.Navigator>
  );
};

export default DashboardScreen;
