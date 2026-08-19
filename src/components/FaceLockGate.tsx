import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { buildTheme, ThemeMode } from '../context/ThemeContext';
import { verifyFaceLock } from '../utils/faceLock';

type Props = {
  uid: string;
  accent: string;
  mode: ThemeMode;
  onUnlock: () => void;
  onLogout: () => void;
};

const FaceLockGate = ({ uid, accent, mode, onUnlock, onLogout }: Props) => {
  const theme = buildTheme(mode, accent);
  const [checking, setChecking] = useState(false);
  const [failed,   setFailed]   = useState(false);
  const autoTried = useRef(false);

  // Browsers gate navigator.credentials.get() behind a recent user gesture, but
  // that requirement is inconsistent across browsers/OS versions — some allow it
  // right on mount (e.g. right after tapping the PWA's home-screen icon still
  // counts on some platforms), some don't. Try silently once on mount; if the
  // browser blocks it, this fails invisibly and the button below is the fallback
  // — no error shown for that first silent attempt, since blocking it is normal,
  // expected behavior there, not a real failure.
  const tryUnlock = async (silent: boolean) => {
    setChecking(true);
    if (!silent) setFailed(false);
    const ok = await verifyFaceLock(uid);
    setChecking(false);
    if (ok) onUnlock();
    else if (!silent) setFailed(true);
  };

  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    tryUnlock(true);
  }, []);

  return (
    <View style={[st.wrap, { backgroundColor: theme.bg }]}>
      <View style={[st.iconCircle, { backgroundColor: theme.accent + '22', borderColor: theme.accent }]}>
        <MaterialCommunityIcons name="face-recognition" size={44} color={theme.accent} />
      </View>
      <Text style={[st.title, { color: theme.text }]}>נעילת פרטיות</Text>
      <Text style={[st.subtitle, { color: theme.textSub }]}>
        אמת/י זהות באמצעות זיהוי פנים כדי להמשיך
      </Text>

      {failed && (
        <Text style={[st.errorText, { color: '#ff6b6b' }]}>
          האימות נכשל או בוטל. נסה/י שוב.
        </Text>
      )}

      <TouchableOpacity
        style={[st.unlockBtn, { backgroundColor: theme.accent }]}
        onPress={() => tryUnlock(false)}
        disabled={checking}
        activeOpacity={0.85}
      >
        {checking
          ? <ActivityIndicator color="#fff" />
          : <>
              <MaterialCommunityIcons name="face-recognition" size={20} color="#fff" />
              <Text style={st.unlockBtnText}>פתח/י עם זיהוי פנים</Text>
            </>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={onLogout} style={st.logoutLink}>
        <Text style={[st.logoutLinkText, { color: theme.textSub }]}>התנתק/י והתחבר/י מחדש</Text>
      </TouchableOpacity>
    </View>
  );
};

const st = StyleSheet.create({
  wrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  title:    { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  errorText: { fontSize: 13, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  unlockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 15, paddingHorizontal: 28, borderRadius: 14,
    minWidth: 220, justifyContent: 'center',
  },
  unlockBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  logoutLink:     { marginTop: 24, padding: 8 },
  logoutLinkText: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
});

export default FaceLockGate;
