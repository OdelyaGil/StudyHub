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
  return {
    mode,
    accent,
    bg:      '#0A0A0F',
    surface: 'rgba(255,255,255,0.06)',
    border:  accent + '55',
    text:    '#FFFFFF',
    textSub: '#7A7A9A',
    tabBg:   '#0D0D1A',
  };
};

const ThemeContext = createContext<AppTheme>(buildTheme('dark', '#00FFFF'));
export const useTheme = () => useContext(ThemeContext);
export default ThemeContext;
