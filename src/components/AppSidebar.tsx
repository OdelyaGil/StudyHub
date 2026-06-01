import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// ── Design tokens ─────────────────────────────────────────────────────────────
export const SIDEBAR_W   = 220;
const BG      = '#1B3A6B';   // dark navy
const BG2     = '#152E56';   // darker navy (profile card, bottom card)
const ACTIVE  = 'rgba(255,255,255,0.13)';
const DOT     = '#4A9FFF';   // blue accent dot / icon active
const TEXT    = '#FFFFFF';
const SUB     = 'rgba(255,255,255,0.55)';
const TOP_H   = 56;          // mobile top-bar height

const NAV: { name: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string }[] = [
  { name: 'Home',    icon: 'home-variant-outline',              label: 'ראשי'       },
  { name: 'Events',  icon: 'calendar-month-outline',            label: 'לוח זמנים'  },
  { name: 'Tasks',   icon: 'checkbox-multiple-marked-outline',  label: 'משימות'     },
  { name: 'Grades',  icon: 'school-outline',                    label: 'ציונים'     },
  { name: 'Library', icon: 'bookshelf',                         label: 'ספריה'      },
  { name: 'Profile', icon: 'account-circle-outline',            label: 'פרופיל'     },
];

const SCREEN_TITLE: Record<string, string> = {
  Home: 'ראשי', Events: 'לוח זמנים', Tasks: 'משימות',
  Grades: 'ציונים', Library: 'ספריה', Profile: 'פרופיל',
};

interface Props {
  state:       any;
  navigation:  any;
  userName?:   string;
  onLogout?:   () => void;
  isWide:      boolean;
  isOpen:      boolean;
  onOpen:      () => void;
  onClose:     () => void;
}

const AppSidebar = ({ state, navigation, userName, onLogout, isWide, isOpen, onOpen, onClose }: Props) => {
  const current = state.routes[state.index]?.name ?? 'Home';

  const SidebarBody = () => (
    <View style={styles.body}>

      {/* Logo */}
      <View style={styles.logoRow}>
        <MaterialCommunityIcons name="school" size={26} color={DOT} />
        <Text style={styles.logoText}>StudyHub</Text>
      </View>

      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="account" size={28} color={BG} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName} numberOfLines={1}>{userName || 'משתמש'}</Text>
          <Text style={styles.profileRole}>Student</Text>
        </View>
      </View>

      {/* Section header */}
      <Text style={styles.sectionLabel}>LEARNING</Text>

      {/* Nav items */}
      {NAV.map(item => {
        const active = current === item.name;
        return (
          <TouchableOpacity
            key={item.name}
            style={[styles.navItem, active && styles.navItemActive]}
            onPress={() => { navigation.navigate(item.name); if (!isWide) onClose(); }}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons
              name={item.icon}
              size={20}
              color={active ? DOT : SUB}
              style={{ width: 24 }}
            />
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
            {active && <View style={styles.activePill} />}
          </TouchableOpacity>
        );
      })}

      <View style={{ flex: 1 }} />

      {/* Logout */}
      <TouchableOpacity style={styles.logoutRow} onPress={onLogout}>
        <MaterialCommunityIcons name="logout" size={18} color={SUB} />
        <Text style={styles.logoutText}>התנתק</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Wide (web) ──────────────────────────────────────────────────────────────
  if (isWide) {
    return (
      <View style={styles.sidebarFixed}>
        <SidebarBody />
      </View>
    );
  }

  // ── Narrow (mobile) ─────────────────────────────────────────────────────────
  return (
    <>
      {/* Top bar with hamburger */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onOpen} style={styles.hamburgerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="menu" size={22} color={BG} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{SCREEN_TITLE[current] ?? ''}</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Overlay + sidebar */}
      {isOpen && (
        <>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
          <View style={styles.sidebarOverlay}>
            <SidebarBody />
          </View>
        </>
      )}
    </>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Shared body
  body: {
    flex: 1,
    backgroundColor: BG,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },

  logoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, marginBottom: 20,
  },
  logoText: { fontSize: 19, fontWeight: '800', color: TEXT, letterSpacing: 0.3 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 12, marginBottom: 20,
    backgroundColor: BG2, borderRadius: 12, padding: 12,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  profileName: { fontSize: 13, fontWeight: '700', color: TEXT },
  profileRole: { fontSize: 11, color: SUB, marginTop: 2 },

  sectionLabel: {
    fontSize: 9, fontWeight: '700', color: SUB,
    letterSpacing: 1.8, paddingHorizontal: 20, marginBottom: 6,
  },

  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 11,
    marginHorizontal: 8, borderRadius: 10, marginBottom: 2,
  },
  navItemActive:   { backgroundColor: ACTIVE },
  navLabel:        { flex: 1, fontSize: 14, fontWeight: '600', color: SUB, textAlign: 'right' },
  navLabelActive:  { color: TEXT, fontWeight: '700' },
  activePill: {
    position: 'absolute', right: 0, top: 8, bottom: 8,
    width: 3, borderRadius: 2, backgroundColor: DOT,
  },

  logoutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 14, marginBottom: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  logoutText: { fontSize: 13, fontWeight: '600', color: SUB },

  // Wide: fixed left panel
  sidebarFixed: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: SIDEBAR_W, zIndex: 100,
  },

  // Narrow: top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: TOP_H, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E8EDF5',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 3,
  },
  hamburgerBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center', alignItems: 'center',
  },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: '#1A2E55' },

  // Narrow: overlay
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 99,
  },
  sidebarOverlay: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: SIDEBAR_W, zIndex: 100,
    shadowColor: '#000', shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 16,
  },
});

export { TOP_H };
export default AppSidebar;
