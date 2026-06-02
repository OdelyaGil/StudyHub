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
    bg:      dark ? '#0A0A0F' : '#F4F4F8',
    surface: dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    border:  dark ? accent + '55' : '#E0E0E0',
    text:    dark ? '#FFFFFF' : '#1A1A2E',
    textSub: dark ? '#7A7A9A' : '#666680',
    tabBg:   dark ? '#0D0D1A' : '#FFFFFF',
  };
};

const ThemeContext = createContext<AppTheme>(buildTheme('dark', '#00FFFF'));
export const useTheme = () => useContext(ThemeContext);
export default ThemeContext;
