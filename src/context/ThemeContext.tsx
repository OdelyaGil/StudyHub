import { createContext, useContext } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface AppTheme {
  mode:    ThemeMode;
  accent:  string;
  bg:      string;
  surface: string;
  border:  string;
  text:    string;
  textSub: string;
  tabBg:   string;
}

export const buildTheme = (mode: ThemeMode, accent: string): AppTheme => {
  const dark = mode === 'dark';
  return {
    mode,
    accent,
    bg:      dark ? '#12152D' : '#EBF0FA',
    surface: dark ? '#1E2140' : '#FFFFFF',
    border:  dark ? '#2D3160' : '#E8EDF5',
    text:    dark ? '#E8EDF8' : '#1A2052',
    textSub: dark ? '#8890B4' : '#9299B8',
    tabBg:   dark ? '#1E2140' : '#FFFFFF',
  };
};

const ThemeContext = createContext<AppTheme>(buildTheme('dark', '#00FFFF'));
export const useTheme = () => useContext(ThemeContext);
export default ThemeContext;
