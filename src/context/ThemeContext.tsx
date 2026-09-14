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
  danger:     string;
}

// Fixed brand palette ("warm sunset") — the whole app uses these seven colors,
// light to dark. There is no per-user accent customization; only mode (light/
// dark) is user-controlled, and both modes stay within this same palette.
//   #FFD27F  #FFB347  #FF8C42  #E76F51  #D94E4E  #9E2A2B  #2C2A32
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

// Re-lightness a palette color while keeping its hue/family — used to derive
// the sidebar's two background shades from the fixed accent without another
// hand-picked hex.
function reLighten(hex: string, targetL: number): string {
  const [h, s] = hexToHsl(hex);
  return hslToHex(h, Math.min(s, 70), targetL);
}

const PALETTE_LIGHT = '#FFD27F';
const PALETTE_AMBER  = '#FFB347';
const PALETTE_ORANGE = '#FF8C42';
const PALETTE_CORAL  = '#E76F51';
const PALETTE_RED    = '#D94E4E';
const PALETTE_MAROON = '#9E2A2B';
const PALETTE_DARK   = '#2C2A32';

export const buildTheme = (mode: ThemeMode): AppTheme => {
  const dark   = mode === 'dark';
  const accent = dark ? PALETTE_AMBER : PALETTE_ORANGE;
  const accentGradient: [string, string] = dark
    ? [PALETTE_AMBER, PALETTE_CORAL]
    : [PALETTE_LIGHT, PALETTE_AMBER];

  return {
    mode,
    accent,
    accentGradient,
    // Light mode stays transparent so the accentGradient wash (rendered behind
    // the tab navigator) shows through, same mechanism as before.
    bg:         dark ? PALETTE_DARK : 'transparent',
    surface:    dark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    border:     dark ? accent + '55' : '#F3D9BE',
    text:       dark ? '#FFFFFF' : PALETTE_DARK,
    textSub:    dark ? 'rgba(255,255,255,0.55)' : '#8A7F73',
    tabBg:      dark ? '#231F27' : '#FFFFFF',
    sidebarBg:  dark ? reLighten(PALETTE_MAROON, 12) : '#FFFFFF',
    sidebarBg2: dark ? reLighten(PALETTE_MAROON, 8)  : reLighten(PALETTE_LIGHT, 92),
    heroBg:     dark ? PALETTE_MAROON : PALETTE_CORAL,
    heroGlow:   dark ? PALETTE_CORAL  : PALETTE_LIGHT,
    danger:     PALETTE_RED,
  };
};

const ThemeContext = createContext<AppTheme>(buildTheme('light'));
export const useTheme = () => useContext(ThemeContext);
export default ThemeContext;
