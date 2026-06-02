import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useCustomAlert } from '../hooks/useCustomAlert';

// ── Design tokens ─────────────────────────────────────────────────────────────
export const SIDEBAR_W            = 220;
export const SIDEBAR_W_COLLAPSED  = 64;
const BG      = '#1B3A6B';
const BG2     = '#152E56';
const ACTIVE  = 'rgba(255,255,255,0.13)';
const DOT     = '#4A9FFF';
const TEXT    = '#FFFFFF';
const SUB     = 'rgba(255,255,255,0.55)';
const TOP_H   = 56;

const NAV: { name: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string }[] = [
  { name: 'Home',    icon: 'home-variant-outline',             label: 'ראשי'       },
  { name: 'Events',  icon: 'calendar-month-outline',           label: 'לוח זמנים'  },
  { name: 'Tasks',   icon: 'checkbox-multiple-marked-outline', label: 'משימות'     },
  { name: 'Grades',  icon: 'school-outline',                   label: 'ציונים'     },
  { name: 'Library', icon: 'bookshelf',                        label: 'ספריה'      },
  { name: 'Profile', icon: 'account-circle-outline',           label: 'פרופיל'     },
];

const SCREEN_TITLE: Record<string, string> = {
  Home: 'ראשי', Events: 'לוח זמנים', Tasks: 'משימות',
  Grades: 'ציונים', Library: 'ספריה', Profile: 'פרופיל',
};

interface Props {
  state:              any;
  navigation:         any;
  userName?:          string;
  userAvatar?:        string;
  onLogout?:          () => void;
  isWide:             boolean;
  isOpen:             boolean;
  onOpen:             () => void;
  onClose:            () => void;
  isCollapsed?:       boolean;
  onToggleCollapse?:  () => void;
}

