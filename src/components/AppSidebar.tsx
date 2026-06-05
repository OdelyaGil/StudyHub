import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useCustomAlert } from '../hooks/useCustomAlert';

// ── Static layout constants ───────────────────────────────────────────────────
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

  // ── Dynamic colors from theme ─────────────────────────────────────────────
  const bg       = theme.sidebarBg;
  const bg2      = theme.sidebarBg2;
  const txtMain  = '#FFFFFF';
  const txtSub   = 'rgba(255,255,255,0.5)';

  // Neumorphic raised — works on any dark colored background
  const neuBtn = Platform.select<object>({
    web: { boxShadow: '5px 5px 14px rgba(0,0,0,0.45), -3px -3px 10px rgba(255,255,255,0.07)' } as any,
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 0.45,
      shadowRadius: 8,
      elevation: 5,
    },
  });

  // Neumorphic pressed/active inset
  const neuBtnActive = Platform.select<object>({
    web: { boxShadow: 'inset 4px 4px 10px rgba(0,0,0,0.4), inset -3px -3px 8px rgba(255,255,255,0.05)' } as any,
    default: {},
  });

  // ── Collapsed sidebar ───────────────────────────────────────────────────────
  const CollapsedBody = () => (
    <View style={[st.bodyCollapsed, { backgroundColor: bg }]}>

      {/* Logo */}
      <TouchableOpacity
        style={[st.iconBtn, neuBtn as any, { backgroundColor: bg2, marginBottom: 4 }]}
        onPress={onToggleCollapse}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="school" size={22} color={txtMain} />
      </TouchableOpacity>

      {/* Avatar */}
      <View style={[st.avatarBtn, neuBtn as any, { backgroundColor: bg2, marginBottom: 4 }]}>
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
                ? [{ backgroundColor: theme.accent + '30' }, neuBtnActive as any]
                : [{ backgroundColor: bg2 }, neuBtn as any],
            ]}
            onPress={() => { navigation.navigate(item.name); if (!isWide) onClose(); }}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons
              name={item.icon}
              size={21}
              color={active ? '#FFFFFF' : txtSub}
            />
          </TouchableOpacity>
        );
      })}

      <View style={{ flex: 1 }} />

      {/* Logout */}
      <TouchableOpacity
        style={[st.iconBtn, neuBtn as any, { backgroundColor: bg2, marginBottom: 16 }]}
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
    <View style={[st.body, { backgroundColor: bg }]}>

      {/* Logo row */}
      <View style={st.logoRow}>
        <MaterialCommunityIcons name="school" size={26} color={txtMain} />
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
      <View style={[st.profileCard, neuBtn as any, { backgroundColor: bg2 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[st.profileName, { color: txtMain }]} numberOfLines={1}>
            {userName || 'משתמש'}
          </Text>
        </View>
        <View style={[st.avatarSmall, { backgroundColor: bg }]}>
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
                ? [{ backgroundColor: theme.accent + '30' }, neuBtnActive as any]
                : [{ backgroundColor: bg2 }, neuBtn as any],
            ]}
            onPress={() => { navigation.navigate(item.name); if (!isWide) onClose(); }}
            activeOpacity={0.75}
          >
            <View style={st.navIconWrap}>
              <MaterialCommunityIcons
                name={item.icon}
                size={19}
                color={active ? '#FFFFFF' : txtSub}
              />
            </View>
            <Text style={[st.navLabel, { color: active ? txtMain : txtSub, fontWeight: active ? '700' : '600' }]}>
              {item.label}
            </Text>
            {active && <View style={[st.activePill, { backgroundColor: '#FFFFFF' }]} />}
          </TouchableOpacity>
        );
      })}

      <View style={{ flex: 1 }} />

      {/* Logout */}
      <TouchableOpacity
        style={[st.logoutRow, { borderTopColor: 'rgba(255,255,255,0.1)' }]}
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
      <View style={[st.sidebarFixed, { width: currentWidth, backgroundColor: bg }]}>
        {isCollapsed ? <CollapsedBody /> : <ExpandedBody />}
      </View>
    );
  }

  // ── Narrow (mobile) ─────────────────────────────────────────────────────────
  return (
    <>
      <View style={[st.topBar, { backgroundColor: bg }]}>
        <TouchableOpacity
          onPress={onOpen}
          style={[st.hamburgerBtn, neuBtn as any, { backgroundColor: bg2 }]}
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
          <View style={[st.sidebarOverlay, { backgroundColor: bg }]}>
            <ExpandedBody />
          </View>
        </>
      )}
    </>
  );
};

// ── Styles (geometry only — no colors) ───────────────────────────────────────
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
    ...Platform.select({
      web: { boxShadow: '6px 0 28px rgba(0,0,0,0.25)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 6, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 18,
        elevation: 12,
      },
    }),
  },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: TOP_H, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    ...Platform.select({
      web: { boxShadow: '0 2px 12px rgba(0,0,0,0.2)' } as any,
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
    }),
  },
  hamburgerBtn:   { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  topBarTitle:    { fontSize: 16, fontWeight: '700' },

  backdrop:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 99 },
  sidebarOverlay: { position: 'absolute', top: 0, left: 0, bottom: 0, width: SIDEBAR_W, zIndex: 100 },
});

export { TOP_H };
export default AppSidebar;
