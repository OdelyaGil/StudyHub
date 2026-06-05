import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useCustomAlert } from '../hooks/useCustomAlert';

// ── Design tokens ─────────────────────────────────────────────────────────────
export const SIDEBAR_W           = 220;
export const SIDEBAR_W_COLLAPSED = 64;

const SIDEBAR_BG = '#FFFFFF';
const ICON_BG    = '#EEF0F9';   // same PAGE_BG as HomeScreen
const TEXT_DARK  = '#2A1550';
const TEXT_SUB   = '#9090B0';
const TOP_H      = 56;

// ── Neumorphic shadow tokens ──────────────────────────────────────────────────
const NEU_BTN = Platform.select<object>({
  web: { boxShadow: '5px 5px 12px #C4C7D8, -4px -4px 10px #FFFFFF' } as any,
  default: {
    shadowColor: '#C0C4D8',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.75,
    shadowRadius: 8,
    elevation: 5,
  },
});

const NEU_BTN_ACTIVE = Platform.select<object>({
  web: { boxShadow: 'inset 3px 3px 8px #B8BCCC, inset -2px -2px 6px #FFFFFF' } as any,
  default: {
    shadowColor: '#C0C4D8',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 2,
  },
});

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

  // ── Collapsed sidebar ───────────────────────────────────────────────────────
  const CollapsedBody = () => (
    <View style={st.bodyCollapsed}>

      {/* Logo */}
      <TouchableOpacity
        style={[st.iconBtn, NEU_BTN as any, st.logoIconBtn]}
        onPress={onToggleCollapse}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="school" size={22} color={theme.accent} />
      </TouchableOpacity>

      {/* Avatar */}
      <View style={[st.avatarBtn, NEU_BTN as any]}>
        {userAvatar
          ? <Image source={{ uri: userAvatar }} style={st.avatarImg} />
          : <MaterialCommunityIcons name="account" size={20} color={TEXT_SUB} />
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
              active ? [{ backgroundColor: theme.accent + '18' }, NEU_BTN_ACTIVE as any] : NEU_BTN as any,
            ]}
            onPress={() => { navigation.navigate(item.name); if (!isWide) onClose(); }}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons
              name={item.icon}
              size={21}
              color={active ? theme.accent : TEXT_SUB}
            />
          </TouchableOpacity>
        );
      })}

      <View style={{ flex: 1 }} />

      {/* Logout */}
      <TouchableOpacity
        style={[st.iconBtn, NEU_BTN as any, { marginBottom: 16 }]}
        onPress={() => showConfirm('התנתקות', 'האם אתה בטוח שברצונך להתנתק?', () => onLogout?.())}
        activeOpacity={0.75}
      >
        <MaterialCommunityIcons name="logout" size={18} color={TEXT_SUB} />
      </TouchableOpacity>

      {alertNode}
    </View>
  );

  // ── Expanded sidebar ────────────────────────────────────────────────────────
  const ExpandedBody = () => (
    <View style={st.body}>

      {/* Logo row */}
      <View style={st.logoRow}>
        <MaterialCommunityIcons name="school" size={26} color={theme.accent} />
        <Text style={st.logoText}>StudyHub</Text>
        <TouchableOpacity
          onPress={onToggleCollapse}
          style={st.collapseBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="chevron-left" size={20} color={TEXT_SUB} />
        </TouchableOpacity>
      </View>

      {/* Profile card */}
      <View style={[st.profileCard, NEU_BTN as any]}>
        <View style={{ flex: 1 }}>
          <Text style={st.profileName} numberOfLines={1}>{userName || 'משתמש'}</Text>
        </View>
        <View style={[st.avatarSmall, NEU_BTN as any]}>
          {userAvatar
            ? <Image source={{ uri: userAvatar }} style={st.avatarSmallImg} />
            : <MaterialCommunityIcons name="account" size={22} color={TEXT_SUB} />
          }
        </View>
      </View>

      {/* Section header */}
      <Text style={st.sectionLabel}>LEARNING</Text>

      {/* Nav items */}
      {NAV.map(item => {
        const active = current === item.name;
        return (
          <TouchableOpacity
            key={item.name}
            style={[
              st.navItem,
              active
                ? [{ backgroundColor: theme.accent + '12' }, NEU_BTN_ACTIVE as any]
                : [{ backgroundColor: ICON_BG }, NEU_BTN as any],
            ]}
            onPress={() => { navigation.navigate(item.name); if (!isWide) onClose(); }}
            activeOpacity={0.75}
          >
            <View style={st.navIconWrap}>
              <MaterialCommunityIcons
                name={item.icon}
                size={19}
                color={active ? theme.accent : TEXT_SUB}
              />
            </View>
            <Text style={[st.navLabel, active && { color: TEXT_DARK, fontWeight: '700' }]}>
              {item.label}
            </Text>
            {active && <View style={[st.activePill, { backgroundColor: theme.accent }]} />}
          </TouchableOpacity>
        );
      })}

      <View style={{ flex: 1 }} />

      {/* Logout */}
      <TouchableOpacity
        style={st.logoutRow}
        onPress={() => showConfirm('התנתקות', 'האם אתה בטוח שברצונך להתנתק?', () => onLogout?.())}
      >
        <MaterialCommunityIcons name="logout" size={18} color={TEXT_SUB} />
        <Text style={st.logoutText}>התנתק</Text>
      </TouchableOpacity>

      {alertNode}
    </View>
  );

  const currentWidth = isCollapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W;

  // ── Wide (web/desktop) ──────────────────────────────────────────────────────
  if (isWide) {
    return (
      <View style={[st.sidebarFixed, { width: currentWidth }]}>
        {isCollapsed ? <CollapsedBody /> : <ExpandedBody />}
      </View>
    );
  }

  // ── Narrow (mobile) ─────────────────────────────────────────────────────────
  return (
    <>
      <View style={st.topBar}>
        <TouchableOpacity
          onPress={onOpen}
          style={[st.hamburgerBtn, NEU_BTN as any]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="menu" size={22} color={TEXT_DARK} />
        </TouchableOpacity>
        <Text style={st.topBarTitle}>{SCREEN_TITLE[current] ?? ''}</Text>
        <View style={{ width: 38 }} />
      </View>

      {isOpen && (
        <>
          <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={onClose} />
          <View style={st.sidebarOverlay}>
            <ExpandedBody />
          </View>
        </>
      )}
    </>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  // ── Collapsed ──────────────────────────────────────────────────────────────
  bodyCollapsed: {
    flex: 1,
    backgroundColor: SIDEBAR_BG,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 10,
  },

  logoIconBtn: {
    marginBottom: 4,
  },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: ICON_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ICON_BG,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 4,
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },

  // ── Expanded ───────────────────────────────────────────────────────────────
  body: {
    flex: 1,
    backgroundColor: SIDEBAR_BG,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },

  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  logoText:    { flex: 1, fontSize: 19, fontWeight: '800', color: '#3D1568', letterSpacing: 0.3 },
  collapseBtn: { padding: 2 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 20,
    borderRadius: 16,
    padding: 12,
    backgroundColor: ICON_BG,
  },
  avatarSmall:    { width: 40, height: 40, borderRadius: 20, backgroundColor: ICON_BG, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarSmallImg: { width: 40, height: 40, borderRadius: 20 },
  profileName:    { fontSize: 13, fontWeight: '700', color: TEXT_DARK },

  sectionLabel: {
    fontSize: 9, fontWeight: '700', color: TEXT_SUB,
    letterSpacing: 1.8, paddingHorizontal: 20, marginBottom: 8,
  },

  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 8,
    marginHorizontal: 8, borderRadius: 14, marginBottom: 4,
  },
  navItemActive: {},
  navIconWrap: {
    width: 36, height: 36, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  navLabel:    { flex: 1, fontSize: 14, fontWeight: '600', color: TEXT_SUB, textAlign: 'right' },
  activePill:  { position: 'absolute', right: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },

  logoutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 14, marginBottom: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(61,21,104,0.08)',
  },
  logoutText: { fontSize: 13, fontWeight: '600', color: TEXT_SUB },

  // ── Fixed panel ────────────────────────────────────────────────────────────
  sidebarFixed: {
    position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 100,
    backgroundColor: SIDEBAR_BG,
    ...Platform.select({
      web: { boxShadow: '6px 0 28px rgba(180,185,210,0.35), -2px 0 8px rgba(255,255,255,0.9)' } as any,
      default: {
        shadowColor: '#B0B5CC',
        shadowOffset: { width: 6, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
        elevation: 12,
      },
    }),
  },

  // ── Mobile top bar ─────────────────────────────────────────────────────────
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: TOP_H, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, backgroundColor: SIDEBAR_BG,
    borderBottomWidth: 1, borderBottomColor: '#E8EDF5',
    ...Platform.select({
      web: { boxShadow: '0 2px 12px rgba(180,185,210,0.3)' } as any,
      default: { shadowColor: '#B0B5CC', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
    }),
  },
  hamburgerBtn:   { width: 38, height: 38, borderRadius: 11, backgroundColor: ICON_BG, justifyContent: 'center', alignItems: 'center' },
  topBarTitle:    { fontSize: 16, fontWeight: '700', color: TEXT_DARK },

  backdrop:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 99 },
  sidebarOverlay: { position: 'absolute', top: 0, left: 0, bottom: 0, width: SIDEBAR_W, zIndex: 100 },
});

export { TOP_H };
export default AppSidebar;
