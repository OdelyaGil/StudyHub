import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import ScheduleScreen from './ScheduleScreen';

const EventsScreen = () => {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScheduleScreen />
    </View>
  );
};

export default EventsScreen;
