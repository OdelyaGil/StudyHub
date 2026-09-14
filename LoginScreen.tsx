import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
  type TextInput as TextInputType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  sendPasswordResetEmail,
  deleteUser,
  signOut,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './src/config/firebase';
import { useCustomAlert } from './src/hooks/useCustomAlert';
import { validatePassword } from './src/utils/helpers';

// Fixed brand palette — same "warm sunset" palette as ThemeContext.tsx. There is
// no per-user accent customization anymore, so these are the only colors the
// login screen (and its button/link accent) ever uses.
const ACCENT_LIGHT = '#FF8C42';
const ACCENT_DARK  = '#FFB347';
const GRAD_LIGHT: [string, string] = ['#FF8C42', '#E76F51'];
const GRAD_DARK:  [string, string] = ['#FFB347', '#E76F51'];
const LOGIN_BG:    [string, string] = ['#FFFFFF', '#FFFFFF'];
const NEW_USER_MODE      = 'light';
const VERIFY_TIMEOUT_MS  = 10 * 60 * 1000; // 10 minutes

const LoginScreen = ({ onLogin, savedMode, initialPendingEmail }: { navigation: any; onLogin: () => void; savedMode?: string; initialPendingEmail?: string }) => {
  const isDark  = savedMode === 'dark';
  const ACCENT  = isDark ? ACCENT_DARK : ACCENT_LIGHT;
  const GRAD: [string, string] = isDark ? GRAD_DARK : GRAD_LIGHT;

  const BG      = isDark ? '#0A0A1A' : '#F4EEF9';
  const SURFACE = isDark ? '#111128' : '#FFFFFF';
  const TEXT    = isDark ? '#FFFFFF' : '#1A1A2E';
  const SUB     = isDark ? 'rgba(255,255,255,0.5)' : '#9299B8';
  const BORDER  = isDark ? ACCENT + '44' : '#EBE4F4';
  const SHADOW  = isDark ? ACCENT + '40' : '#C9B8DF';

  const neuShadow = Platform.select<object>({
    web: { boxShadow: `6px 6px 18px ${SHADOW}, -6px -6px 18px ${isDark ? '#ffffff08' : '#FFFFFF'}` } as any,
    default: {
      shadowColor: SHADOW,
      shadowOffset: { width: 6, height: 6 },
      shadowOpacity: 0.9,
      shadowRadius: 14,
      elevation: 4,
    },
  }) ?? {};

  const { showAlert, alertNode } = useCustomAlert(ACCENT);
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);

  const [showRegister, setShowRegister] = useState(false);
  const [regName, setRegName]           = useState('');
  const [regEmail, setRegEmail]         = useState('');
  const [regPassword, setRegPassword]         = useState('');
  const [regConfirm, setRegConfirm]           = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm]   = useState(false);
  const [regLoading, setRegLoading]           = useState(false);

  const [showForgot, setShowForgot]       = useState(false);
  const [forgotEmail, setForgotEmail]     = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const [waitingVerification, setWaitingVerification] = useState(false);
  const [pendingEmail, setPendingEmail]               = useState('');
  // Initialise from URL so the first render already shows the success screen
  // with no intermediate flash of the login form.
  const [emailJustVerified, setEmailJustVerified] = useState(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('emailVerified') === '1';
  });

  const passwordRef = useRef<TextInputType>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('emailVerified') === '1') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (initialPendingEmail) {
      setPendingEmail(initialPendingEmail);
      setWaitingVerification(true);
    }
  }, [initialPendingEmail]);

  useEffect(() => {
    if (!waitingVerification) return;
    const startedAt = Date.now();
    const id = setInterval(async () => {
      if (Date.now() - startedAt > VERIFY_TIMEOUT_MS) {
        clearInterval(id);
        setWaitingVerification(false);
        return;
      }
      const user = auth.currentUser;
      if (!user) { clearInterval(id); setWaitingVerification(false); return; }
      await user.reload();
      if (auth.currentUser?.emailVerified) {
        clearInterval(id);
        setWaitingVerification(false);
        onLogin();
      }
    }, 3000);
    return () => clearInterval(id);
  }, [waitingVerification]);

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const sendVerificationEmail = async (email: string, continueUrl?: string) => {
    const base = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.EXPO_PUBLIC_VERCEL_URL ?? '');
    await fetch(`${base}/api/send-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, continueUrl }),
    });
  };

  const handleLogin = async () => {
    if (!validateEmail(email)) return showAlert('שגיאה', 'אנא הזן/י כתובת דוא"ל תקנית');
    if (password.length < 8)   return showAlert('שגיאה', 'הסיסמה חייבת להכיל לפחות 8 תווים');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
      if (!cred.user.emailVerified) {
        setPendingEmail(email.toLowerCase());
        setWaitingVerification(true);
        return;
      }
      onLogin();
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        // Firebase SDK merges user-not-found and wrong-password into
        // auth/invalid-credential, so we distinguish them with a secondary check.
        try {
          const methods = await fetchSignInMethodsForEmail(auth, email.toLowerCase());
          if (methods.length === 0) {
            showAlert('שגיאה', 'כתובת המייל אינה רשומה במערכת');
          } else {
            showAlert('שגיאה', 'הסיסמה שגויה. אנא נסה/י שוב.');
          }
        } catch {
          showAlert('שגיאה', 'כתובת המייל או הסיסמה שגויים');
        }
      } else if (code === 'auth/too-many-requests')
        showAlert('שגיאה', 'יותר מדי ניסיונות כניסה. אנא המתן/י מספר דקות ונסה/י שוב.');
      else
        showAlert('שגיאה', 'התחברות נכשלה. אנא נסה שוב.');
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!regName.trim())            return showAlert('שגיאה', 'אנא הזן/י שם מלא');
    if (!validateEmail(regEmail))   return showAlert('שגיאה', 'אנא הזן/י כתובת דוא"ל תקנית');
    const pwErr = validatePassword(regPassword);
    if (pwErr)                      return showAlert('סיסמה חלשה', pwErr);
    if (regPassword !== regConfirm) return showAlert('שגיאה', 'הסיסמאות אינן תואמות');
    setRegLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, regEmail.toLowerCase(), regPassword);
      try {
        await setDoc(doc(db, 'users', cred.user.uid), {
          name: regName.trim(),
          email: regEmail.toLowerCase(),
          userType: 'student',
          mode: NEW_USER_MODE,
          grades: [],
          tasks: [],
          schedule: [],
          topics: [],
        });
      } catch (firestoreErr) {
        await deleteUser(cred.user);
        throw firestoreErr;
      }
      try {
        const continueUrl = typeof window !== 'undefined' ? `${window.location.origin}?emailVerified=1` : undefined;
        await sendVerificationEmail(cred.user.email!, continueUrl);
      } catch {
        showAlert('שים לב', 'לא ניתן לשלוח מייל אימות כרגע. לחץ/י על "שלח מייל אימות שוב" כדי לנסות שוב.');
      }
      setShowRegister(false);
      setPendingEmail(regEmail.toLowerCase());
      setWaitingVerification(true);
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/email-already-in-use')
        showAlert('שגיאה', 'כתובת המייל הזו כבר רשומה. אנא השתמש בכתובת אחרת.');
      else
        showAlert('שגיאה', 'ההרשמה נכשלה. אנא נסה שוב.');
    } finally { setRegLoading(false); }
  };

  const handleResendVerification = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const continueUrl = typeof window !== 'undefined' ? `${window.location.origin}?emailVerified=1` : undefined;
      await sendVerificationEmail(pendingEmail, continueUrl);
      showAlert('נשלח!', 'מייל אימות נוסף נשלח לתיבת הדואר שלך.');
    } catch {
      showAlert('שגיאה', 'לא ניתן לשלוח מייל כרגע. נסה/י שוב מאוחר יותר.');
    }
  };

  const handleCancelVerification = async () => {
    await signOut(auth);
    setWaitingVerification(false);
    setPendingEmail('');
  };

  const handleSendResetEmail = async () => {
    if (!validateEmail(forgotEmail)) return showAlert('שגיאה', 'אנא הזן/י כתובת דוא"ל תקנית');
    setForgotLoading(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail.toLowerCase());
    } catch (e: any) {
      if (e?.code === 'auth/too-many-requests') {
        return showAlert('שגיאה', 'כבר נשלחה בקשה לאחרונה. המתן/י מספר דקות ונסה/י שוב.');
      }
      // auth/user-not-found and other errors fall through to show the same
      // success message, preventing email enumeration.
    } finally { setForgotLoading(false); }
    showAlert('נשלח!', 'אם כתובת המייל רשומה במערכת, יישלח אליה קישור לאיפוס הסיסמה.');
    setShowForgot(false);
    setForgotEmail('');
  };

  const s = useMemo(() => StyleSheet.create({
    container:     { flex: 1 },
    scrollContent: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 64, paddingBottom: 48 },
    logoRing: {
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: SURFACE,
      justifyContent: 'center', alignItems: 'center',
      marginBottom: 20,
    },
    logoGradient: { width: 78, height: 78, borderRadius: 39, justifyContent: 'center', alignItems: 'center' },
    logoEmoji: { fontSize: 40 },
    appName:   { fontSize: 30, fontWeight: '800', color: ACCENT, marginBottom: 6, letterSpacing: 0.5 },
    subtitle:  { fontSize: 13, color: SUB, marginBottom: 32, textAlign: 'center' },
    card: {
      width: '100%', backgroundColor: SURFACE,
      borderRadius: 24, padding: 24, marginBottom: 24,
      borderWidth: 1, borderColor: BORDER,
    },
    label:             { alignSelf: 'flex-end', fontSize: 12, fontWeight: '700', color: SUB, marginBottom: 6, letterSpacing: 0.3 },
    input: {
      width: '100%', backgroundColor: BG, borderRadius: 12,
      borderWidth: 1, borderColor: BORDER,
      paddingHorizontal: 16, paddingVertical: 13,
      fontSize: 16, color: TEXT, marginBottom: 18, textAlign: 'right',
    },
    passwordContainer: {
      width: '100%', flexDirection: 'row', alignItems: 'center',
      backgroundColor: BG, borderRadius: 12,
      borderWidth: 1, borderColor: BORDER, marginBottom: 4,
    },
    passwordInput:   { flex: 1, paddingHorizontal: 16, paddingVertical: 13, fontSize: 16, color: TEXT, textAlign: 'right' },
    eyeBtn:          { paddingHorizontal: 14, paddingVertical: 13 },
    forgotContainer: { alignSelf: 'flex-end', marginTop: 8, marginBottom: 20 },
    forgotText:      { fontSize: 12, color: ACCENT, fontWeight: '600' },
    loginBtnWrap:    { width: '100%', borderRadius: 14, overflow: 'hidden' },
    loginBtn:        { paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
    loginBtnText:    { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
    divider:         { width: '100%', height: 1, backgroundColor: BORDER, marginBottom: 24 },
    signupContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
    signupText:      { fontSize: 13, color: SUB },
    signupLink:      { fontSize: 13, color: ACCENT, fontWeight: '700' },
    modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', padding: 20 },
    modalCard:       { backgroundColor: SURFACE, borderRadius: 24, padding: 24, maxHeight: '90%', borderWidth: 1, borderColor: BORDER },
    modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle:        { fontSize: 18, fontWeight: '700' },
    regLabel:        { fontSize: 12, fontWeight: '700', color: SUB, marginBottom: 6, textAlign: 'right', letterSpacing: 0.3 },
    regInput: {
      borderWidth: 1, borderColor: BORDER, borderRadius: 12,
      paddingHorizontal: 15, paddingVertical: 13,
      fontSize: 16, backgroundColor: BG, marginBottom: 18, color: TEXT, textAlign: 'right',
    },
    regPasswordContainer: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: BORDER, borderRadius: 12,
      backgroundColor: BG, marginBottom: 18,
    },
    regPasswordInput: {
      flex: 1, paddingHorizontal: 15, paddingVertical: 13,
      fontSize: 16, color: TEXT, textAlign: 'right',
    },
    forgotHint: { fontSize: 13, color: SUB, marginBottom: 20, lineHeight: 20, textAlign: 'right' },
  }), [savedMode]);

  if (emailJustVerified) {
    return (
      <LinearGradient colors={isDark ? [BG, BG] : LOGIN_BG} style={[s.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <MaterialCommunityIcons name="check-circle-outline" size={80} color="#4CAF50" style={{ marginBottom: 24 }} />
        <Text style={{ color: TEXT, fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>
          המייל אומת בהצלחה!
        </Text>
        <Text style={{ color: SUB, fontSize: 14, textAlign: 'center', lineHeight: 24 }}>
          כתובת המייל שלך אומתה.{'\n\n'}
          ניתן לסגור כרטיסייה זו ולחזור{'\n'}לכרטיסיית ההרשמה הקודמת.
        </Text>
      </LinearGradient>
    );
  }

  if (waitingVerification) {
    return (
      <LinearGradient colors={isDark ? [BG, BG] : LOGIN_BG} style={[s.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <MaterialCommunityIcons name="email-check-outline" size={72} color={ACCENT} style={{ marginBottom: 24 }} />
        <Text style={{ color: TEXT, fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>
          אימות מייל
        </Text>
        <Text style={{ color: SUB, fontSize: 14, textAlign: 'center', marginBottom: 6 }}>
          שלחנו מייל אימות לכתובת:
        </Text>
        <Text style={{ color: ACCENT, fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 20 }}>
          {pendingEmail}
        </Text>
        <Text style={{ color: SUB, fontSize: 13, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
          יש ללחוץ על הקישור במייל לאימות הכתובת.{'\n'}
          לאחר האימות תיכנס/י אוטומטית למערכת.{'\n\n'}
          💡 אם המייל לא הגיע, בדוק/י גם בתיקיית הספאם.
        </Text>
        <ActivityIndicator color={ACCENT} size="large" style={{ marginBottom: 32 }} />
        <Pressable onPress={handleResendVerification} style={{ marginBottom: 20, padding: 10 }}>
          <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
            שלח/י מייל אימות שוב
          </Text>
        </Pressable>
        <Pressable onPress={handleCancelVerification} style={{ padding: 10 }}>
          <Text style={{ color: SUB, fontSize: 13, textAlign: 'center' }}>חזרה למסך הכניסה</Text>
        </Pressable>
        {alertNode}
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={isDark ? [BG, BG] : LOGIN_BG} style={s.container}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={[s.logoRing, neuShadow as any]}>
          <LinearGradient colors={[GRAD[0] + '44', GRAD[1] + '88']} style={s.logoGradient}>
            <Text style={s.logoEmoji}>🎓</Text>
          </LinearGradient>
        </View>
        <Text style={s.appName}>StudyHub</Text>
        <Text style={s.subtitle}>ברוך הבא! כנס/י כדי להמשיך</Text>

        {/* Form card */}
        <View style={[s.card, neuShadow as any]}>
          <Text style={s.label}>דוא"ל</Text>
          <TextInput
            style={s.input}
            placeholder="student@university.ac.il"
            placeholderTextColor={SUB}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
            editable={!loading}
          />

          <Text style={s.label}>סיסמה</Text>
          <View style={s.passwordContainer}>
            <TextInput
              ref={passwordRef}
              style={s.passwordInput}
              placeholder="לפחות 8 תווים"
              placeholderTextColor={SUB}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              editable={!loading}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
              <MaterialCommunityIcons name={showPassword ? 'eye' : 'eye-off'} size={20} color={SUB} />
            </Pressable>
          </View>

          <Pressable style={s.forgotContainer} onPress={() => setShowForgot(true)}>
            <Text style={s.forgotText}>שכחת סיסמה?</Text>
          </Pressable>

          <Pressable style={[s.loginBtnWrap, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
            <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.loginBtn}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.loginBtnText}>התחבר/י</Text>
              }
            </LinearGradient>
          </Pressable>
        </View>

        <View style={s.divider} />

        <View style={s.signupContainer}>
          <Pressable onPress={() => setShowRegister(true)}>
            <Text style={s.signupLink}>הרשם כאן</Text>
          </Pressable>
          <Text style={s.signupText}>עדיין אין לך חשבון? </Text>
        </View>
      </ScrollView>

      {/* Register Modal */}
      <Modal visible={showRegister} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalOverlay}>
            <View style={[s.modalCard, neuShadow as any]}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>הרשמה</Text>
                <Pressable onPress={() => setShowRegister(false)}>
                  <MaterialCommunityIcons name="close" size={24} color={SUB} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {[
                  { label: 'שם מלא',      ph: 'שם פרטי ומשפחה',           val: regName,     set: setRegName,     kb: 'default' as const,       sec: false, show: false,           setShow: undefined as any },
                  { label: 'דוא"ל',       ph: 'student@university.ac.il', val: regEmail,    set: setRegEmail,    kb: 'email-address' as const, sec: false, show: false,           setShow: undefined as any },
                  { label: 'סיסמה',       ph: 'לפחות 8 תווים, אות גדולה', val: regPassword, set: setRegPassword, kb: 'default' as const,       sec: true,  show: showRegPassword, setShow: setShowRegPassword },
                  { label: 'אימות סיסמה', ph: 'הזן/י סיסמה שנית',         val: regConfirm,  set: setRegConfirm,  kb: 'default' as const,       sec: true,  show: showRegConfirm,  setShow: setShowRegConfirm  },
                ].map(f => (
                  <View key={f.label}>
                    <Text style={s.regLabel}>{f.label}</Text>
                    {f.sec ? (
                      <View style={s.regPasswordContainer}>
                        <TextInput
                          style={s.regPasswordInput}
                          placeholder={f.ph}
                          placeholderTextColor={SUB}
                          value={f.val}
                          onChangeText={f.set}
                          keyboardType={f.kb}
                          autoCapitalize="none"
                          secureTextEntry={!f.show}
                        />
                        <Pressable onPress={() => f.setShow(!f.show)} style={s.eyeBtn}>
                          <MaterialCommunityIcons name={f.show ? 'eye' : 'eye-off'} size={20} color={SUB} />
                        </Pressable>
                      </View>
                    ) : (
                      <TextInput
                        style={s.regInput}
                        placeholder={f.ph}
                        placeholderTextColor={SUB}
                        value={f.val}
                        onChangeText={f.set}
                        keyboardType={f.kb}
                        autoCapitalize="none"
                      />
                    )}
                  </View>
                ))}
                <Pressable
                  style={[s.loginBtnWrap, { marginTop: 8 }, regLoading && { opacity: 0.7 }]}
                  onPress={handleRegister}
                  disabled={regLoading}
                >
                  <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.loginBtn}>
                    {regLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>צור חשבון</Text>}
                  </LinearGradient>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Forgot Password Modal */}
      <Modal visible={showForgot} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalOverlay}>
            <View style={[s.modalCard, neuShadow as any]}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>שחזור סיסמה</Text>
                <Pressable onPress={() => { setShowForgot(false); setForgotEmail(''); }}>
                  <MaterialCommunityIcons name="close" size={24} color={SUB} />
                </Pressable>
              </View>
              <Text style={s.forgotHint}>
                הזן/י את כתובת המייל שלך ונשלח לך קישור לאיפוס הסיסמה.
              </Text>
              <Text style={s.regLabel}>כתובת דוא"ל</Text>
              <TextInput
                style={s.regInput}
                placeholder="student@university.ac.il"
                placeholderTextColor={SUB}
                value={forgotEmail}
                onChangeText={setForgotEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Pressable
                style={[s.loginBtnWrap, forgotLoading && { opacity: 0.7 }]}
                onPress={handleSendResetEmail}
                disabled={forgotLoading}
              >
                <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.loginBtn}>
                  {forgotLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.loginBtnText}>שלח קישור לאיפוס</Text>
                  }
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {alertNode}
    </LinearGradient>
  );
};

export default LoginScreen;
