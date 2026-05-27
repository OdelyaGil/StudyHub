import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadField, saveField } from '../utils/firestore';
import { useTheme } from '../context/ThemeContext';

interface SavedLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  createdAt: number;
}

const getDomain = (u: string) => {
  try { return new URL(u).hostname; } catch { return u; }
};

const LinksScreen = () => {
  const theme = useTheme();
  const [links, setLinks]   = useState<SavedLink[]>([]);
  const [addModal, setAddModal] = useState(false);
  const [title, setTitle]   = useState('');
  const [url, setUrl]       = useState('');
  const [desc, setDesc]     = useState('');

  const load = useCallback(async () => {
    const data = await loadField('links');
    setLinks(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = async (next: SavedLink[]) => {
    setLinks(next);
    await saveField('links', next);
  };

  const closeModal = () => {
    setAddModal(false);
    setTitle(''); setUrl(''); setDesc('');
  };

  const addLink = async () => {
    const t = title.trim();
    const u = url.trim();
    if (!t || !u) return;
    const link: SavedLink = {
      id: Date.now().toString(),
      title: t,
      url: u.startsWith('http') ? u : 'https://' + u,
      description: desc.trim() || undefined,
      createdAt: Date.now(),
    };
    await persist([...links, link]);
    closeModal();
  };

  const deleteLink = (id: string) => {
    Alert.alert('מחיקה', 'למחוק את הקישור?', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: () => persist(links.filter(l => l.id !== id)) },
    ]);
  };

  const openLink = (u: string) => {
    Linking.openURL(u).catch(() => Alert.alert('שגיאה', 'לא ניתן לפתוח את הקישור'));
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {links.length === 0 && (
          <View style={s.empty}>
            <MaterialCommunityIcons name="link-variant-off" size={52} color={theme.textSub + '55'} />
            <Text style={[s.emptyText, { color: theme.textSub }]}>אין קישורים עדיין</Text>
            <Text style={[s.emptyHint, { color: theme.textSub + '88' }]}>לחץ + להוספת קישור</Text>
          </View>
        )}
        {links.map(link => (
          <TouchableOpacity
            key={link.id}
            style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => openLink(link.url)}
            onLongPress={() => deleteLink(link.id)}
            activeOpacity={0.75}
          >
            <View style={[s.favicon, { backgroundColor: theme.accent + '20' }]}>
              <MaterialCommunityIcons name="link-variant" size={22} color={theme.accent} />
            </View>
            <View style={s.cardContent}>
              <Text style={[s.cardTitle, { color: theme.text }]}>{link.title}</Text>
              <Text style={[s.cardDomain, { color: theme.accent }]} numberOfLines={1}>
                {getDomain(link.url)}
              </Text>
              {link.description ? (
                <Text style={[s.cardDesc, { color: theme.textSub }]} numberOfLines={2}>
                  {link.description}
                </Text>
              ) : null}
            </View>
            <MaterialCommunityIcons name="open-in-new" size={18} color={theme.textSub} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[s.fab, { backgroundColor: theme.accent }]}
        onPress={() => setAddModal(true)}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color={theme.mode === 'dark' ? '#000' : '#fff'} />
      </TouchableOpacity>

      <Modal visible={addModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.panelTitle, { color: theme.text }]}>קישור חדש</Text>
            <TextInput
              style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="כותרת"
              placeholderTextColor={theme.textSub}
              value={title}
              onChangeText={setTitle}
              textAlign="right"
              autoFocus
            />
            <TextInput
              style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="כתובת URL"
              placeholderTextColor={theme.textSub}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            <TextInput
              style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="תיאור (אופציונלי)"
              placeholderTextColor={theme.textSub}
              value={desc}
              onChangeText={setDesc}
              textAlign="right"
            />
            <View style={s.panelBtns}>
              <TouchableOpacity onPress={closeModal} style={s.cancelBtn}>
                <Text style={{ color: theme.textSub, fontWeight: '600' }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addLink} style={[s.confirmBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: theme.mode === 'dark' ? '#000' : '#fff', fontWeight: '700' }}>הוסף</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  empty:     { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '600' },
  emptyHint: { fontSize: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10,
  },
  favicon:     { width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardContent: { flex: 1 },
  cardTitle:   { fontSize: 14, fontWeight: '700', textAlign: 'right', marginBottom: 2 },
  cardDomain:  { fontSize: 11, fontWeight: '600', textAlign: 'right' },
  cardDesc:    { fontSize: 12, textAlign: 'right', marginTop: 3 },
  fab: {
    position: 'absolute', bottom: 20, right: 16,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4,
  },
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  panel:      { width: '100%', borderRadius: 18, borderWidth: 1, padding: 24, gap: 14 },
  panelTitle: { fontSize: 18, fontWeight: '700', textAlign: 'right' },
  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
  },
  panelBtns:  { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  cancelBtn:  { paddingHorizontal: 16, paddingVertical: 10 },
  confirmBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
});

export default LinksScreen;
