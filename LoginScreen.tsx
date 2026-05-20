import React, { useState } from 'react';
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
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './src/config/firebase';
import { useCustomAlert } from './src/hooks/useCustomAlert';

const LoginScreen = ({ onLogin }: { navigation: any; onLogin: () => void }) => {
  const { showAlert, alertNode } = useCustomAlert();
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

  const [showForgot, setShowForgot]         = useState(false);
  const [forgotEmail, setForgotEmail]       = useState('');
  const [forgotLoading, setForgotLoading]   = useState(false);

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

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
    if (!regName.trim())           return showAlert('שגיאה', 'אנא הזן שם מלא');
    if (!validateEmail(regEmail))  return showAlert('שגיאה', 'אנא הזן כתובת דוא"ל תקנית');
    if (regPassword.length < 6)    return showAlert('שגיאה', 'הסיסמה חייבת להכיל לפחות 6 תווים');
    if (regPassword !== regConfirm) return showAlert('שגיאה', 'הסיסמאות אינן תואמות');
    setRegLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, regEmail.toLowerCase(), regPassword);
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: regName.trim(),
        email: regEmail.toLowerCase(),
        userType: 'student',
        theme: '#D58EAC',
        grades: [],
        tasks: [],
        schedule: [],
        topics: [],
      });
      setShowRegister(false);
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

      {/* Register Modal */}
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

      {/* Forgot Password Modal */}
      <Modal visible={showForgot} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>שחזור סיסמה</Text>
              <Pressable onPress={() => { setShowForgot(false); setForgotEmail(''); }}>
                <MaterialCommunityIcons name="close" size={24} color="#333" />
              </Pressable>
            </View>
            <Text style={styles.forgotHint}>
              הזן את כתובת המייל שלך ונשלח לך קישור לאיפוס הסיסמה.
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
              onPress={handleSendResetEmail}
              disabled={forgotLoading}
            >
              {forgotLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.loginBtnText}>שלח קישור לאיפוס</Text>
              }
            </Pressable>
          </View>
        </View>
      </Modal>

      {alertNode}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F7' },
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
    width: '100%', backgroundColor: '#CE6385', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  forgotContainer: { marginTop: 14, marginBottom: 30 },
  forgotText:      { fontSize: 13, color: '#CE6385', fontWeight: '500' },
  divider:         { width: '100%', height: 1, backgroundColor: '#e0e0e0', marginBottom: 24 },
  signupContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signupText:      { fontSize: 13, color: '#666' },
  signupLink:      { fontSize: 13, color: '#CE6385', fontWeight: '700' },
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
  forgotHint:  { fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 20 },
});

export default LoginScreen;
