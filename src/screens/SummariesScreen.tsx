import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadField, saveField } from '../utils/firestore';
import { useTheme } from '../context/ThemeContext';

interface Summary {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

const SummariesScreen = () => {
  const theme = useTheme();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [editModal, setEditModal] = useState(false);
  const [editing, setEditing]     = useState<Summary | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const load = useCallback(async () => {
    const data = await loadField('summaries');
    setSummaries(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = async (next: Summary[]) => {
    setSummaries(next);
    await saveField('summaries', next);
  };

  const openNew = () => {
    setEditing(null);
    setEditTitle('');
    setEditContent('');
    setEditModal(true);
  };

  const openEdit = (sum: Summary) => {
    setEditing(sum);
    setEditTitle(sum.title);
    setEditContent(sum.content);
    setEditModal(true);
  };

  const save = async () => {
    const title   = editTitle.trim();
    const content = editContent.trim();
    if (!title) return;
    const now = Date.now();
    if (editing) {
      await persist(summaries.map(s =>
        s.id === editing.id ? { ...s, title, content, updatedAt: now } : s,
      ));
    } else {
      await persist([...summaries, { id: now.toString(), title, content, createdAt: now, updatedAt: now }]);
    }
    setEditModal(false);
  };

  const deleteSummary = (id: string) => {
    Alert.alert('מחיקה', 'למחוק את הסיכום?', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: () => persist(summaries.filter(s => s.id !== id)) },
    ]);
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {summaries.length === 0 && (
          <View style={s.empty}>
            <MaterialCommunityIcons name="note-text-outline" size={52} color={theme.textSub + '55'} />
            <Text style={[s.emptyText, { color: theme.textSub }]}>אין סיכומים עדיין</Text>
            <Text style={[s.emptyHint, { color: theme.textSub + '88' }]}>לחץ + ליצירת סיכום</Text>
          </View>
        )}
        {summaries
          .slice()
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map(sum => (
            <TouchableOpacity
              key={sum.id}
              style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => openEdit(sum)}
              onLongPress={() => deleteSummary(sum.id)}
              activeOpacity={0.75}
            >
              <View style={s.cardHeader}>
                <Text style={[s.cardDate, { color: theme.textSub }]}>{formatDate(sum.updatedAt)}</Text>
                <Text style={[s.cardTitle, { color: theme.text }]}>{sum.title}</Text>
              </View>
              {sum.content.length > 0 && (
                <Text style={[s.cardPreview, { color: theme.textSub }]} numberOfLines={2}>
                  {sum.content}
                </Text>
              )}
            </TouchableOpacity>
          ))}
      </ScrollView>

      <TouchableOpacity
        style={[s.fab, { backgroundColor: theme.accent }]}
        onPress={openNew}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color={theme.mode === 'dark' ? '#000' : '#fff'} />
      </TouchableOpacity>

      {/* Full-screen editor */}
      <Modal visible={editModal} animationType="slide">
        <View style={[s.editorContainer, { backgroundColor: theme.bg }]}>
          <View style={[s.editorBar, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setEditModal(false)} style={s.editorBack}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.accent} />
              <Text style={[s.editorBackText, { color: theme.accent }]}>סיכומים</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} style={[s.saveBtn, { backgroundColor: theme.accent }]}>
              <Text style={{ color: theme.mode === 'dark' ? '#000' : '#fff', fontWeight: '700', fontSize: 14 }}>שמור</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <TextInput
              style={[s.titleInput, { color: theme.text, borderBottomColor: theme.border, fontSize: 20, fontWeight: '700' }]}
              placeholder="כותרת הסיכום"
              placeholderTextColor={theme.textSub}
              value={editTitle}
              onChangeText={setEditTitle}
              textAlign="right"
            />
            <TextInput
              style={[s.contentInput, { color: theme.text, fontSize: 15 }]}
              placeholder="כתוב את הסיכום כאן..."
              placeholderTextColor={theme.textSub}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              textAlign="right"
              textAlignVertical="top"
            />
          </ScrollView>

          {editing && (
            <TouchableOpacity
              style={[s.deleteBtn, { borderColor: '#FF4444' }]}
              onPress={() => { setEditModal(false); deleteSummary(editing.id); }}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={18} color="#FF4444" />
              <Text style={{ color: '#FF4444', fontWeight: '600' }}>מחק סיכום</Text>
            </TouchableOpacity>
          )}
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
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10, gap: 6,
  },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle:   { fontSize: 15, fontWeight: '700', textAlign: 'right', flex: 1 },
  cardDate:    { fontSize: 11, marginLeft: 8 },
  cardPreview: { fontSize: 13, lineHeight: 18, textAlign: 'right' },

  fab: {
    position: 'absolute', bottom: 20, right: 16,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4,
  },

  editorContainer: { flex: 1 },
  editorBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  editorBack:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editorBackText: { fontSize: 14, fontWeight: '600' },
  saveBtn:        { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 },

  titleInput: {
    borderBottomWidth: 1, paddingBottom: 12, marginBottom: 16,
  },
  contentInput: { minHeight: 300, lineHeight: 24 },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    margin: 16, padding: 14, borderRadius: 12, borderWidth: 1,
  },
});

export default SummariesScreen;
