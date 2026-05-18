import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import emailjs from '@emailjs/browser';
import { useCustomAlert } from './src/hooks/useCustomAlert';

// ─── EmailJS configuration ───────────────────────────────────────────────────
// 1. Sign up at https://www.emailjs.com (free tier is enough)
// 2. Add an email service (Gmail / Outlook) → copy the Service ID
// 3. Create a template with variables: {{to_name}}, {{to_email}}, {{reset_code}}
//    → copy the Template ID
// 4. Go to Account → Public Key → copy it
const EMAILJS_SERVICE_ID  = 'service_px5weqj';
const EMAILJS_TEMPLATE_ID = 'template_jawx71l';
const EMAILJS_PUBLIC_KEY  = 'JZxomANzuu5P6jRej';
// ─────────────────────────────────────────────────────────────────────────────

type RegisteredUser = { email: string; password: string; name: string; userType: string };

const LoginScreen = ({ onLogin }: { navigation: any; onLogin: () => void }) => {
  const { showAlert, alertNode } = useCustomAlert();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [rememberMe, setRememberMe]     = useState(false);

  // Registration modal
  const [showRegister, setShowRegister] = useState(false);
  const [regName, setRegName]           = useState('');
  const [regEmail, setRegEmail]         = useState('');
  const [regPassword, setRegPassword]   = useState('');
  const [regConfirm, setRegConfirm]     = useState('');
  const [regLoading, setRegLoading]     = useState(false);

  // Forgot-password modal
  const [showForgot, setShowForgot]         = useState(false);
  const [forgotStep, setForgotStep]         = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail]       = useState('');
  const [enteredCode, setEnteredCode]       = useState('');
  const [newPassword, setNewPassword]       = useState('');
  const [confirmNew, setConfirmNew]         = useState('');
  const [forgotLoading, setForgotLoading]   = useState(false);

  useEffect(() => { loadRememberedUser(); }, []);

  const loadRememberedUser = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('savedEmail');
      if (savedEmail) setEmail(savedEmail);
      setRememberMe(!!savedEmail);
    } catch (e) { console.log(e); }
  };

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!validateEmail(email)) return showAlert('שגיאה', 'אנא הזן כתובת דוא"ל תקנית');
    if (password.length < 6)   return showAlert('שגיאה', 'הסיסמה חייבת להכיל לפחות 6 תווים');

    setLoading(true);
    try {
      const raw   = await AsyncStorage.getItem('registeredUsers');
      const users: RegisteredUser[] = raw ? JSON.parse(raw) : [];
      const user  = users.find((u) => u.email === email.toLowerCase());

      if (!user)                  { showAlert('שגיאה', 'כתובת המייל אינה רשומה. אנא הירשם תחילה.'); return; }
      if (user.password !== password) { showAlert('שגיאה', 'הסיסמה שגויה. אנא נסה שוב.'); return; }

      await AsyncStorage.multiSet([
        ['userToken', 'mock_token_' + Date.now()],
        ['userEmail', user.email],
        ['userName',  user.name],
        ['userType',  user.userType],
      ]);
      if (rememberMe) await AsyncStorage.setItem('savedEmail', email);
      else            await AsyncStorage.removeItem('savedEmail');
      onLogin();
    } catch { showAlert('שגיאה', 'התחברות נכשלה. אנא נסה שוב.'); }
    finally  { setLoading(false); }
  };

  // ── Register ───────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!regName.trim())          return showAlert('שגיאה', 'אנא הזן שם מלא');
    if (!validateEmail(regEmail)) return showAlert('שגיאה', 'אנא הזן כתובת דוא"ל תקנית');
    if (regPassword.length < 6)   return showAlert('שגיאה', 'הסיסמה חייבת להכיל לפחות 6 תווים');
    if (regPassword !== regConfirm) return showAlert('שגיאה', 'הסיסמאות אינן תואמות');

    setRegLoading(true);
    try {
      const raw: RegisteredUser[] = JSON.parse((await AsyncStorage.getItem('registeredUsers')) || '[]');
      if (raw.some((u) => u.email === regEmail.toLowerCase())) {
        showAlert('שגיאה', 'כתובת המייל הזו כבר רשומה. אנא השתמש בכתובת אחרת.');
        return;
      }
      raw.push({ email: regEmail.toLowerCase(), password: regPassword, name: regName.trim(), userType: 'student' });
      await AsyncStorage.setItem('registeredUsers', JSON.stringify(raw));
      await AsyncStorage.multiSet([
        ['userToken', 'mock_token_' + Date.now()],
        ['userEmail', regEmail.toLowerCase()],
        ['userName',  regName.trim()],
        ['userType',  'student'],
        ['grades',    '[]'], ['tasks', '[]'], ['schedule', '[]'], ['topics', '[]'],
      ]);
      setShowRegister(false);
      onLogin();
    } catch { showAlert('שגיאה', 'ההרשמה נכשלה. אנא נסה שוב.'); }
    finally  { setRegLoading(false); }
  };

  // ── Forgot password: step 1 — send OTP ────────────────────────────────────
  const handleSendCode = async () => {
    if (!validateEmail(forgotEmail)) return showAlert('שגיאה', 'אנא הזן כתובת דוא"ל תקנית');

    setForgotLoading(true);
    try {
      const raw: RegisteredUser[] = JSON.parse((await AsyncStorage.getItem('registeredUsers')) || '[]');
      const user = raw.find((u) => u.email === forgotEmail.toLowerCase());
      if (!user) { showAlert('שגיאה', 'כתובת המייל אינה רשומה במערכת.'); return; }

      const code    = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry  = Date.now() + 15 * 60 * 1000; // 15 minutes
      await AsyncStorage.setItem('resetCode',   code);
      await AsyncStorage.setItem('resetExpiry', expiry.toString());
      await AsyncStorage.setItem('resetEmail',  forgotEmail.toLowerCase());

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        { to_name: user.name, to_email: user.email, reset_code: code },
        { publicKey: EMAILJS_PUBLIC_KEY },
      );

      setForgotStep(2);
    } catch (err) {
      console.error(err);
      showAlert('שגיאה', 'שליחת הקוד נכשלה. בדוק שהגדרות EmailJS מוגדרות נכון.');
    } finally { setForgotLoading(false); }
  };

  // ── Forgot password: step 2 — verify OTP and reset ────────────────────────
  const handleResetPassword = async () => {
    if (enteredCode.length !== 6) return showAlert('שגיאה', 'הקוד חייב להכיל 6 ספרות');
    if (newPassword.length < 6)   return showAlert('שגיאה', 'הסיסמה חייבת להכיל לפחות 6 תווים');
    if (newPassword !== confirmNew) return showAlert('שגיאה', 'הסיסמאות אינן תואמות');

    setForgotLoading(true);
    try {
      const storedCode   = await AsyncStorage.getItem('resetCode');
      const storedExpiry = await AsyncStorage.getItem('resetExpiry');
      const storedEmail  = await AsyncStorage.getItem('resetEmail');

      if (Date.now() > Number(storedExpiry)) {
        showAlert('שגיאה', 'הקוד פג תוקף. אנא בקש קוד חדש.');
        setForgotStep(1);
        return;
      }
      if (enteredCode !== storedCode) {
        showAlert('שגיאה', 'הקוד שהזנת שגוי. אנא נסה שוב.');
        return;
      }

      const raw: RegisteredUser[] = JSON.parse((await AsyncStorage.getItem('registeredUsers')) || '[]');
      const updated = raw.map((u) =>
        u.email === storedEmail ? { ...u, password: newPassword } : u
      );
      await AsyncStorage.setItem('registeredUsers', JSON.stringify(updated));
      await AsyncStorage.multiRemove(['resetCode', 'resetExpiry', 'resetEmail']);

      showAlert('הצלחה', 'הסיסמה אופסה בהצלחה! אנא התחבר עם הסיסמה החדשה.');
      closeForgotModal();
    } catch { showAlert('שגיאה', 'איפוס הסיסמה נכשל. אנא נסה שוב.'); }
    finally  { setForgotLoading(false); }
  };

  const closeForgotModal = () => {
    setShowForgot(false);
    setForgotStep(1);
    setForgotEmail('');
    setEnteredCode('');
    setNewPassword('');
    setConfirmNew('');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.capContainer}>
          <Text style={styles.capEmoji}>🎓</Text>
        </View>

        <Text style={styles.title}>Student Login</Text>

        <TextInput
          style={styles.input}
          placeholder="Edu Email ID"
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
        />

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            editable={!loading}
          />
          <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <MaterialCommunityIcons name={showPassword ? 'eye' : 'eye-off'} size={20} color="#aaa" />
          </Pressable>
        </View>

        <Pressable
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.loginBtnText}>Log In</Text>
          }
        </Pressable>

        <Pressable style={styles.forgotContainer} onPress={() => setShowForgot(true)}>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </Pressable>

        <View style={styles.divider} />

        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>עדיין אין לך חשבון? </Text>
          <Pressable onPress={() => setShowRegister(true)}>
            <Text style={styles.signupLink}>הרשם כאן</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Register Modal ── */}
      <Modal visible={showRegister} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>הרשמה</Text>
              <Pressable onPress={() => setShowRegister(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#333" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.regLabel}>שם מלא</Text>
              <TextInput style={styles.regInput} placeholder="שם פרטי ומשפחה" placeholderTextColor="#bbb"
                value={regName} onChangeText={setRegName} />
              <Text style={styles.regLabel}>דוא"ל</Text>
              <TextInput style={styles.regInput} placeholder="student@university.ac.il" placeholderTextColor="#bbb"
                value={regEmail} onChangeText={setRegEmail} keyboardType="email-address" autoCapitalize="none" />
              <Text style={styles.regLabel}>סיסמה</Text>
              <TextInput style={styles.regInput} placeholder="לפחות 6 תווים" placeholderTextColor="#bbb"
                value={regPassword} onChangeText={setRegPassword} secureTextEntry />
              <Text style={styles.regLabel}>אימות סיסמה</Text>
              <TextInput style={styles.regInput} placeholder="הזן סיסמה שנית" placeholderTextColor="#bbb"
                value={regConfirm} onChangeText={setRegConfirm} secureTextEntry />
              <Pressable
                style={[styles.loginBtn, { marginTop: 10 }, regLoading && styles.loginBtnDisabled]}
                onPress={handleRegister} disabled={regLoading}
              >
                {regLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>צור חשבון</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Forgot Password Modal ── */}
      <Modal visible={showForgot} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {forgotStep === 1 ? 'שחזור סיסמה' : 'סיסמה חדשה'}
              </Text>
              <Pressable onPress={closeForgotModal}>
                <MaterialCommunityIcons name="close" size={24} color="#333" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {forgotStep === 1 ? (
                <>
                  <Text style={styles.forgotHint}>
                    הזן את כתובת המייל שלך ונשלח לך קוד בן 6 ספרות לאיפוס הסיסמה.
                  </Text>
                  <Text style={styles.regLabel}>כתובת דוא"ל</Text>
                  <TextInput
                    style={styles.regInput}
                    placeholder="student@university.ac.il"
                    placeholderTextColor="#bbb"
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Pressable
                    style={[styles.loginBtn, forgotLoading && styles.loginBtnDisabled]}
                    onPress={handleSendCode}
                    disabled={forgotLoading}
                  >
                    {forgotLoading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.loginBtnText}>שלח קוד</Text>
                    }
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.forgotHint}>
                    קוד נשלח לכתובת {forgotEmail}. הקוד תקף ל-15 דקות.
                  </Text>
                  <Text style={styles.regLabel}>קוד אימות (6 ספרות)</Text>
                  <TextInput
                    style={styles.regInput}
                    placeholder="123456"
                    placeholderTextColor="#bbb"
                    value={enteredCode}
                    onChangeText={setEnteredCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <Text style={styles.regLabel}>סיסמה חדשה</Text>
                  <TextInput
                    style={styles.regInput}
                    placeholder="לפחות 6 תווים"
                    placeholderTextColor="#bbb"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />
                  <Text style={styles.regLabel}>אימות סיסמה חדשה</Text>
                  <TextInput
                    style={styles.regInput}
                    placeholder="הזן סיסמה שנית"
                    placeholderTextColor="#bbb"
                    value={confirmNew}
                    onChangeText={setConfirmNew}
                    secureTextEntry
                  />
                  <Pressable
                    style={[styles.loginBtn, forgotLoading && styles.loginBtnDisabled]}
                    onPress={handleResetPassword}
                    disabled={forgotLoading}
                  >
                    {forgotLoading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.loginBtnText}>אפס סיסמה</Text>
                    }
                  </Pressable>
                  <Pressable style={styles.resendContainer} onPress={() => setForgotStep(1)}>
                    <Text style={styles.resendText}>לא קיבלת קוד? שלח שוב</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {alertNode}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f2' },
  scrollContent: {
    flexGrow: 1, alignItems: 'center',
    paddingHorizontal: 32, paddingTop: 80, paddingBottom: 40,
  },
  capContainer: { marginBottom: 24 },
  capEmoji:    { fontSize: 90 },
  title:       { fontSize: 26, fontWeight: '700', color: '#222', marginBottom: 32, textAlign: 'center' },
  input: {
    width: '100%', backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#e0e0e0',
    paddingHorizontal: 18, paddingVertical: 14,
    fontSize: 15, color: '#333', marginBottom: 14, textAlign: 'right',
  },
  passwordContainer: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 24,
  },
  passwordInput: { flex: 1, paddingHorizontal: 18, paddingVertical: 14, fontSize: 15, color: '#333', textAlign: 'right' },
  eyeBtn:        { paddingHorizontal: 14, paddingVertical: 14 },
  loginBtn: {
    width: '100%', backgroundColor: '#c8a96e', borderRadius: 10,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  forgotContainer: { marginTop: 14, marginBottom: 30 },
  forgotText:      { fontSize: 13, color: '#c8a96e', fontWeight: '500' },
  divider:         { width: '100%', height: 1, backgroundColor: '#e0e0e0', marginBottom: 24 },
  signupContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signupText:      { fontSize: 13, color: '#666' },
  signupLink:      { fontSize: 13, color: '#c8a96e', fontWeight: '700' },
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard:       { backgroundColor: '#fff', borderRadius: 20, padding: 24, maxHeight: '90%' },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:      { fontSize: 20, fontWeight: '700', color: '#333' },
  regLabel:        { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6, textAlign: 'right' },
  regInput: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10,
    paddingHorizontal: 15, paddingVertical: 12,
    fontSize: 14, backgroundColor: '#f5f5f5', marginBottom: 16, color: '#333', textAlign: 'right',
  },
  forgotHint:       { fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 20 },
  resendContainer:  { alignItems: 'center', marginTop: 16 },
  resendText:       { fontSize: 13, color: '#c8a96e', fontWeight: '500' },
});

export default LoginScreen;
