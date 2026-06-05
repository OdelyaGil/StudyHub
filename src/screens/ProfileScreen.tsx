import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Modal, ActivityIndicator,
  KeyboardAvoidingView, Platform, Switch, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const GRADIENTS: { name: string; colors: [string, string] }[] = [
  { name: 'MIDNIGHT OCEAN', colors: ['#1E0F75', '#3785D8'] },
  { name: 'DEEP BLUE',      colors: ['#1C1DAB', '#ADC6E5'] },
  { name: 'SKY FADE',       colors: ['#3785D8', '#E0EEFF'] },
  { name: 'MIST BLOOM',     colors: ['#ADC6E5', '#BF8CE1'] },
  { name: 'PURPLE DAWN',    colors: ['#BF8CE1', '#E893C5'] },
  { name: 'SUNSET BLUSH',   colors: ['#E893C5', '#EBB2C3'] },
  { name: 'PETAL SOFT',     colors: ['#EBB2C3', '#F5E0EA'] },
  { name: 'PEARL DRIFT',    colors: ['#CBD8E8', '#F0F4FA'] },
];

const DARK_ACCENTS = [
  { name: 'MIDNIGHT',     color: '#1E0F75' },
  { name: 'ROYAL NAVY',   color: '#1C1DAB' },
  { name: 'OCEAN BLUE',   color: '#3785D8' },
  { name: 'ICE BLUE',     color: '#ADC6E5' },
  { name: 'LAVENDER',     color: '#BF8CE1' },
  { name: 'FLAMINGO',     color: '#E893C5' },
  { name: 'ROSE QUARTZ',  color: '#EBB2C3' },
  { name: 'SILVER MIST',  color: '#CBD8E8' },
];

const LIGHT_ACCENTS = [
  { name: 'MIDNIGHT',     color: '#1E0F75' },
  { name: 'ROYAL NAVY',   color: '#1C1DAB' },
  { name: 'OCEAN BLUE',   color: '#3785D8' },
  { name: 'ICE BLUE',     color: '#ADC6E5' },
  { name: 'LAVENDER',     color: '#BF8CE1' },
  { name: 'FLAMINGO',     color: '#E893C5' },
  { name: 'ROSE QUARTZ',  color: '#EBB2C3' },
  { name: 'SILVER MIST',  color: '#CBD8E8' },
];

type Props = {
  accent: string;
  mode: ThemeMode;
  onSetAccent: (c: string) => void;
  onSetMode: (m: ThemeMode) => void;
  onLogout: () => void;
  onAvatarChange?: (url: string) => void;
};

