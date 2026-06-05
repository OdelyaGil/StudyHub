import { createContext, useContext } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface AppTheme {
  mode:           ThemeMode;
  accent:         string;                    // always a flat hex (for text/icons/borders)
  accentGradient: [string, string] | null;   // null = solid color, otherwise gradient pair
  bg:         string;
  surface:    string;
  border:     string;
  text:       string;
  textSub:    string;
  tabBg:      string;
  sidebarBg:  string;
  sidebarBg2: string;
  heroBg:     string;
  heroGlow:   string;
}

function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = 0;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return [hue * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = h / 360, ss = s / 100, ll = l / 100;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + hh * 12) % 12;
    const c = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function sidebarColor(accent: string, targetL: number): string {
  const [h, s] = hexToHsl(accent);
  return hslToHex(h, Math.min(s, 58), targetL);
}

function triadicColor(accent: string, targetL: number): string {
  const [h, s] = hexToHsl(accent);
  return hslToHex((h + 120) % 360, Math.min(s, 65), targetL);
}

function heroGlowColor(accent: string): string {
  const [h] = hexToHsl(accent);
  return hslToHex((h + 120) % 360, 80, 72);
}

export const buildTheme = (mode: ThemeMode, rawAccent: string): AppTheme => {
  const dark     = mode === 'dark';
  const isGrad   = rawAccent.startsWith('gradient:');
  const gradArr  = isGrad
    ? (rawAccent.replace('gradient:', '').split(',') as [string, string])
    : null;
  const accent   = isGrad ? gradArr![0] : rawAccent;

  return {
    mode,
    accent,
    accentGradient: gradArr,
    bg:         dark ? '#0A0A0F' : '#D9D9ED',
    surface:    dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    border:     dark ? accent + '55' : '#E8E4F4',
    text:       dark ? '#FFFFFF' : '#1A1A2E',
    textSub:    dark ? '#7A7A9A' : '#7A7A9A',
    tabBg:      dark ? '#0D0D1A' : '#FFFFFF',
    sidebarBg:  sidebarColor(accent, 22),
    sidebarBg2: sidebarColor(accent, 15),
    heroBg:     triadicColor(accent, 22),
    heroGlow:   heroGlowColor(accent),
  };
};

const ThemeContext = createContext<AppTheme>(buildTheme('dark', '#00FFFF'));
export const useTheme = () => useContext(ThemeContext);
export default ThemeContext;
