import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, KeyboardAvoidingView, Platform,
  NativeSyntheticEvent, TextInputSelectionChangeEventData,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { loadField, saveField } from '../utils/firestore';
import { useTheme } from '../context/ThemeContext';

interface Summary {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

type Sel = { start: number; end: number };

interface ToolbarItem {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  action: 'wrap' | 'linePrefix' | 'insert';
  value: string;
  suffix?: string;
}

const TOOLBAR: ToolbarItem[] = [
  { icon: 'format-bold',             action: 'wrap',       value: '**'      },
  { icon: 'format-italic',           action: 'wrap',       value: '*'       },
  { icon: 'format-header-2',         action: 'linePrefix', value: '## '     },
  { icon: 'format-header-3',         action: 'linePrefix', value: '### '    },
  { icon: 'format-list-bulleted',    action: 'linePrefix', value: '• '      },
  { icon: 'format-list-numbered',    action: 'linePrefix', value: '1. '     },
  { icon: 'format-quote-close',      action: 'linePrefix', value: '> '      },
  { icon: 'checkbox-marked-outline', action: 'linePrefix', value: '☐ '      },
  { icon: 'code-tags',               action: 'wrap',       value: '`'       },
  { icon: 'code-braces',             action: 'wrap',       value: '```\n', suffix: '\n```' },
  { icon: 'minus',                   action: 'insert',     value: '\n---\n' },
];

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

const SummariesScreen = () => {
  const theme = useTheme();
  const [summaries, setSummaries]   = useState<Summary[]>([]);
  const [editModal, setEditModal]   = useState(false);
  const [editing, setEditing]       = useState<Summary | null>(null);
  const [editTitle, setEditTitle]   = useState('');
  const [editContent, setEditContent] = useState('');
  const [fabOpen, setFabOpen]       = useState(false);
  const [sel, setSel]               = useState<Sel>({ start: 0, end: 0 });

  // keep a ref so toolbar callbacks always see latest content
  const contentRef = useRef('');
  useEffect(() => { contentRef.current = editContent; }, [editContent]);

  const load = useCallback(async () => {
    const data = await loadField('summaries');
    setSummaries(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Always uses functional-update to avoid stale-closure bugs
  const persistDelete = (id: string) => {
    setSummaries(prev => {
      const next = prev.filter(s => s.id !== id);
      saveField('summaries', next);
      return next;
    });
  };

  const persistUpsert = (sum: Summary) => {
    setSummaries(prev => {
      const exists = prev.some(s => s.id === sum.id);
      const next = exists ? prev.map(s => s.id === sum.id ? sum : s) : [...prev, sum];
      saveField('summaries', next);
      return next;
    });
  };

  const openNew = (title = '', content = '') => {
    setFabOpen(false);
    setEditing(null);
    setEditTitle(title);
    setEditContent(content);
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
    const sum: Summary = editing
      ? { ...editing, title, content, updatedAt: now }
      : { id: now.toString(), title, content, createdAt: now, updatedAt: now };
    persistUpsert(sum);
    setEditModal(false);
  };

  const confirmDelete = (id: string) => {
    Alert.alert('מחיקה', 'למחוק את הסיכום?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק', style: 'destructive',
        onPress: () => {
          persistDelete(id);
          setEditModal(false);
        },
      },
    ]);
  };

  // ── File import ─────────────────────────────────────────────────────────────
  const importFile = async () => {
    setFabOpen(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const text  = await fetch(asset.uri).then(r => r.text());
      const name  = asset.name.replace(/\.[^/.]+$/, '');
      openNew(name, text);
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לקרוא את הקובץ');
    }
  };

  // ── Toolbar ─────────────────────────────────────────────────────────────────
  const applyToolbar = (item: ToolbarItem) => {
    const content  = contentRef.current;
    const { start, end } = sel;

    if (item.action === 'wrap') {
      const prefix = item.value;
      const suffix = item.suffix ?? item.value;
      const inner  = start < end ? content.slice(start, end) : 'טקסט';
      setEditContent(
        content.slice(0, start) + prefix + inner + suffix + content.slice(end),
      );
    } else if (item.action === 'linePrefix') {
      const lineStart = content.lastIndexOf('\n', start - 1) + 1;
      setEditContent(
        content.slice(0, lineStart) + item.value + content.slice(lineStart),
      );
    } else if (item.action === 'insert') {
      setEditContent(
        content.slice(0, start) + item.value + content.slice(end),
      );
    }
  };

  const onSelChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    setSel(e.nativeEvent.selection);
  };

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {summaries.length === 0 && (
          <View style={s.empty}>
            <MaterialCommunityIcons name="note-text-outline" size={52} color={theme.textSub + '55'} />
            <Text style={[s.emptyText, { color: theme.textSub }]}>אין סיכומים עדיין</Text>
            <Text style={[s.emptyHint, { color: theme.textSub + '88' }]}>לחץ + ליצירת סיכום או ייבוא קובץ</Text>
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
              onLongPress={() => confirmDelete(sum.id)}
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

      {/* FAB backdrop */}
      {fabOpen && (
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setFabOpen(false)} />
      )}

      {/* FAB menu */}
      {fabOpen && (
        <View style={s.fabMenu}>
          <TouchableOpacity
            style={[s.fabMenuItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => openNew()}
          >
            <MaterialCommunityIcons name="note-plus-outline" size={20} color={theme.accent} />
            <Text style={[s.fabMenuLabel, { color: theme.text }]}>סיכום חדש</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.fabMenuItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={importFile}
          >
            <MaterialCommunityIcons name="file-import-outline" size={20} color={theme.accent} />
            <Text style={[s.fabMenuLabel, { color: theme.text }]}>ייבא קובץ טקסט</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[s.fab, { backgroundColor: theme.accent }]}
        onPress={() => setFabOpen(v => !v)}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons
          name={fabOpen ? 'close' : 'plus'}
          size={28}
          color={theme.mode === 'dark' ? '#000' : '#fff'}
        />
      </TouchableOpacity>

      {/* Full-screen editor */}
      <Modal visible={editModal} animationType="slide">
        <KeyboardAvoidingView
          style={[s.editorContainer, { backgroundColor: theme.bg }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* Editor top bar */}
          <View style={[s.editorBar, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setEditModal(false)} style={s.editorBack}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.accent} />
              <Text style={[s.editorBackText, { color: theme.accent }]}>סיכומים</Text>
            </TouchableOpacity>
            <View style={s.editorActions}>
              {editing && (
                <TouchableOpacity
                  onPress={() => confirmDelete(editing.id)}
                  style={s.editorDeleteBtn}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FF4444" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={save} style={[s.saveBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: theme.mode === 'dark' ? '#000' : '#fff', fontWeight: '700', fontSize: 14 }}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20 }}
            keyboardShouldPersistTaps="handled"
          >
            <TextInput
              style={[s.titleInput, { color: theme.text, borderBottomColor: theme.border }]}
              placeholder="כותרת הסיכום"
              placeholderTextColor={theme.textSub}
              value={editTitle}
              onChangeText={setEditTitle}
              textAlign="right"
            />
            <TextInput
              style={[s.contentInput, { color: theme.text }]}
              placeholder="כתוב את הסיכום כאן..."
              placeholderTextColor={theme.textSub}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              textAlign="right"
              textAlignVertical="top"
              onSelectionChange={onSelChange}
            />
          </ScrollView>

          {/* Formatting toolbar */}
          <View style={[s.toolbar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.toolbarContent}
            >
              {TOOLBAR.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.toolbarBtn, { borderColor: theme.border }]}
                  onPress={() => applyToolbar(item)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name={item.icon} size={18} color={theme.accent} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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

  fabMenu: { position: 'absolute', bottom: 90, right: 16, gap: 8, zIndex: 10 },
  fabMenuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
  },
  fabMenuLabel: { fontSize: 14, fontWeight: '600' },
  fab: {
    position: 'absolute', bottom: 20, right: 16,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    elevation: 4, zIndex: 11,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4,
  },

  editorContainer: { flex: 1 },
  editorBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  editorBack:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editorBackText:  { fontSize: 14, fontWeight: '600' },
  editorActions:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editorDeleteBtn: { padding: 6 },
  saveBtn:         { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 },

  titleInput: {
    borderBottomWidth: 1, paddingBottom: 12, marginBottom: 16,
    fontSize: 20, fontWeight: '700',
  },
  contentInput: { minHeight: 300, lineHeight: 24, fontSize: 15 },

  toolbar:        { borderTopWidth: 1, paddingVertical: 6 },
  toolbarContent: { paddingHorizontal: 12, gap: 6, flexDirection: 'row', alignItems: 'center' },
  toolbarBtn: {
    width: 36, height: 36, borderRadius: 8, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
});

export default SummariesScreen;
