import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCustomAlert } from '../hooks/useCustomAlert';

const THEMES = [
  { name: 'סגול',  color: '#667eea' },
  { name: 'כחול',  color: '#3b82f6' },
  { name: 'ירוק',  color: '#10b981' },
  { name: 'כתום',  color: '#f97316' },
  { name: 'כהה',   color: '#374151' },
];

type RegisteredUser = { email: string; password: string; name: string; userType: string };

type Props = {
  theme: string;
  onSetTheme: (color: string) => void;
  onLogout: () => void;
};

const ProfileScreen = ({ theme, onSetTheme, onLogout }: Props) => {
  const { showAlert, showConfirm, showDestructiveConfirm, alertNode } = useCustomAlert(theme);

  const [userName, setUserName]   = useState('');
  const [userEmail, setUserEmail] = useState('');

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName]         = useState('');

  const [showPassModal, setShowPassModal] = useState(false);
  const [currentPass, setCurrentPass]     = useState('');
  const [newPass, setNewPass]             = useState('');
  const [confirmPass, setConfirmPass]     = useState('');
  const [passLoading, setPassLoading]     = useState(false);

  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    const name  = await AsyncStorage.getItem('userName')  || '';
    const email = await AsyncStorage.getItem('userEmail') || '';
    setUserName(name);
    setUserEmail(email);
    setNewName(name);
  };

  // ── Save name ──────────────────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!newName.trim()) return showAlert('שגיאה', 'השם לא יכול להיות ריק');
    try {
      await AsyncStorage.setItem('userName', newName.trim());
      const raw: RegisteredUser[] = JSON.parse((await AsyncStorage.getItem('registeredUsers')) || '[]');
      const updated = raw.map((u) => u.email === userEmail ? { ...u, name: newName.trim() } : u);
      await AsyncStorage.setItem('registeredUsers', JSON.stringify(updated));
      setUserName(newName.trim());
      setEditingName(false);
    } catch { showAlert('שגיאה', 'שמירת השם נכשלה'); }
  };

  // ── Change password ────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (currentPass.length < 6)  return showAlert('שגיאה', 'הסיסמה הנוכחית קצרה מדי');
    if (newPass.length < 6)      return showAlert('שגיאה', 'הסיסמה החדשה חייבת להכיל לפחות 6 תווים');
    if (newPass !== confirmPass)  return showAlert('שגיאה', 'הסיסמאות אינן תואמות');

    setPassLoading(true);
    try {
      const raw: RegisteredUser[] = JSON.parse((await AsyncStorage.getItem('registeredUsers')) || '[]');
      const user = raw.find((u) => u.email === userEmail);
      if (!user || user.password !== currentPass) {
        showAlert('שגיאה', 'הסיסמה הנוכחית שגויה');
        return;
      }
      const updated = raw.map((u) => u.email === userEmail ? { ...u, password: newPass } : u);
      await AsyncStorage.setItem('registeredUsers', JSON.stringify(updated));
      setShowPassModal(false);
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
      showAlert('הצלחה', 'הסיסמה שונתה בהצלחה');
    } catch { showAlert('שגיאה', 'שינוי הסיסמה נכשל'); }
    finally  { setPassLoading(false); }
  };

  // ── Theme ──────────────────────────────────────────────────────────────────
  const handleSelectTheme = async (color: string) => {
    await AsyncStorage.setItem('appTheme', color);
    onSetTheme(color);
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    showConfirm('התנתקות', 'האם אתה בטוח שברצונך להתנתק?', async () => {
      await AsyncStorage.removeItem('userToken');
      onLogout();
    });
  };

  // ── Delete account ─────────────────────────────────────────────────────────
  const handleDeleteAccount = () => {
    showDestructiveConfirm('מחיקת חשבון', 'פעולה זו תמחק את החשבון שלך לצמיתות. להמשיך?', 'מחק', async () => {
      try {
        const raw: RegisteredUser[] = JSON.parse((await AsyncStorage.getItem('registeredUsers')) || '[]');
        const updated = raw.filter((u) => u.email !== userEmail);
        await AsyncStorage.setItem('registeredUsers', JSON.stringify(updated));
        await AsyncStorage.multiRemove(['userToken', 'userEmail', 'userName', 'userType',
          'grades', 'tasks', 'schedule', 'topics', 'savedEmail']);
        onLogout();
      } catch { showAlert('שגיאה', 'מחיקת החשבון נכשלה'); }
    });
  };

  const initials = userName ? userName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) : '?';

  return (
    <View style={styles.container}>
    <ScrollView contentContainerStyle={styles.content}>

      {/* Avatar */}
      <View style={[styles.avatarCircle, { backgroundColor: theme }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <Text style={styles.nameHeader}>{userName}</Text>
      <Text style={styles.emailHeader}>{userEmail}</Text>

      {/* Personal details */}
      <View style={styles.card}>
        <Text style={[styles.sectionTitle, { color: theme }]}>פרטים אישיים</Text>

        <View style={styles.row}>
          <MaterialCommunityIcons name="account" size={20} color="#999" />
          {editingName ? (
            <TextInput
              style={styles.inlineInput}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
          ) : (
            <Text style={styles.rowValue}>{userName}</Text>
          )}
          {editingName ? (
            <Pressable onPress={handleSaveName}>
              <MaterialCommunityIcons name="check" size={20} color={theme} />
            </Pressable>
          ) : (
            <Pressable onPress={() => setEditingName(true)}>
              <MaterialCommunityIcons name="pencil" size={18} color="#bbb" />
            </Pressable>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <MaterialCommunityIcons name="email" size={20} color="#999" />
          <Text style={styles.rowValue}>{userEmail}</Text>
        </View>

        <View style={styles.divider} />

        <Pressable style={styles.row} onPress={() => setShowPassModal(true)}>
          <MaterialCommunityIcons name="lock" size={20} color="#999" />
          <Text style={styles.rowValue}>שינוי סיסמה</Text>
          <MaterialCommunityIcons name="chevron-left" size={20} color="#bbb" />
        </Pressable>
      </View>

      {/* Theme */}
      <View style={styles.card}>
        <Text style={[styles.sectionTitle, { color: theme }]}>ערכת נושא</Text>
        <View style={styles.themeRow}>
          {THEMES.map((t) => (
            <Pressable
              key={t.color}
              onPress={() => handleSelectTheme(t.color)}
              style={styles.themeItem}
            >
              <View style={[styles.themeCircle, { backgroundColor: t.color },
                theme === t.color && styles.themeCircleActive]} />
              <Text style={[styles.themeName, theme === t.color && { color: theme, fontWeight: '700' }]}>
                {t.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Actions */}
      <Pressable style={[styles.logoutBtn, { borderColor: theme }]} onPress={handleLogout}>
        <MaterialCommunityIcons name="logout" size={20} color={theme} />
        <Text style={[styles.logoutText, { color: theme }]}>התנתקות</Text>
      </Pressable>

      <Pressable style={styles.deleteBtn} onPress={handleDeleteAccount}>
        <MaterialCommunityIcons name="trash-can" size={20} color="#ff4757" />
        <Text style={styles.deleteText}>מחיקת חשבון</Text>
      </Pressable>

      {/* Change password modal */}
      <Modal visible={showPassModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>שינוי סיסמה</Text>
              <Pressable onPress={() => setShowPassModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#333" />
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>סיסמה נוכחית</Text>
            <TextInput style={styles.fieldInput} value={currentPass} onChangeText={setCurrentPass}
              secureTextEntry placeholder="הסיסמה הנוכחית" placeholderTextColor="#bbb" />
            <Text style={styles.fieldLabel}>סיסמה חדשה</Text>
            <TextInput style={styles.fieldInput} value={newPass} onChangeText={setNewPass}
              secureTextEntry placeholder="לפחות 6 תווים" placeholderTextColor="#bbb" />
            <Text style={styles.fieldLabel}>אימות סיסמה</Text>
            <TextInput style={styles.fieldInput} value={confirmPass} onChangeText={setConfirmPass}
              secureTextEntry placeholder="הזן שוב" placeholderTextColor="#bbb" />
            <Pressable
              style={[styles.saveBtn, { backgroundColor: theme }, passLoading && { opacity: 0.7 }]}
              onPress={handleChangePassword} disabled={passLoading}
            >
              {passLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>שמור</Text>
              }
            </Pressable>
          </View>
        </View>
      </Modal>

    </ScrollView>
    {alertNode}
    </View>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f5f5' },
  content:     { alignItems: 'center', padding: 20, paddingBottom: 40 },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 20, marginBottom: 12,
  },
  avatarText:  { fontSize: 32, fontWeight: '700', color: '#fff' },
  nameHeader:  { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 4 },
  emailHeader: { fontSize: 13, color: '#999', marginBottom: 24 },
  card: {
    width: '100%', backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  rowValue:     { flex: 1, fontSize: 14, color: '#333' },
  inlineInput:  { flex: 1, fontSize: 14, color: '#333', borderBottomWidth: 1, borderBottomColor: '#667eea', paddingVertical: 2 },
  divider:      { height: 1, backgroundColor: '#f0f0f0', marginVertical: 2 },
  themeRow:     { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },
  themeItem:    { alignItems: 'center', gap: 6 },
  themeCircle:  { width: 40, height: 40, borderRadius: 20 },
  themeCircleActive: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  themeName:    { fontSize: 11, color: '#999' },
  logoutBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 2,
    marginBottom: 12, backgroundColor: '#fff',
  },
  logoutText:   { fontSize: 15, fontWeight: '700' },
  deleteBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#fff2f3', borderWidth: 2, borderColor: '#ff4757',
  },
  deleteText:   { fontSize: 15, fontWeight: '700', color: '#ff4757' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard:    { backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: '#333' },
  fieldLabel:   { fontSize: 12, fontWeight: '600', color: '#333', marginBottom: 6 },
  fieldInput: {
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    backgroundColor: '#f5f5f5', marginBottom: 16, color: '#333',
  },
  saveBtn:      { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  saveBtnText:  { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default ProfileScreen;
