import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useCustomAlert } from '../hooks/useCustomAlert';

export const SIDEBAR_W           = 220;
export const SIDEBAR_W_COLLAPSED = 64;
const TOP_H = 56;

const NAV: { name: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string }[] = [
  { name: 'Home',    icon: 'home-variant-outline',             label: 'ראשי'      },
  { name: 'Events',  icon: 'calendar-month-outline',           label: 'לוח זמנים' },
  { name: 'Tasks',   icon: 'checkbox-multiple-marked-outline', label: 'משימות'    },
  { name: 'Grades',  icon: 'school-outline',                   label: 'ציונים'    },
  { name: 'Library', icon: 'bookshelf',                        label: 'ספריה'     },
  { name: 'Profile', icon: 'account-circle-outline',           label: 'פרופיל'    },
];

const SCREEN_TITLE: Record<string, string> = {
  Home: 'ראשי', Events: 'לוח זמנים', Tasks: 'משימות',
  Grades: 'ציונים', Library: 'ספריה', Profile: 'פרופיל',
};

interface Props {
  state:             any;
  navigation:        any;
  userName?:         string;
  userAvatar?:       string;
  onLogout?:         () => void;
  isWide:            boolean;
  isOpen:            boolean;
  onOpen:            () => void;
  onClose:           () => void;
  isCollapsed?:      boolean;
  onToggleCollapse?: () => void;
}

