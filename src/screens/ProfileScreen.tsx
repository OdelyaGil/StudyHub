import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Modal, ActivityIndicator,
  KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  EmailAuthProvider, reauthenticateWithCredential,
  updatePassword, deleteUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { useTheme } from '../context/ThemeContext';
import { ThemeMode } from '../context/ThemeContext';

const DARK_ACCENTS = [
  { name: 'ציאן',    color: '#00FFFF' },
  { name: 'ירוק',    color: '#00FF88' },
  { name: 'סגול',    color: '#BF5FFF' },
  { name: 'ורוד',    color: '#FF2D78' },
  { name: 'כתום',    color: '#FF8C00' },
];

const LIGHT_ACCENTS = [
  { name: 'ורוד',     color: '#D58EAC' },
  { name: 'סלמון',   color: '#E395A3' },
  { name: 'כחול ים', color: '#80A9AF' },
  { name: 'תכלת',    color: '#89D4E3' },
  { name: 'טורקיז',  color: '#46C0C1' },
];

type Props = {
  accent: string;
  mode: ThemeMode;
  onSetAccent: (c: string) => void;
  onSetMode: (m: ThemeMode) => void;
  onLogout: () => void;
};

const ProfileScreen = ({ accent, mode, onSetAccent, onSetMode, onLogout }: Props) => {
  const theme = useTheme();
  const { showAlert, showConfirm, showDestructiveConfirm, alertNode } = useCustomAlert(theme.accent);

  const [userName, setUserName]   = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName]         = useState('');

  const [requiredCredits, setRequiredCredits] = useState('');
  const [editingCredits, setEditingCredits]   = useState(false);
  const [newCredits, setNewCredits]           = useState('');

  const [showPassModal, setShowPassModal] = useState(false);
  const [currentPass, setCurrentPass]     = useState('');
  const [newPass, setNewPass]             = useState('');
  const [confirmPass, setConfirmPass]     = useState('');
  const [passLoading, setPassLoading]     = useState(false);

  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const snap = await getDoc(doc(db, 'users', user.uid));
    const data = snap.data() ?? {};
    setUserName(data.name || '');
    setUserEmail(data.email || user.email || '');
    setNewName(data.name || '');
    const rc = data.requiredCredits ? String(data.requiredCredits) : '';
    setRequiredCredits(rc);
    setNewCredits(rc);
  };

  const handleSaveCredits = async () => {
    const val = parseFloat(newCredits);
    if (isNaN(val) || val <= 0) return showAlert('שגיאה', 'הזיני מספר נקודות זכות תקין');
    const user = auth.currentUser;
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { requiredCredits: val }, { merge: true });
      setRequiredCredits(newCredits);
      setEditingCredits(false);
    } catch { showAlert('שגיאה', 'שמירה נכשלה'); }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return showAlert('שגיאה', 'השם לא יכול להיות ריק');
    const user = auth.currentUser;
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { name: newName.trim() }, { merge: true });
      setUserName(newName.trim());
      setEditingName(false);
    } catch { showAlert('שגיאה', 'שמירת השם נכשלה'); }
  };

  const handleChangePassword = async () => {
    if (currentPass.length < 6) return showAlert('שגיאה', 'הסיסמה הנוכחית קצרה מדי');
    if (newPass.length < 6)     return showAlert('שגיאה', 'הסיסמה החדשה חייבת להכיל לפחות 6 תווים');
    if (newPass !== confirmPass) return showAlert('שגיאה', 'הסיסמאות אינן תואמות');
    const user = auth.currentUser;
    if (!user || !user.email) return;
    setPassLoading(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPass));
      await updatePassword(user, newPass);
      setShowPassModal(false);
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
      showAlert('הצלחה', 'הסיסמה שונתה בהצלחה');
    } catch (e: any) {
      if (e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential')
        showAlert('שגיאה', 'הסיסמה הנוכחית שגויה');
      else showAlert('שגיאה', 'שינוי הסיסמה נכשל');
    } finally { setPassLoading(false); }
  };

  const handleSelectAccent = async (color: string) => {
    const user = auth.currentUser;
    if (user) await setDoc(doc(db, 'users', user.uid), { accent: color }, { merge: true });
    onSetAccent(color);
  };

  const handleToggleMode = async (val: boolean) => {
    const newMode: ThemeMode = val ? 'dark' : 'light';
    const user = auth.currentUser;
    if (user) await setDoc(doc(db, 'users', user.uid), { mode: newMode }, { merge: true });
    onSetMode(newMode);
  };

  const handleLogout = () => {
    showConfirm('התנתקות', 'האם אתה בטוח שברצונך להתנתק?', async () => {
      await auth.signOut(); onLogout();
    });
  };

  const handleDeleteAccount = () => {
    showDestructiveConfirm('מחיקת חשבון', 'פעולה זו תמחק את החשבון שלך לצמיתות. להמשיך?', 'מחק', async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'users', user.uid));
        await deleteUser(user);
        onLogout();
      } catch { showAlert('שגיאה', 'מחיקת החשבון נכשלה. התנתק והתחבר שוב ונסה שוב.'); }
    });
  };

  const initials = userName
    ? userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const isDark = mode === 'dark';
  const accents = isDark ? DARK_ACCENTS : LIGHT_ACCENTS;

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={s.content}>

        {/* Avatar */}
        <View style={[s.avatarCircle, { borderColor: theme.accent, backgroundColor: theme.accent + '22' },
          isDark && { shadowColor: theme.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 20, elevation: 8 }
        ]}>
          <Text style={[s.avatarText, { color: theme.accent }]}>{initials}</Text>
        </View>
        <Text style={[s.nameHeader, { color: theme.text }]}>{userName}</Text>
        <Text style={[s.emailHeader, { color: theme.textSub }]}>{userEmail}</Text>

        {/* Personal details */}
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.sectionTitle, { color: theme.accent }]}>פרטים אישיים</Text>

          <View style={s.row}>
            <MaterialCommunityIcons name="account" size={20} color={theme.textSub} />
            {editingName ? (
              <TextInput
                style={[s.inlineInput, { color: theme.text, borderBottomColor: theme.accent }]}
                value={newName} onChangeText={setNewName} autoFocus
              />
            ) : (
              <Text style={[s.rowValue, { color: theme.text }]}>{userName}</Text>
            )}
            {editingName ? (
              <Pressable onPress={handleSaveName}>
                <MaterialCommunityIcons name="check" size={20} color={theme.accent} />
              </Pressable>
            ) : (
              <Pressable onPress={() => setEditingName(true)}>
                <MaterialCommunityIcons name="pencil" size={18} color={theme.textSub} />
              </Pressable>
            )}
          </View>

          <View style={[s.divider, { backgroundColor: theme.border }]} />

          <View style={s.row}>
            <MaterialCommunityIcons name="email" size={20} color={theme.textSub} />
            <Text style={[s.rowValue, { color: theme.text }]}>{userEmail}</Text>
          </View>

          <View style={[s.divider, { backgroundColor: theme.border }]} />

          <Pressable style={s.row} onPress={() => setShowPassModal(true)}>
            <MaterialCommunityIcons name="lock" size={20} color={theme.textSub} />
            <Text style={[s.rowValue, { color: theme.text }]}>שינוי סיסמה</Text>
            <MaterialCommunityIcons name="chevron-left" size={20} color={theme.textSub} />
          </Pressable>
        </View>

        {/* Theme settings */}
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.sectionTitle, { color: theme.accent }]}>ערכת נושא</Text>

          {/* Dark / Light toggle */}
          <View style={s.toggleRow}>
            <View style={s.toggleLabels}>
              <MaterialCommunityIcons
                name={isDark ? 'weather-night' : 'weather-sunny'}
                size={20}
                color={theme.accent}
              />
              <Text style={[s.toggleText, { color: theme.text }]}>
                {isDark ? 'מצב לילה' : 'מצב יום'}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={handleToggleMode}
              thumbColor={theme.accent}
              trackColor={{ false: theme.textSub + '44', true: theme.accent + '55' }}
            />
          </View>

          <View style={[s.divider, { backgroundColor: theme.border }]} />

          {/* Accent colors */}
          <Text style={[s.subLabel, { color: theme.textSub }]}>צבע הדגשה</Text>
          <View style={s.accentRow}>
            {accents.map(a => (
              <Pressable key={a.color} onPress={() => handleSelectAccent(a.color)} style={s.accentItem}>
                <View style={[
                  s.accentCircle,
                  { backgroundColor: a.color },
                  accent === a.color && { borderWidth: 3, borderColor: '#fff' },
                  isDark && accent === a.color && {
                    shadowColor: a.color,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.9,
                    shadowRadius: 8,
                    elevation: 6,
                  },
                ]} />
                <Text style={[s.accentName, { color: accent === a.color ? theme.accent : theme.textSub }]}>
                  {a.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Academic settings */}
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.sectionTitle, { color: theme.accent }]}>הגדרות אקדמיות</Text>
          <View style={s.row}>
            <MaterialCommunityIcons name="school-outline" size={20} color={theme.textSub} />
            {editingCredits ? (
              <TextInput
                style={[s.inlineInput, { color: theme.text, borderBottomColor: theme.accent }]}
                value={newCredits}
                onChangeText={setNewCredits}
                keyboardType="decimal-pad"
                autoFocus
                placeholder="לדוגמה: 130"
                placeholderTextColor={theme.textSub}
                textAlign="right"
              />
            ) : (
              <Text style={[s.rowValue, { color: theme.text }]}>
                {requiredCredits ? `${requiredCredits} נ"ז לתואר` : 'הגדר נ"ז נדרשות לתואר'}
              </Text>
            )}
            {editingCredits ? (
              <Pressable onPress={handleSaveCredits}>
                <MaterialCommunityIcons name="check" size={20} color={theme.accent} />
              </Pressable>
            ) : (
              <Pressable onPress={() => setEditingCredits(true)}>
                <MaterialCommunityIcons name="pencil" size={18} color={theme.textSub} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Logout */}
        <Pressable
          style={[s.logoutBtn, { borderColor: theme.accent, backgroundColor: theme.accent + '11' }]}
          onPress={handleLogout}
        >
          <MaterialCommunityIcons name="logout" size={20} color={theme.accent} />
          <Text style={[s.logoutText, { color: theme.accent }]}>התנתקות</Text>
        </Pressable>

        <Pressable style={s.deleteBtn} onPress={handleDeleteAccount}>
          <MaterialCommunityIcons name="trash-can" size={20} color="#ff4757" />
          <Text style={s.deleteText}>מחיקת חשבון</Text>
        </Pressable>

        {/* Change password modal */}
        <Modal visible={showPassModal} animationType="slide" transparent>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={s.modalOverlay}>
              <View style={[s.modalCard, { backgroundColor: theme.mode === 'dark' ? '#111122' : '#fff', borderColor: theme.border }]}>
                <View style={s.modalHeader}>
                  <Text style={[s.modalTitle, { color: theme.text }]}>שינוי סיסמה</Text>
                  <Pressable onPress={() => setShowPassModal(false)}>
                    <MaterialCommunityIcons name="close" size={24} color={theme.textSub} />
                  </Pressable>
                </View>
                {[
                  { label: 'סיסמה נוכחית', val: currentPass, set: setCurrentPass },
                  { label: 'סיסמה חדשה',   val: newPass,     set: setNewPass },
                  { label: 'אימות סיסמה',  val: confirmPass, set: setConfirmPass },
                ].map(({ label, val, set }) => (
                  <View key={label}>
                    <Text style={[s.fieldLabel, { color: theme.textSub }]}>{label}</Text>
                    <TextInput
                      style={[s.fieldInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
                      value={val} onChangeText={set}
                      secureTextEntry placeholderTextColor={theme.textSub}
                      placeholder="••••••"
                    />
                  </View>
                ))}
                <Pressable
                  style={[s.saveBtn, { backgroundColor: theme.accent }, passLoading && { opacity: 0.7 }]}
                  onPress={handleChangePassword} disabled={passLoading}
                >
                  {passLoading
                    ? <ActivityIndicator color="#000" />
                    : <Text style={[s.saveBtnText, { color: theme.mode === 'dark' ? '#000' : '#fff' }]}>שמור</Text>
                  }
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

      </ScrollView>
      {alertNode}
    </View>
  );
};

const s = StyleSheet.create({
  container:     { flex: 1 },
  content:       { alignItems: 'center', padding: 20, paddingBottom: 40 },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 20, marginBottom: 12,
    borderWidth: 2,
  },
  avatarText:  { fontSize: 32, fontWeight: '800' },
  nameHeader:  { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  emailHeader: { fontSize: 13, marginBottom: 24 },
  card: {
    width: '100%', borderRadius: 20,
    padding: 16, marginBottom: 16,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase', textAlign: 'right' },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  rowValue:     { flex: 1, fontSize: 14, textAlign: 'right' },
  inlineInput:  { flex: 1, fontSize: 14, borderBottomWidth: 1, paddingVertical: 2, textAlign: 'right' },
  divider:      { height: 1, marginVertical: 2 },
  toggleRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  toggleLabels: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleText:   { fontSize: 14, fontWeight: '600' },
  subLabel:     { fontSize: 11, fontWeight: '600', marginTop: 12, marginBottom: 10, textAlign: 'right' },
  accentRow:    { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },
  accentItem:   { alignItems: 'center', gap: 6 },
  accentCircle: { width: 40, height: 40, borderRadius: 20 },
  accentName:   { fontSize: 10 },
  logoutBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, marginBottom: 12,
  },
  logoutText:   { fontSize: 15, fontWeight: '700' },
  deleteBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
    backgroundColor: 'rgba(255,71,87,0.1)', borderWidth: 1.5, borderColor: '#ff4757',
  },
  deleteText:   { fontSize: 15, fontWeight: '700', color: '#ff4757' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalCard:    { borderRadius: 20, padding: 24, borderWidth: 1 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 18, fontWeight: '700' },
  fieldLabel:   { fontSize: 12, fontWeight: '600', marginBottom: 6, textAlign: 'right' },
  fieldInput: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, marginBottom: 16, textAlign: 'right',
  },
  saveBtn:      { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  saveBtnText:  { fontSize: 15, fontWeight: '700' },
});

export default ProfileScreen;
