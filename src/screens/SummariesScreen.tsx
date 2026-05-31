import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, KeyboardAvoidingView, Platform, Linking,
  NativeSyntheticEvent, TextInputSelectionChangeEventData,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../config/firebase';
import { loadField, saveField } from '../utils/firestore';
import { useTheme } from '../context/ThemeContext';
import { AppTheme } from '../context/ThemeContext';

// ── Types ────────────────────────────────────────────────────────────────────

type SummaryType = 'text' | 'file';

interface Summary {
  id: string;
  title: string;
  type: SummaryType;
  content: string;        // text → markdown; file → user notes
  fileName?: string;
  mimeType?: string;
  downloadURL?: string;
  createdAt: number;
  updatedAt: number;
}

type Sel = { start: number; end: number };

interface ToolbarItem {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  action: 'wrap' | 'linePrefix' | 'insert';
  value: string;
  suffix?: string;
}

const TOOLBAR: ToolbarItem[] = [
  { icon: 'format-bold',          label: 'מודגש',  action: 'wrap',       value: '**'    },
  { icon: 'format-italic',        label: 'נטוי',   action: 'wrap',       value: '*'     },
  { icon: 'format-header-1',      label: 'כותרת',  action: 'linePrefix', value: '## '   },
  { icon: 'format-header-2',      label: 'כות׳ 2', action: 'linePrefix', value: '### '  },
  { icon: 'format-list-bulleted', label: 'רשימה',  action: 'linePrefix', value: '• '    },
  { icon: 'format-list-numbered', label: 'ממוספר', action: 'linePrefix', value: '1. '   },
  { icon: 'minus',                label: 'קו',     action: 'insert',     value: '\n---\n'},
];

const TEXT_MIMES = ['text/', 'application/json', 'application/xml', 'application/csv', 'application/x-markdown', 'application/rtf'];
const REJECT_MIMES = ['audio/', 'video/', 'image/'];
const isTextMime = (m?: string) => !!m && TEXT_MIMES.some(t => m.startsWith(t));
const isRejected = (m?: string) => !!m && REJECT_MIMES.some(t => m.startsWith(t));

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

const getFileIcon = (mime?: string): React.ComponentProps<typeof MaterialCommunityIcons>['name'] => {
  if (!mime) return 'file-outline';
  if (mime.includes('pdf'))          return 'file-pdf-box';
  if (mime.includes('word') || mime.includes('document')) return 'file-word-outline';
  if (mime.includes('excel') || mime.includes('spreadsheet')) return 'file-excel-outline';
  if (mime.includes('presentation')) return 'file-powerpoint-outline';
  if (mime.startsWith('text/'))      return 'file-document-outline';
  return 'file-outline';
};

// ── Markdown preview renderer ────────────────────────────────────────────────

const parseInline = (text: string): Array<{ text: string; bold: boolean; italic: boolean }> => {
  const out: Array<{ text: string; bold: boolean; italic: boolean }> = [];
  let i = 0, cur = '', bold = false, italic = false;
  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') {
      if (cur) out.push({ text: cur, bold, italic });
      cur = ''; bold = !bold; i += 2;
    } else if (text[i] === '*') {
      if (cur) out.push({ text: cur, bold, italic });
      cur = ''; italic = !italic; i += 1;
    } else { cur += text[i]; i++; }
  }
  if (cur) out.push({ text: cur, bold, italic });
  return out;
};

const InlineMd = ({ text, base }: { text: string; base: object }) =>
  <Text>{parseInline(text).map((seg, i) =>
    <Text key={i} style={[base, seg.bold ? { fontWeight: '800' } : null, seg.italic ? { fontStyle: 'italic' } : null]}>
      {seg.text}
    </Text>,
  )}</Text>;