const AppSidebar = ({
  state, navigation, userName, userAvatar, onLogout,
  isWide, isOpen, onOpen, onClose,
  isCollapsed = false, onToggleCollapse,
}: Props) => {
  const current = state.routes[state.index]?.name ?? 'Home';
  const theme   = useTheme();
  const { showConfirm, alertNode } = useCustomAlert(theme.accent);

  // ── Dynamic tokens based on mode ────────────────────────────────────────────
  const isDark    = theme.mode === 'dark';
  const sidebarBg = isDark ? '#16162A' : '#FFFFFF';
  const iconBg    = isDark ? '#1E1E34' : '#EEF0F9';
  const txtMain   = isDark ? '#FFFFFF' : '#2A1550';
  const txtSub    = isDark ? 'rgba(255,255,255,0.45)' : '#9090B0';
  const divider   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(61,21,104,0.08)';

  // Neumorphic shadows — light or dark variant
  const neuBtn: object = Platform.OS === 'web'
    ? isDark
      ? { boxShadow: '5px 5px 14px rgba(0,0,0,0.55), -3px -3px 10px rgba(255,255,255,0.04)' } as any
      : { boxShadow: '5px 5px 12px #C4C7D8, -4px -4px 10px #FFFFFF' } as any
    : isDark
      ? { shadowColor: '#000', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.55, shadowRadius: 8, elevation: 5 }
      : { shadowColor: '#C0C4D8', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 0.75, shadowRadius: 8, elevation: 5 };

  const neuBtnActive: object = Platform.OS === 'web'
    ? isDark
      ? { boxShadow: 'inset 4px 4px 10px rgba(0,0,0,0.45), inset -3px -3px 7px rgba(255,255,255,0.03)' } as any
      : { boxShadow: 'inset 3px 3px 8px #B8BCCC, inset -2px -2px 6px #FFFFFF' } as any
    : isDark
      ? {}
      : { shadowColor: '#C0C4D8', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 2 };

  // ── Collapsed sidebar ───────────────────────────────────────────────────────
  const CollapsedBody = () => (
    <View style={[st.bodyCollapsed, { backgroundColor: sidebarBg }]}>

      {/* Logo */}
      <TouchableOpacity
        style={[st.iconBtn, neuBtn as any, { backgroundColor: iconBg, marginBottom: 4 }]}
        onPress={onToggleCollapse}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="school" size={22} color={theme.accent} />
      </TouchableOpacity>

      {/* Avatar */}
      <View style={[st.avatarBtn, neuBtn as any, { backgroundColor: iconBg, marginBottom: 4 }]}>
        {userAvatar
          ? <Image source={{ uri: userAvatar }} style={st.avatarImg} />
          : <MaterialCommunityIcons name="account" size={20} color={txtSub} />
        }
      </View>

      {/* Nav icons */}
      {NAV.map(item => {
        const active = current === item.name;
        return (
          <TouchableOpacity
            key={item.name}
            style={[
              st.iconBtn,
              active
                ? [{ backgroundColor: theme.accent + '20' }, neuBtnActive as any]
                : [{ backgroundColor: iconBg }, neuBtn as any],
            ]}
            onPress={() => { navigation.navigate(item.name); if (!isWide) onClose(); }}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons
              name={item.icon}
              size={21}
              color={active ? theme.accent : txtSub}
            />
          </TouchableOpacity>
        );
      })}

      <View style={{ flex: 1 }} />

      {/* Logout */}
      <TouchableOpacity
        style={[st.iconBtn, neuBtn as any, { backgroundColor: iconBg, marginBottom: 16 }]}
        onPress={() => showConfirm('התנתקות', 'האם אתה בטוח שברצונך להתנתק?', () => onLogout?.())}
        activeOpacity={0.75}
      >
        <MaterialCommunityIcons name="logout" size={18} color={txtSub} />
      </TouchableOpacity>

      {alertNode}
    </View>
  );

  // ── Expanded sidebar ────────────────────────────────────────────────────────
  const ExpandedBody = () => (
    <View style={[st.body, { backgroundColor: sidebarBg }]}>

      {/* Logo row */}
      <View style={st.logoRow}>
        <MaterialCommunityIcons name="school" size={26} color={theme.accent} />
        <Text style={[st.logoText, { color: txtMain }]}>StudyHub</Text>
        <TouchableOpacity
          onPress={onToggleCollapse}
          style={st.collapseBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="chevron-left" size={20} color={txtSub} />
        </TouchableOpacity>
      </View>

      {/* Profile card */}
      <View style={[st.profileCard, neuBtn as any, { backgroundColor: iconBg }]}>
        <View style={{ flex: 1 }}>
          <Text style={[st.profileName, { color: txtMain }]} numberOfLines={1}>
            {userName || 'משתמש'}
          </Text>
        </View>
        <View style={[st.avatarSmall, { backgroundColor: sidebarBg }]}>
          {userAvatar
            ? <Image source={{ uri: userAvatar }} style={st.avatarSmallImg} />
            : <MaterialCommunityIcons name="account" size={22} color={txtSub} />
          }
        </View>
      </View>

      {/* Section header */}
      <Text style={[st.sectionLabel, { color: txtSub }]}>LEARNING</Text>

      {/* Nav items */}
      {NAV.map(item => {
        const active = current === item.name;
        return (
          <TouchableOpacity
            key={item.name}
            style={[
              st.navItem,
              active
                ? [{ backgroundColor: theme.accent + '18' }, neuBtnActive as any]
                : [{ backgroundColor: iconBg }, neuBtn as any],
            ]}
            onPress={() => { navigation.navigate(item.name); if (!isWide) onClose(); }}
            activeOpacity={0.75}
          >
            <View style={st.navIconWrap}>
              <MaterialCommunityIcons
                name={item.icon}
                size={19}
                color={active ? theme.accent : txtSub}
              />
            </View>
            <Text style={[st.navLabel, { color: active ? txtMain : txtSub, fontWeight: active ? '700' : '600' }]}>
              {item.label}
            </Text>
            {active && <View style={[st.activePill, { backgroundColor: theme.accent }]} />}
          </TouchableOpacity>
        );
      })}

      <View style={{ flex: 1 }} />

      {/* Logout */}
      <TouchableOpacity
        style={[st.logoutRow, { borderTopColor: divider }]}
        onPress={() => showConfirm('התנתקות', 'האם אתה בטוח שברצונך להתנתק?', () => onLogout?.())}
      >
        <MaterialCommunityIcons name="logout" size={18} color={txtSub} />
        <Text style={[st.logoutText, { color: txtSub }]}>התנתק</Text>
      </TouchableOpacity>

      {alertNode}
    </View>
  );

  const currentWidth = isCollapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W;

  // ── Wide (web/desktop) ──────────────────────────────────────────────────────
  if (isWide) {
    return (
      <View style={[
        st.sidebarFixed,
        { width: currentWidth, backgroundColor: sidebarBg },
        isDark
          ? (Platform.OS === 'web'
            ? { boxShadow: '6px 0 28px rgba(0,0,0,0.5), -2px 0 8px rgba(255,255,255,0.02)' } as any
            : { shadowColor: '#000', shadowOffset: { width: 6, height: 0 }, shadowOpacity: 0.5, shadowRadius: 18, elevation: 12 })
          : (Platform.OS === 'web'
            ? { boxShadow: '6px 0 28px rgba(180,185,210,0.35), -2px 0 8px rgba(255,255,255,0.9)' } as any
            : { shadowColor: '#B0B5CC', shadowOffset: { width: 6, height: 0 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 12 }),
      ]}>
        {isCollapsed ? <CollapsedBody /> : <ExpandedBody />}
      </View>
    );
  }

  // ── Narrow (mobile) ─────────────────────────────────────────────────────────
  return (
    <>
      <View style={[
        st.topBar,
        { backgroundColor: sidebarBg, borderBottomColor: divider },
        isDark
          ? (Platform.OS === 'web' ? { boxShadow: '0 2px 12px rgba(0,0,0,0.4)' } as any : { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4 })
          : (Platform.OS === 'web' ? { boxShadow: '0 2px 12px rgba(180,185,210,0.3)' } as any : { shadowColor: '#B0B5CC', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 }),
      ]}>
        <TouchableOpacity
          onPress={onOpen}
          style={[st.hamburgerBtn, neuBtn as any, { backgroundColor: iconBg }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="menu" size={22} color={txtMain} />
        </TouchableOpacity>
        <Text style={[st.topBarTitle, { color: txtMain }]}>{SCREEN_TITLE[current] ?? ''}</Text>
        <View style={{ width: 38 }} />
      </View>

      {isOpen && (
        <>
          <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={onClose} />
          <View style={[st.sidebarOverlay, { backgroundColor: sidebarBg }]}>
            <ExpandedBody />
          </View>
        </>
      )}
    </>
  );
};

// ── Styles (geometry only) ────────────────────────────────────────────────────
const st = StyleSheet.create({
  bodyCollapsed: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 10,
  },

  iconBtn: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },

  avatarBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },

  body: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },

  logoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, marginBottom: 20,
  },
  logoText:    { flex: 1, fontSize: 19, fontWeight: '800', letterSpacing: 0.3 },
  collapseBtn: { padding: 2 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 12, marginBottom: 20,
    borderRadius: 16, padding: 12,
  },
  avatarSmall:    { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarSmallImg: { width: 40, height: 40, borderRadius: 20 },
  profileName:    { fontSize: 13, fontWeight: '700' },

  sectionLabel: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1.8,
    paddingHorizontal: 20, marginBottom: 8,
  },

  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 8,
    marginHorizontal: 8, borderRadius: 14, marginBottom: 4,
  },
  navIconWrap: {
    width: 36, height: 36, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  navLabel:   { flex: 1, fontSize: 14, textAlign: 'right' },
  activePill: { position: 'absolute', right: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },

  logoutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 14, marginBottom: 12,
    borderTopWidth: 1,
  },
  logoutText: { fontSize: 13, fontWeight: '600' },

  sidebarFixed: {
    position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 100,
  },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: TOP_H, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, borderBottomWidth: 1,
  },
  hamburgerBtn:   { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  topBarTitle:    { fontSize: 16, fontWeight: '700' },

  backdrop:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 99 },
  sidebarOverlay: { position: 'absolute', top: 0, left: 0, bottom: 0, width: SIDEBAR_W, zIndex: 100 },
});

export { TOP_H };
export default AppSidebar;
