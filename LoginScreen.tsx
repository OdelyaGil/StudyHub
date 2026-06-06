import React, { useState, useRef } from 'react';
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
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './src/config/firebase';
import { useCustomAlert } from './src/hooks/useCustomAlert';

const DEFAULT_ACCENT = '#E0659A';
const DEFAULT_GRAD: [string, string] = ['#E8659A', '#F4A0C0'];

const LoginScreen = ({ onLogin, savedAccent, savedMode }: { navigation: any; onLogin: () => void; savedAccent?: string; savedMode?: string }) => {
  const isGrad  = savedAccent?.startsWith('gradient:');
  const gradArr = isGrad ? savedAccent!.replace('gradient:', '').split(',') as [string, string] : null;
  const ACCENT  = gradArr ? gradArr[0] : (savedAccent ?? DEFAULT_ACCENT);
  const GRAD: [string, string] = gradArr ?? (savedAccent ? [savedAccent, savedAccent + 'BB'] : DEFAULT_GRAD);
  const isDark  = savedMode === 'dark';

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
  const [regPassword, setRegPassword]   = useState('');
  const [regConfirm, setRegConfirm]     = useState('');
  const [regLoading, setRegLoading]     = useState(false);

  const [showForgot, setShowForgot]       = useState(false);
  const [forgotEmail, setForgotEmail]     = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const passwordRef = useRef<TextInputType>(null);

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const validatePassword = (p: string): string | null => {
    if (p.length < 8)                  return 'הסיסמה חייבת להכיל לפחות 8 תווים';
    if (!/[A-Z]/.test(p))              return 'הסיסמה חייבת להכיל לפחות אות גדולה אחת (A–Z)';
    if (/[֐-׿יִ-ﭏ]/.test(p))         return 'הסיסמה יכולה להכיל תווים לועזיים בלבד';
    return null;
  };

  const handleLogin = async () => {
    if (!validateEmail(email)) return showAlert('שגיאה', 'אנא הזן כתובת דוא"ל תקנית');
    if (password.length < 6)   return showAlert('שגיאה', 'הסיסמה חייבת להכיל לפחות 6 תווים');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
      onLogin();
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential')
        showAlert('שגיאה', 'כתובת המייל או הסיסמה שגויים');
      else if (code === 'auth/wrong-password')
        showAlert('שגיאה', 'הסיסמה שגויה. אנא נסה שוב.');
      else
        showAlert('שגיאה', 'התחברות נכשלה. אנא נסה שוב.');
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!regName.trim())            return showAlert('שגיאה', 'אנא הזן שם מלא');
    if (!validateEmail(regEmail))   return showAlert('שגיאה', 'אנא הזן כתובת דוא"ל תקנית');
    const pwErr = validatePassword(regPassword);
    if (pwErr)                      return showAlert('סיסמה חלשה', pwErr);
    if (regPassword !== regConfirm) return showAlert('שגיאה', 'הסיסמאות אינן תואמות');
    setRegLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, regEmail.toLowerCase(), regPassword);
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: regName.trim(),
        email: regEmail.toLowerCase(),
        userType: 'student',
        accent: DEFAULT_ACCENT,
        mode: 'dark',
        grades: [],
        tasks: [],
        schedule: [],
        topics: [],
      });
      try {
        await sendEmailVerification(cred.user, {
          url: typeof window !== 'undefined' ? window.location.origin : '',
          handleCodeInApp: false,
        });
      } catch (_) {}
      setShowRegister(false);
      showAlert('ברוך הבא! 🎉', 'ההרשמה הושלמה.\nשלחנו לך מייל אימות — אנא אמת את הכתובת דרך תיבת הדואר שלך.');
      onLogin();
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/email-already-in-use')
        showAlert('שגיאה', 'כתובת המייל הזו כבר רשומה. אנא השתמש בכתובת אחרת.');
      else
        showAlert('שגיאה', 'ההרשמה נכשלה. אנא נסה שוב.');
    } finally { setRegLoading(false); }
  };

  const handleSendResetEmail = async () => {
    if (!validateEmail(forgotEmail)) return showAlert('שגיאה', 'אנא הזן כתובת דוא"ל תקנית');
    setForgotLoading(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail.toLowerCase());
      showAlert('נשלח!', 'קישור לאיפוס סיסמה נשלח לכתובת המייל שלך.');
      setShowForgot(false);
      setForgotEmail('');
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'auth/user-not-found')
        showAlert('שגיאה', 'כתובת המייל אינה רשומה במערכת.');
      else
        showAlert('שגיאה', 'שליחת המייל נכשלה. אנא נסה שוב.');
    } finally { setForgotLoading(false); }
  };

  const s = StyleSheet.create({
    container:     { flex: 1, backgroundColor: BG },
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
      fontSize: 14, color: TEXT, marginBottom: 18, textAlign: 'right',
    },
    passwordContainer: {
      width: '100%', flexDirection: 'row', alignItems: 'center',
      backgroundColor: BG, borderRadius: 12,
      borderWidth: 1, borderColor: BORDER, marginBottom: 4,
    },
    passwordInput:   { flex: 1, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: TEXT, textAlign: 'right' },
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
    modalTitle:      { fontSize: 20, fontWeight: '800', color: TEXT },
    regLabel:        { fontSize: 12, fontWeight: '700', color: SUB, marginBottom: 6, textAlign: 'right', letterSpacing: 0.3 },
    regInput: {
      borderWidth: 1, borderColor: BORDER, borderRadius: 12,
      paddingHorizontal: 15, paddingVertical: 13,
      fontSize: 14, backgroundColor: BG, marginBottom: 18, color: TEXT, textAlign: 'right',
    },
    forgotHint: { fontSize: 13, color: SUB, marginBottom: 20, lineHeight: 20, textAlign: 'right' },
  });

  return (
    <View style={s.container}>
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
                  { label: 'שם מלא',      ph: 'שם פרטי ומשפחה',           val: regName,     set: setRegName,     kb: 'default' as const, sec: false },
                  { label: 'דוא"ל',       ph: 'student@university.ac.il', val: regEmail,    set: setRegEmail,    kb: 'email-address' as const, sec: false },
                  { label: 'סיסמה',       ph: 'לפחות 8 תווים, אות גדולה', val: regPassword, set: setRegPassword, kb: 'default' as const, sec: true  },
                  { label: 'אימות סיסמה', ph: 'הזיני סיסמה שנית',         val: regConfirm,  set: setRegConfirm,  kb: 'default' as const, sec: true  },
                ].map(f => (
                  <View key={f.label}>
                    <Text style={s.regLabel}>{f.label}</Text>
                    <TextInput
                      style={s.regInput}
                      placeholder={f.ph}
                      placeholderTextColor={SUB}
                      value={f.val}
                      onChangeText={f.set}
                      keyboardType={f.kb}
                      autoCapitalize="none"
                      secureTextEntry={f.sec}
                    />
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
                הזיני את כתובת המייל שלך ונשלח לך קישור לאיפוס הסיסמה.
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
    </View>
  );
};

export default LoginScreen;