const ProfileScreen = ({ accent, mode, onSetAccent, onSetMode, onLogout, onAvatarChange }: Props) => {
  const theme = useTheme();
  const { showAlert, showDestructiveConfirm, alertNode } = useCustomAlert(theme.accent);

  const [userName, setUserName]   = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName]         = useState('');

  const [requiredCredits, setRequiredCredits] = useState('');
  const [editingCredits, setEditingCredits]   = useState(false);
  const [newCredits, setNewCredits]           = useState('');

  const [photoURL,        setPhotoURL]        = useState<string | null>(null);
  const [uploadingPhoto,  setUploadingPhoto]  = useState(false);

  const [showPassModal, setShowPassModal] = useState(false);
  const [currentPass, setCurrentPass]     = useState('');
  const [newPass, setNewPass]             = useState('');
  const [confirmPass, setConfirmPass]     = useState('');
  const [passLoading, setPassLoading]     = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword]   = useState('');
  const [deleteLoading, setDeleteLoading]     = useState(false);

  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const snap = await getDoc(doc(db, 'users', user.uid));
    const data = snap.data() ?? {};
    setUserName(data.name || '');
    setUserEmail(data.email || user.email || '');
    setNewName(data.name || '');
    setPhotoURL(data.photoURL || null);
    const rc = data.requiredCredits ? String(data.requiredCredits) : '';
    setRequiredCredits(rc);
    setNewCredits(rc);
  };

  const compressImage = (file: File, maxPx: number): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = document.createElement('img');
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        if (width > height) {
          if (width > maxPx) { height = Math.round((height * maxPx) / width); width = maxPx; }
        } else {
          if (height > maxPx) { width = Math.round((width * maxPx) / height); height = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no canvas context'));
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')),
          'image/jpeg', 0.82,
        );
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('img load failed')); };
      img.src = objectUrl;
    });

  const pickAndUploadPhoto = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setUploadingPhoto(true);
    try {
      let base64: string | null = null;

      if (Platform.OS === 'web') {
        const file = await new Promise<File | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = (e: Event) => resolve((e.target as HTMLInputElement).files?.[0] ?? null);
          input.click();
        });
        if (!file) return;
        let blob: Blob;
        try { blob = await compressImage(file, 300); } catch { blob = file; }
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showAlert('הרשאה נדרשת', 'יש לאשר גישה לגלריה בהגדרות כדי לשנות תמונת פרופיל');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.6,
          base64: true,
        });
        if (result.canceled || !result.assets?.[0]?.base64) return;
        base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      }

      if (!base64) return;
      await setDoc(doc(db, 'users', user.uid), { photoURL: base64 }, { merge: true });
      setPhotoURL(base64);
      onAvatarChange?.(base64);
    } catch (e) {
      console.error('avatar save error:', e);
      showAlert('שגיאה', 'העלאת התמונה נכשלה');
    } finally { setUploadingPhoto(false); }
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
    if (newPass.length < 8)     return showAlert('שגיאה', 'הסיסמה החדשה חייבת להכיל לפחות 8 תווים');
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
    await AsyncStorage.setItem('savedAccent', color);
    onSetAccent(color);
  };

  const handleToggleMode = async (val: boolean) => {
    const newMode: ThemeMode = val ? 'dark' : 'light';
    const user = auth.currentUser;
    if (user) await setDoc(doc(db, 'users', user.uid), { mode: newMode }, { merge: true });
    await AsyncStorage.setItem('savedMode', newMode);
    onSetMode(newMode);
  };

  const handleDeleteAccount = () => {
    showDestructiveConfirm(
      'מחיקת חשבון',
      'פעולה זו תמחק את החשבון שלך לצמיתות. להמשיך?',
      'מחק',
      () => { setDeletePassword(''); setShowDeleteModal(true); },
    );
  };

  const confirmDeleteAccount = async () => {
    if (deletePassword.length < 6) return showAlert('שגיאה', 'אנא הזיני את הסיסמה הנוכחית');
    const user = auth.currentUser;
    if (!user || !user.email) return;
    setDeleteLoading(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, deletePassword));
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(user);
      onLogout();
    } catch (e: any) {
      if (e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential')
        showAlert('שגיאה', 'הסיסמה שגויה');
      else
        showAlert('שגיאה', 'מחיקת החשבון נכשלה. אנא נסי שוב.');
    } finally { setDeleteLoading(false); }
  };

  const initials = userName
    ? userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const isDark = mode === 'dark';
  const accents = isDark ? DARK_ACCENTS : LIGHT_ACCENTS;
  const darkShadow: object = isDark
    ? (Platform.select({ web: { boxShadow: `0 4px 20px ${theme.accent}30, 0 1px 6px rgba(0,0,0,0.5)` } as any, default: { shadowColor: theme.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 6 } }) ?? {})
    : {};

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={s.content}>

        {/* Avatar */}
        <Pressable style={s.avatarWrapper} onPress={pickAndUploadPhoto}>
          <View style={[s.avatarCircle, { borderColor: theme.accent, backgroundColor: theme.accent + '22' },
            isDark && { shadowColor: theme.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 20, elevation: 8 }
          ]}>
            {photoURL
              ? <Image source={{ uri: photoURL }} style={s.avatarImage} />
              : <Text style={[s.avatarText, { color: theme.accent }]}>{initials}</Text>
            }
          </View>
          <View style={[s.cameraOverlay, { backgroundColor: theme.accent, borderColor: theme.bg }]}>
            {uploadingPhoto
              ? <ActivityIndicator size="small" color="#000" />
              : <MaterialCommunityIcons name="camera" size={14} color="#000" />
            }
          </View>
        </Pressable>
        <Text style={[s.nameHeader, { color: theme.text }]}>{userName}</Text>
        <Text style={[s.emailHeader, { color: theme.textSub }]}>{userEmail}</Text>

        {/* Personal details */}
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }, darkShadow as any]}>
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
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }, darkShadow as any]}>
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

          {/* Gradients */}
          <View style={[s.divider, { backgroundColor: theme.border, marginVertical: 12 }]} />
          <Text style={[s.subLabel, { color: theme.textSub }]}>גרדיאנטים</Text>
          <View style={s.gradientGrid}>
            {GRADIENTS.map(g => {
              const key = `gradient:${g.colors[0]},${g.colors[1]}`;
              const isSelected = accent === key;
              return (
                <Pressable key={key} onPress={() => handleSelectAccent(key)} style={s.gradientItem}>
                  <LinearGradient
                    colors={g.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      s.gradientPill,
                      isSelected && { borderWidth: 2.5, borderColor: '#fff' },
                      isSelected && isDark && {
                        shadowColor: g.colors[0],
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.8,
                        shadowRadius: 8,
                        elevation: 6,
                      },
                    ]}
                  />
                  <Text style={[s.accentName, { color: isSelected ? theme.accent : theme.textSub }]}>
                    {g.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Academic settings */}
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }, darkShadow as any]}>
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

      {/* Delete account — re-auth confirmation modal */}
      <Modal visible={showDeleteModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalOverlay}>
            <View style={[s.modalCard, { backgroundColor: theme.mode === 'dark' ? '#111122' : '#fff', borderColor: theme.border }]}>
              <View style={s.modalHeader}>
                <Text style={[s.modalTitle, { color: theme.text }]}>אימות זהות</Text>
                <Pressable onPress={() => { setShowDeleteModal(false); setDeletePassword(''); }}>
                  <MaterialCommunityIcons name="close" size={24} color={theme.textSub} />
                </Pressable>
              </View>
              <Text style={[s.fieldLabel, { color: theme.textSub, marginBottom: 16, lineHeight: 20 }]}>
                כדי למחוק את החשבון לצמיתות, אנא הזיני את הסיסמה הנוכחית שלך:
              </Text>
              <Text style={[s.fieldLabel, { color: theme.textSub }]}>סיסמה נוכחית</Text>
              <TextInput
                style={[s.fieldInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
                value={deletePassword}
                onChangeText={setDeletePassword}
                secureTextEntry
                placeholderTextColor={theme.textSub}
                placeholder="••••••••"
                autoFocus
              />
              <Pressable
                style={[s.saveBtn, { backgroundColor: '#ff4757' }, deleteLoading && { opacity: 0.7 }]}
                onPress={confirmDeleteAccount}
                disabled={deleteLoading}
              >
                {deleteLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={[s.saveBtnText, { color: '#fff' }]}>מחק חשבון לצמיתות</Text>
                }
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {alertNode}
    </View>
  );
};

const s = StyleSheet.create({
  container:     { flex: 1 },
  content:       { alignItems: 'center', padding: 20, paddingBottom: 40 },
  avatarWrapper: {
    width: 90, height: 90,
    marginTop: 20, marginBottom: 12,
  },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, overflow: 'hidden',
  },
  avatarImage: { width: 90, height: 90, borderRadius: 45 },
  avatarText:  { fontSize: 32, fontWeight: '800' },
  cameraOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2,
  },
  nameHeader:  { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  emailHeader: { fontSize: 13, marginBottom: 24 },
  card: {
    width: '100%', borderRadius: 20,
    padding: 16, marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#3D1568',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.11,
    shadowRadius: 18,
    elevation: 6,
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

  gradientGrid: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },
  gradientItem: { alignItems: 'center', gap: 6 },
  gradientPill: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
});

export default ProfileScreen;