const MarkdownPreview = ({ content, theme }: { content: string; theme: AppTheme }) => {
  const base = { color: theme.text, textAlign: 'right' as const, fontSize: 15, lineHeight: 24 };
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      {content.split('\n').map((line, i) => {
        if (line.startsWith('## '))
          return <Text key={i} style={{ color: theme.text, fontSize: 22, fontWeight: '800', textAlign: 'right', marginVertical: 6 }}>{line.slice(3)}</Text>;
        if (line.startsWith('### '))
          return <Text key={i} style={{ color: theme.text, fontSize: 18, fontWeight: '700', textAlign: 'right', marginVertical: 4 }}>{line.slice(4)}</Text>;
        if (line === '---')
          return <View key={i} style={{ height: 1, backgroundColor: theme.border, marginVertical: 10 }} />;
        if (line.startsWith('• ') || line.startsWith('- '))
          return <View key={i} style={{ flexDirection: 'row', gap: 8, marginVertical: 2, justifyContent: 'flex-end' }}>
            <InlineMd text={line.slice(2)} base={base} /><Text style={base}>•</Text>
          </View>;
        if (/^\d+\.\s/.test(line)) {
          const [num, ...rest] = line.split('. ');
          return <View key={i} style={{ flexDirection: 'row', gap: 8, marginVertical: 2, justifyContent: 'flex-end' }}>
            <InlineMd text={rest.join('. ')} base={base} /><Text style={base}>{num}.</Text>
          </View>;
        }
        if (line.startsWith('> '))
          return <View key={i} style={{ borderRightWidth: 3, borderRightColor: theme.accent, paddingRight: 10, marginVertical: 2 }}>
            <InlineMd text={line.slice(2)} base={{ ...base, color: theme.textSub }} />
          </View>;
        if (line === '')
          return <View key={i} style={{ height: 8 }} />;
        return <InlineMd key={i} text={line} base={base} />;
      })}
    </ScrollView>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

const SummariesScreen = () => {
  const theme = useTheme();
  const [summaries, setSummaries]     = useState<Summary[]>([]);
  const [editModal, setEditModal]     = useState(false);
  const [editing, setEditing]         = useState<Summary | null>(null);
  const [editTitle, setEditTitle]     = useState('');
  const [editContent, setEditContent] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [fabOpen, setFabOpen]         = useState(false);
  const [sel, setSel]                 = useState<Sel>({ start: 0, end: 0 });
  const [confirmModal, setConfirmModal] = useState(false);
  const [confirmId, setConfirmId]       = useState<string | null>(null);
  const [importError, setImportError]   = useState('');

  // File-type summary viewer
  const [fileModal, setFileModal]     = useState(false);
  const [viewingFile, setViewingFile] = useState<Summary | null>(null);
  const [fileNotes, setFileNotes]     = useState('');

  // Undo / redo
  const historyRef = useRef<string[]>(['']);
  const histPtrRef = useRef(0);

  const contentRef = useRef('');
  useEffect(() => { contentRef.current = editContent; }, [editContent]);

  const load = useCallback(async () => {
    const data = await loadField('summaries');
    setSummaries(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

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
      const next   = exists ? prev.map(s => s.id === sum.id ? sum : s) : [...prev, sum];
      saveField('summaries', next);
      return next;
    });
  };

  // ── Undo / redo ─────────────────────────────────────────────────────────────
  const pushHistory = (text: string) => {
    const hist = historyRef.current.slice(0, histPtrRef.current + 1);
    hist.push(text);
    if (hist.length > 100) hist.shift();
    historyRef.current = hist;
    histPtrRef.current = hist.length - 1;
  };

  const applyText = (text: string) => {
    setEditContent(text);
    contentRef.current = text;
    pushHistory(text);
  };

  const onChangeContent = (text: string) => {
    setEditContent(text);
    contentRef.current = text;
    pushHistory(text);
  };

  const undo = () => {
    const ptr = histPtrRef.current;
    if (ptr > 0) {
      const newPtr = ptr - 1;
      histPtrRef.current = newPtr;
      const text = historyRef.current[newPtr];
      setEditContent(text);
      contentRef.current = text;
    }
  };

  const redo = () => {
    const ptr = histPtrRef.current;
    if (ptr < historyRef.current.length - 1) {
      const newPtr = ptr + 1;
      histPtrRef.current = newPtr;
      const text = historyRef.current[newPtr];
      setEditContent(text);
      contentRef.current = text;
    }
  };

  // ── Editor open helpers ──────────────────────────────────────────────────────
  const openNew = (title = '', content = '') => {
    setFabOpen(false);
    setEditing(null);
    setEditTitle(title);
    setEditContent(content);
    setPreviewMode(false);
    historyRef.current = [content];
    histPtrRef.current = 0;
    setEditModal(true);
  };

  const openEdit = (sum: Summary) => {
    if (sum.type === 'file') {
      setViewingFile(sum);
      setFileNotes(sum.content);
      setFileModal(true);
      return;
    }
    setEditing(sum);
    setEditTitle(sum.title);
    setEditContent(sum.content);
    setPreviewMode(false);
    historyRef.current = [sum.content];
    histPtrRef.current = 0;
    setEditModal(true);
  };

  const save = () => {
    const title   = editTitle.trim();
    const content = editContent.trim();
    if (!title) return;
    const now = Date.now();
    const sum: Summary = editing
      ? { ...editing, title, content, updatedAt: now }
      : { id: now.toString(), title, content, type: 'text', createdAt: now, updatedAt: now };
    persistUpsert(sum);
    setEditModal(false);
  };

  // ── Save file notes ──────────────────────────────────────────────────────────
  const saveFileNotes = () => {
    if (!viewingFile) return;
    persistUpsert({ ...viewingFile, content: fileNotes, updatedAt: Date.now() });
    setFileModal(false);
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const askDelete = (id: string) => {
    setConfirmId(id);
    setEditModal(false);
    setFileModal(false);
    setConfirmModal(true);
  };

  const doDelete = () => {
    if (confirmId) persistDelete(confirmId);
    setConfirmModal(false);
    setConfirmId(null);
  };

  // ── File import ──────────────────────────────────────────────────────────────
  const importFile = async () => {
    setFabOpen(false);
    setImportError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const mime  = asset.mimeType ?? '';
      const name  = asset.name.replace(/\.[^/.]+$/, '');

      if (isRejected(mime)) {
        setImportError('לא ניתן לייבא קבצי אודיו, וידאו או תמונות');
        return;
      }

      if (isTextMime(mime) || mime === '') {
        // Readable as text → open in editor
        let content = '';
        try { content = await fetch(asset.uri).then(r => r.text()); } catch {}
        openNew(name, content);
        return;
      }

      // Binary file → upload to Firebase Storage, create file-type summary
      const uid     = auth.currentUser?.uid;
      const fileId  = Date.now().toString();
      const response = await fetch(asset.uri);
      const blob     = await response.blob();
      const storageRef = ref(storage, `users/${uid}/summaries/${fileId}`);
      await uploadBytes(storageRef, blob, { contentType: mime || 'application/octet-stream' });
      const downloadURL = await getDownloadURL(storageRef);

      const now = Date.now();
      persistUpsert({
        id: fileId,
        title: asset.name,
        type: 'file',
        content: '',
        fileName: asset.name,
        mimeType: mime,
        downloadURL,
        createdAt: now,
        updatedAt: now,
      });
    } catch {
      setImportError('לא ניתן לייבא את הקובץ');
    }
  };

  // ── Toolbar ───────────────────────────────────────────────────────────────────
  const applyToolbar = (item: ToolbarItem) => {
    const content        = contentRef.current;
    const { start, end } = sel;
    let next = content;

    if (item.action === 'wrap') {
      const prefix = item.value;
      const suffix = item.suffix ?? item.value;
      const inner  = start < end ? content.slice(start, end) : 'טקסט';
      next = content.slice(0, start) + prefix + inner + suffix + content.slice(end);
    } else if (item.action === 'linePrefix') {
      const lineStart = content.lastIndexOf('\n', start - 1) + 1;
      next = content.slice(0, lineStart) + item.value + content.slice(lineStart);
    } else if (item.action === 'insert') {
      next = content.slice(0, start) + item.value + content.slice(end);
    }
    applyText(next);
  };

  const onSelChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    setSel(e.nativeEvent.selection);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {importError !== '' && (
          <View style={[s.errorBanner, { backgroundColor: '#FF444422', borderColor: '#FF4444' }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#FF4444" />
            <Text style={{ color: '#FF4444', fontSize: 13, flex: 1, textAlign: 'right' }}>{importError}</Text>
            <TouchableOpacity onPress={() => setImportError('')}>
              <MaterialCommunityIcons name="close" size={16} color="#FF4444" />
            </TouchableOpacity>
          </View>
        )}

        {summaries.length === 0 && (
          <View style={s.empty}>
            <MaterialCommunityIcons name="note-text-outline" size={52} color={theme.textSub + '55'} />
            <Text style={[s.emptyText, { color: theme.textSub }]}>אין סיכומים עדיין</Text>
            <Text style={[s.emptyHint, { color: theme.textSub + '88' }]}>לחץ + ליצירת סיכום או ייבוא קובץ</Text>
          </View>
        )}

        {summaries.slice().sort((a, b) => b.updatedAt - a.updatedAt).map(sum => (
          <TouchableOpacity
            key={sum.id}
            style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => openEdit(sum)}
            onLongPress={() => askDelete(sum.id)}
            activeOpacity={0.75}
          >
            <View style={s.cardHeader}>
              {sum.type === 'file' && (
                <MaterialCommunityIcons name={getFileIcon(sum.mimeType)} size={18} color={theme.accent} />
              )}
              <Text style={[s.cardTitle, { color: theme.text }]}>{sum.title}</Text>
              <Text style={[s.cardDate, { color: theme.textSub }]}>{formatDate(sum.updatedAt)}</Text>
            </View>
            {sum.type === 'text' && sum.content.length > 0 && (
              <Text style={[s.cardPreview, { color: theme.textSub }]} numberOfLines={2}>
                {sum.content.replace(/[#*`>•]/g, '').trim()}
              </Text>
            )}
            {sum.type === 'file' && (
              <Text style={[s.cardPreview, { color: theme.textSub }]}>
                {sum.content ? sum.content.slice(0, 80) : 'לחץ לפתיחה ועריכת הערות'}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* FAB backdrop */}
      {fabOpen && (
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setFabOpen(false)} />
      )}

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
            <Text style={[s.fabMenuLabel, { color: theme.text }]}>ייבא קובץ</Text>
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

      {/* ── Delete confirm ── */}
      <Modal visible={confirmModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.confirmPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="trash-can-outline" size={36} color="#FF4444" />
            <Text style={[s.confirmTitle, { color: theme.text }]}>מחיקת סיכום</Text>
            <Text style={[s.confirmMsg, { color: theme.textSub }]}>האם למחוק את הסיכום לצמיתות?</Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={[s.confirmCancel, { borderColor: theme.border }]} onPress={() => setConfirmModal(false)}>
                <Text style={{ color: theme.textSub, fontWeight: '600', fontSize: 15 }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmDelete} onPress={doDelete}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>מחק</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── File viewer modal ── */}
      <Modal visible={fileModal} animationType="slide">
        <View style={[s.editorContainer, { backgroundColor: theme.bg }]}>
          <View style={[s.editorBar, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setFileModal(false)} style={s.editorBack}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.accent} />
              <Text style={[s.editorBackText, { color: theme.accent }]}>סיכומים</Text>
            </TouchableOpacity>
            <View style={s.editorActions}>
              {viewingFile && (
                <TouchableOpacity onPress={() => askDelete(viewingFile.id)} style={s.editorDeleteBtn}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FF4444" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={saveFileNotes} style={[s.saveBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: theme.mode === 'dark' ? '#000' : '#fff', fontWeight: '700', fontSize: 14 }}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {/* File info */}
            <View style={[s.fileInfoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <MaterialCommunityIcons name={getFileIcon(viewingFile?.mimeType)} size={40} color={theme.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[s.fileInfoName, { color: theme.text }]}>{viewingFile?.fileName ?? viewingFile?.title}</Text>
                <Text style={[s.fileInfoType, { color: theme.textSub }]}>{viewingFile?.mimeType ?? 'קובץ'}</Text>
              </View>
              <TouchableOpacity
                onPress={() => viewingFile?.downloadURL && Linking.openURL(viewingFile.downloadURL)}
                style={[s.openFileBtn, { backgroundColor: theme.accent }]}
              >
                <MaterialCommunityIcons name="open-in-new" size={16} color={theme.mode === 'dark' ? '#000' : '#fff'} />
                <Text style={{ color: theme.mode === 'dark' ? '#000' : '#fff', fontWeight: '700', fontSize: 13 }}>פתח</Text>
              </TouchableOpacity>
            </View>
            {/* Notes */}
            <Text style={[s.notesLabel, { color: theme.textSub }]}>הערות</Text>
            <TextInput
              style={[s.notesInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
              placeholder="הוסף הערות לקובץ זה..."
              placeholderTextColor={theme.textSub}
              value={fileNotes}
              onChangeText={setFileNotes}
              multiline
              textAlign="right"
              textAlignVertical="top"
              blurOnSubmit={false}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* ── Text editor modal ── */}
      <Modal visible={editModal} animationType="slide">
        <KeyboardAvoidingView
          style={[s.editorContainer, { backgroundColor: theme.bg }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Top bar */}
          <View style={[s.editorBar, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setEditModal(false)} style={s.editorBack}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.accent} />
              <Text style={[s.editorBackText, { color: theme.accent }]}>סיכומים</Text>
            </TouchableOpacity>
            <View style={s.editorActions}>
              {editing && (
                <TouchableOpacity onPress={() => askDelete(editing.id)} style={s.editorDeleteBtn}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FF4444" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setPreviewMode(v => !v)}
                style={[s.previewToggle, { borderColor: theme.border, backgroundColor: previewMode ? theme.accent + '22' : 'transparent' }]}
              >
                <MaterialCommunityIcons
                  name={previewMode ? 'pencil-outline' : 'eye-outline'}
                  size={18}
                  color={previewMode ? theme.accent : theme.textSub}
                />
                <Text style={{ color: previewMode ? theme.accent : theme.textSub, fontSize: 12, fontWeight: '600' }}>
                  {previewMode ? 'עריכה' : 'תצוגה'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={save} style={[s.saveBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: theme.mode === 'dark' ? '#000' : '#fff', fontWeight: '700', fontSize: 14 }}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>

          {previewMode ? (
            /* ── Preview ── */
            <View style={{ flex: 1 }}>
              <TextInput
                style={[s.titleInput, { color: theme.text, borderBottomColor: theme.border, marginHorizontal: 20, marginTop: 16 }]}
                placeholder="כותרת הסיכום"
                placeholderTextColor={theme.textSub}
                value={editTitle}
                onChangeText={setEditTitle}
                textAlign="right"
              />
              <MarkdownPreview content={editContent} theme={theme} />
            </View>
          ) : (
            /* ── Editor ── */
            <>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="always">
                <TextInput
                  style={[s.titleInput, { color: theme.text, borderBottomColor: theme.border }]}
                  placeholder="כותרת הסיכום"
                  placeholderTextColor={theme.textSub}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  textAlign="right"
                  blurOnSubmit={false}
                  returnKeyType="next"
                />
                <TextInput
                  style={[s.contentInput, { color: theme.text }]}
                  placeholder="כתוב את הסיכום כאן..."
                  placeholderTextColor={theme.textSub}
                  value={editContent}
                  onChangeText={onChangeContent}
                  multiline
                  textAlign="right"
                  textAlignVertical="top"
                  onSelectionChange={onSelChange}
                  blurOnSubmit={false}
                />
              </ScrollView>

              {/* Toolbar */}
              <View style={[s.toolbar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.toolbarContent}>
                  {/* Undo / redo */}
                  <TouchableOpacity style={[s.toolbarBtn, { borderColor: theme.border }]} onPress={undo} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="undo" size={18} color={theme.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.toolbarBtn, { borderColor: theme.border }]} onPress={redo} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="redo" size={18} color={theme.accent} />
                  </TouchableOpacity>
                  <View style={[s.toolbarSep, { backgroundColor: theme.border }]} />
                  {/* Formatting */}
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
                  <View style={[s.toolbarSep, { backgroundColor: theme.border }]} />
                  {/* Clear all */}
                  <TouchableOpacity
                    style={[s.toolbarBtn, { borderColor: '#FF4444' + '66' }]}
                    onPress={() => applyText('')}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="delete-sweep-outline" size={18} color="#FF4444" />
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </>
          )}
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

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 12,
  },

  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10, gap: 6 },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle:   { fontSize: 15, fontWeight: '700', textAlign: 'right', flex: 1 },
  cardDate:    { fontSize: 11 },
  cardPreview: { fontSize: 13, lineHeight: 18, textAlign: 'right' },

  fabMenu: { position: 'absolute', bottom: 90, right: 16, gap: 8, zIndex: 10 },
  fabMenuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
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

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmPanel: {
    width: '100%', borderRadius: 20, borderWidth: 1, padding: 28, alignItems: 'center', gap: 10,
  },
  confirmTitle: { fontSize: 19, fontWeight: '800' },
  confirmMsg:   { fontSize: 14, textAlign: 'center' },
  confirmBtns:  { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  confirmCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  confirmDelete: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#FF4444' },

  editorContainer: { flex: 1 },
  editorBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  editorBack:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editorBackText:  { fontSize: 14, fontWeight: '600' },
  editorActions:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editorDeleteBtn: { padding: 6 },
  previewToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
  },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },

  titleInput:   { borderBottomWidth: 1, paddingBottom: 12, marginBottom: 16, fontSize: 20, fontWeight: '700' },
  contentInput: { minHeight: 300, lineHeight: 24, fontSize: 15 },

  toolbar:        { borderTopWidth: 1, paddingVertical: 6 },
  toolbarContent: { paddingHorizontal: 12, gap: 6, flexDirection: 'row', alignItems: 'center' },
  toolbarBtn: {
    width: 36, height: 36, borderRadius: 8, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  toolbarSep: { width: 1, height: 24, marginHorizontal: 2 },

  // File viewer
  fileInfoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 14, borderWidth: 1,
  },
  fileInfoName: { fontSize: 15, fontWeight: '700', textAlign: 'right' },
  fileInfoType: { fontSize: 12, textAlign: 'right', marginTop: 2 },
  openFileBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  notesLabel:   { fontSize: 13, fontWeight: '700', textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.5 },
  notesInput: {
    borderWidth: 1, borderRadius: 12, padding: 14,
    minHeight: 160, fontSize: 15, lineHeight: 22,
  },
});

export default SummariesScreen;