const AppSidebar = ({
  state, navigation, userName, userAvatar, onLogout,
  isWide, isOpen, onOpen, onClose,
  isCollapsed = false, onToggleCollapse,
}: Props) => {
  const current = state.routes[state.index]?.name ?? 'Home';
  const theme   = useTheme();
  const { showConfirm, alertNode } = useCustomAlert(theme.accent);

  // ── Collapsed sidebar (icons only) ──────────────────────────────────────────
  const CollapsedBody = () => (
    <View style={st.bodyCollapsed}>

      {/* Logo — tap to expand */}
      <TouchableOpacity style={st.collapsedLogoBtn} onPress={onToggleCollapse}>
        <MaterialCommunityIcons name="school" size={24} color={DOT} />
      </TouchableOpacity>

      {/* Avatar */}
      <View style={st.collapsedAvatar}>
        {userAvatar
          ? <Image source={{ uri: userAvatar }} style={st.collapsedAvatarImg} />
          : <MaterialCommunityIcons name="account" size={20} color={BG} />
        }
      </View>

      {/* Nav icons */}
      {NAV.map(item => {
        const active = current === item.name;
        return (
          <TouchableOpacity
            key={item.name}
            style={[st.collapsedNavBtn, active && st.collapsedNavBtnActive]}
            onPress={() => { navigation.navigate(item.name); if (!isWide) onClose(); }}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name={item.icon} size={21} color={active ? DOT : SUB} />
            {active && <View style={st.activePillCollapsed} />}
          </TouchableOpacity>
        );
      })}

      <View style={{ flex: 1 }} />

      {/* Logout */}
      <TouchableOpacity
        style={st.collapsedLogoutBtn}
        onPress={() => showConfirm('התנתקות', 'האם אתה בטוח שברצונך להתנתק?', () => onLogout?.())}
      >
        <MaterialCommunityIcons name="logout" size={18} color={SUB} />
      </TouchableOpacity>
      {alertNode}
    </View>
  );

  // ── Expanded sidebar ─────────────────────────────────────────────────────────
  const ExpandedBody = () => (
    <View style={st.body}>

      {/* Logo + collapse button */}
      <View style={st.logoRow}>
        <MaterialCommunityIcons name="school" size={26} color={DOT} />
        <Text style={st.logoText}>StudyHub</Text>
        <TouchableOpacity onPress={onToggleCollapse} style={st.collapseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="chevron-left" size={20} color={SUB} />
        </TouchableOpacity>
      </View>

      {/* Profile card */}
      <View style={st.profileCard}>
        <View style={{ flex: 1 }}>
          <Text style={st.profileName} numberOfLines={1}>{userName || 'משתמש'}</Text>
        </View>
        <View style={st.avatar}>
          {userAvatar
            ? <Image source={{ uri: userAvatar }} style={st.avatarImage} />
            : <MaterialCommunityIcons name="account" size={28} color={BG} />
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
            style={[st.navItem, active && st.navItemActive]}
            onPress={() => { navigation.navigate(item.name); if (!isWide) onClose(); }}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name={item.icon} size={20} color={active ? DOT : SUB} style={{ width: 24 }} />
            <Text style={[st.navLabel, active && st.navLabelActive]}>{item.label}</Text>
            {active && <View style={st.activePill} />}
          </TouchableOpacity>
        );
      })}

      <View style={{ flex: 1 }} />

      {/* Logout */}
      <TouchableOpacity
        style={st.logoutRow}
        onPress={() => showConfirm('התנתקות', 'האם אתה בטוח שברצונך להתנתק?', () => onLogout?.())}
      >
        <MaterialCommunityIcons name="logout" size={18} color={SUB} />
        <Text style={st.logoutText}>התנתק</Text>
      </TouchableOpacity>
      {alertNode}
    </View>
  );

  const currentWidth = isCollapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W;

  // ── Wide (web) ──────────────────────────────────────────────────────────────
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
        <TouchableOpacity onPress={onOpen} style={st.hamburgerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="menu" size={22} color={BG} />
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
  // Expanded body
  body: {
    flex: 1, backgroundColor: BG,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  logoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, marginBottom: 20,
  },
  logoText:   { flex: 1, fontSize: 19, fontWeight: '800', color: TEXT, letterSpacing: 0.3 },
  collapseBtn:{ padding: 2 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 12, marginBottom: 20,
    backgroundColor: BG2, borderRadius: 12, padding: 12,
  },
  avatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },
  profileName: { fontSize: 13, fontWeight: '700', color: TEXT },

  sectionLabel: { fontSize: 9, fontWeight: '700', color: SUB, letterSpacing: 1.8, paddingHorizontal: 20, marginBottom: 6 },

  navItem:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, marginHorizontal: 8, borderRadius: 10, marginBottom: 2 },
  navItemActive:{ backgroundColor: ACTIVE },
  navLabel:     { flex: 1, fontSize: 14, fontWeight: '600', color: SUB, textAlign: 'right' },
  navLabelActive:{ color: TEXT, fontWeight: '700' },
  activePill:   { position: 'absolute', right: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, backgroundColor: DOT },

  logoutRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, marginBottom: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  logoutText:   { fontSize: 13, fontWeight: '600', color: SUB },

  // Collapsed body
  bodyCollapsed: {
    flex: 1, backgroundColor: BG,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    alignItems: 'center',
  },
  collapsedLogoBtn:     { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  collapsedAvatar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 14 },
  collapsedAvatarImg:   { width: 36, height: 36, borderRadius: 18 },
  collapsedNavBtn:      { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  collapsedNavBtnActive:{ backgroundColor: ACTIVE },
  activePillCollapsed:  { position: 'absolute', right: 0, top: 6, bottom: 6, width: 3, borderRadius: 2, backgroundColor: DOT },
  collapsedLogoutBtn:   { width: 64, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },

  // Fixed panel
  sidebarFixed: { position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 100 },

  // Top bar (mobile)
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: TOP_H, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E8EDF5',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 3,
  },
  hamburgerBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F0F4FF', justifyContent: 'center', alignItems: 'center' },
  topBarTitle:  { fontSize: 16, fontWeight: '700', color: '#1A2E55' },

  backdrop:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 99 },
  sidebarOverlay: { position: 'absolute', top: 0, left: 0, bottom: 0, width: SIDEBAR_W, zIndex: 100, shadowColor: '#000', shadowOffset: { width: 6, height: 0 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 16 },
});

export { TOP_H };
export default AppSidebar;
