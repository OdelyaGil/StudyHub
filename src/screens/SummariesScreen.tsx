import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { collection, getDocs, setDoc, deleteDoc, doc as fsDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { loadField, saveField } from '../utils/firestore';
import { useTheme } from '../context/ThemeContext';
import { AppTheme } from '../context/ThemeContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

type SummaryType = 'text' | 'file';

interface Summary {
  id: string;
  folderId?: string;
  title: string;
  type: SummaryType;
  content: string;
  fileName?: string;
  mimeType?: string;
  downloadURL?: string;
  createdAt: number;
  updatedAt: number;
}

const REJECT_MIMES = ['audio/', 'video/', 'image/'];
const isRejected  = (m?: string) => !!m && REJECT_MIMES.some(t => m.startsWith(t));

const FILE_COLL = (uid: string) => collection(db, 'users', uid, 'fileSummaries');

const loadFileSummaries = async (): Promise<Summary[]> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  try {
    const snap = await getDocs(FILE_COLL(uid));
    return snap.docs.map(d => d.data() as Summary);
  } catch { return []; }
};

const saveFileSummaryDoc = async (sum: Summary) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await setDoc(fsDoc(FILE_COLL(uid), sum.id), sum);
};

const delFileSummaryDoc = async (id: string) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await deleteDoc(fsDoc(FILE_COLL(uid), id));
};

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

const getFileIcon = (mime?: string): React.ComponentProps<typeof MaterialCommunityIcons>['name'] => {
  if (!mime) return 'file-outline';
  if (mime.includes('pdf'))                              return 'file-pdf-box';
  if (mime.includes('word') || mime.includes('document')) return 'file-word-outline';
  if (mime.includes('excel') || mime.includes('spreadsheet')) return 'file-excel-outline';
  if (mime.includes('presentation'))                     return 'file-powerpoint-outline';
  if (mime.startsWith('text/'))                          return 'file-document-outline';
  return 'file-outline';
};

// ── Markdown preview ──────────────────────────────────────────────────────────

const parseInline = (text: string) => {
  const out: Array<{ text: string; bold: boolean; italic: boolean }> = [];
  let i = 0, cur = '', bold = false, italic = false;
  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') {
      if (cur) out.push({ text: cur, bold, italic }); cur = ''; bold = !bold; i += 2;
    } else if (text[i] === '*') {
      if (cur) out.push({ text: cur, bold, italic }); cur = ''; italic = !italic; i += 1;
    } else { cur += text[i]; i++; }
  }
  if (cur) out.push({ text: cur, bold, italic });
  return out;
};

const InlineMd = ({ text, base }: { text: string; base: object }) =>
  <Text>{parseInline(text).map((seg, i) =>
    <Text key={i} style={[base, seg.bold ? { fontWeight: '800' } : null, seg.italic ? { fontStyle: 'italic' } : null]}>
      {seg.text}
    </Text>)}</Text>;

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
            <InlineMd text={line.slice(2)} base={base} /><Text style={base}>•</Text></View>;
        if (/^\d+\.\s/.test(line)) {
          const [num, ...rest] = line.split('. ');
          return <View key={i} style={{ flexDirection: 'row', gap: 8, marginVertical: 2, justifyContent: 'flex-end' }}>
            <InlineMd text={rest.join('. ')} base={base} /><Text style={base}>{num}.</Text></View>;
        }
        if (line.startsWith('> '))
          return <View key={i} style={{ borderRightWidth: 3, borderRightColor: theme.accent, paddingRight: 10, marginVertical: 2 }}>
            <InlineMd text={line.slice(2)} base={{ ...base, color: theme.textSub }} /></View>;
        if (line === '') return <View key={i} style={{ height: 8 }} />;
        return <InlineMd key={i} text={line} base={base} />;
      })}
    </ScrollView>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const SummariesScreen = () => {
  const theme = useTheme();

  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [folders,   setFolders]   = useState<Folder[]>([]);
  const [selFolder, setSelFolder] = useState<string | null>(null);
  const [importError, setImportError] = useState('');
  const [importing,   setImporting]   = useState(false);
  const [fabOpen,     setFabOpen]     = useState(false);

  // Text editor
  const [editModal,   setEditModal]   = useState(false);
  const [editing,     setEditing]     = useState<Summary | null>(null);
  const [editTitle,   setEditTitle]   = useState('');
  const [editContent, setEditContent] = useState('');
  const [editFolder,  setEditFolder]  = useState<string | undefined>();
  const [previewMode, setPreviewMode] = useState(false);

  // File viewer
  const [fileModal,    setFileModal]    = useState(false);
  const [viewingFile,  setViewingFile]  = useState<Summary | null>(null);
  const [fileNotes,    setFileNotes]    = useState('');

  // Delete summary confirm
  const [confirmModal, setConfirmModal] = useState(false);
  const [confirmId,    setConfirmId]    = useState<string | null>(null);

  // Folder modals
  const [newFolderModal,   setNewFolderModal]   = useState(false);
  const [newFolderName,    setNewFolderName]    = useState('');
  const [folderMenuModal,  setFolderMenuModal]  = useState(false);
  const [folderMenuTarget, setFolderMenuTarget] = useState<Folder | null>(null);
  const [renameFolderModal,setRenameFolderModal]= useState(false);
  const [renameFolderVal,  setRenameFolderVal]  = useState('');
  const [delFolderModal,   setDelFolderModal]   = useState(false);

  const load = useCallback(async () => {
    const [sumData, folData, fileSums] = await Promise.all([
      loadField('summaries'),
      loadField('summaryFolders'),
      loadFileSummaries(),
    ]);
    const textSums = (Array.isArray(sumData) ? sumData : []).filter((s: any) => s.type !== 'file');
    setSummaries([...textSums, ...fileSums]);
    setFolders(Array.isArray(folData) ? folData : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveFolders = (next: Folder[]) => { setFolders(next); saveField('summaryFolders', next); };

  const upsertSummary = async (sum: Summary) => {
    if (sum.type === 'file') {
      await saveFileSummaryDoc(sum);
      setSummaries(prev =>
        prev.some(s => s.id === sum.id)
          ? prev.map(s => s.id === sum.id ? sum : s)
          : [...prev, sum],
      );
    } else {
      setSummaries(prev => {
        const next = prev.some(s => s.id === sum.id)
          ? prev.map(s => s.id === sum.id ? sum : s)
          : [...prev, sum];
        saveField('summaries', next.filter(s => s.type !== 'file'));
        return next;
      });
    }
  };

  // ── Summary editor ────────────────────────────────────────────────────────

  const openNew = (title = '', content = '') => {
    setFabOpen(false);
    setEditing(null);
    setEditTitle(title);
    setEditContent(content);
    setEditFolder(selFolder ?? undefined);
    setPreviewMode(false);
    setEditModal(true);
  };

  const openEdit = (sum: Summary) => {
    if (sum.type === 'file') {
      setViewingFile(sum); setFileNotes(sum.content); setFileModal(true); return;
    }
    setEditing(sum);
    setEditTitle(sum.title);
    setEditContent(sum.content);
    setEditFolder(sum.folderId);
    setPreviewMode(false);
    setEditModal(true);
  };

  const saveSummary = () => {
    const title = editTitle.trim();
    if (!title) return;
    const now = Date.now();
    const sum: Summary = editing
      ? { ...editing, title, content: editContent, folderId: editFolder, updatedAt: now }
      : { id: now.toString(), title, content: editContent, type: 'text', folderId: editFolder, createdAt: now, updatedAt: now };
    upsertSummary(sum);
    setEditModal(false);
  };

  const saveFileNotes = async () => {
    if (!viewingFile) return;
    await upsertSummary({ ...viewingFile, content: fileNotes, updatedAt: Date.now() });
    setFileModal(false);
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const askDelete = (id: string) => {
    setConfirmId(id); setEditModal(false); setFileModal(false); setConfirmModal(true);
  };

  const doDelete = async () => {
    if (!confirmId) { setConfirmModal(false); return; }
    const sum = summaries.find(s => s.id === confirmId);
    if (sum?.type === 'file') {
      try { await delFileSummaryDoc(confirmId); } catch {}
    }
    setSummaries(prev => {
      const next = prev.filter(s => s.id !== confirmId);
      saveField('summaries', next.filter(s => s.type !== 'file'));
      return next;
    });
    setConfirmModal(false);
    setConfirmId(null);
  };

  // ── File import ───────────────────────────────────────────────────────────

  // Read a Blob/File as a base-64 data URL
  const readAsDataURL = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve((e.target?.result as string) ?? '');
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  // On web: open browser's native file dialog directly (expo-document-picker
  // sometimes resolves {canceled:true} on web even after a file is chosen)
  const pickFileWeb = (): Promise<File | null> =>
    new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = () => resolve(input.files?.[0] ?? null);
      // If dialog is dismissed without selection, nothing calls onchange — that's fine.
      input.click();
    });

  const importFile = async () => {
    setFabOpen(false);
    setImportError('');

    let fileName: string;
    let mimeType: string;
    let blob: Blob;

    try {
      if (Platform.OS === 'web') {
        const file = await pickFileWeb();
        if (!file) return;
        fileName = file.name;
        mimeType = file.type ?? '';
        blob = file;
      } else {
        const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
        if (result.canceled || !result.assets?.length) return;
        const asset = result.assets[0];
        fileName = asset.name;
        mimeType = asset.mimeType ?? '';
        blob = await fetch(asset.uri).then(r => r.blob());
      }
    } catch {
      setImportError('לא ניתן לפתוח את חלון בחירת הקובץ');
      return;
    }

    if (isRejected(mimeType)) {
      setImportError('לא ניתן לייבא קבצי אודיו, וידאו או תמונות');
      return;
    }

    const MAX_SIZE = 700 * 1024;
    if (blob.size > MAX_SIZE) {
      setImportError(`הקובץ גדול מדי (${Math.round(blob.size / 1024)} KB). גודל מקסימלי: 700KB.`);
      return;
    }

    setImporting(true);
    try {
      const dataURL = await readAsDataURL(blob);
      const fileId  = Date.now().toString();
      const now     = Date.now();
      const sum: Summary = {
        id: fileId,
        title: fileName,
        type: 'file',
        content: '',
        folderId: selFolder ?? undefined,
        fileName,
        mimeType,
        downloadURL: dataURL,
        createdAt: now,
        updatedAt: now,
      };
      await saveFileSummaryDoc(sum);
      setSummaries(prev => [...prev, sum]);
    } catch (err: any) {
      setImportError(`שגיאה בייבוא: ${err?.message ?? 'שגיאה לא ידועה'}`);
    } finally {
      setImporting(false);
    }
  };

  // ── Folder CRUD ───────────────────────────────────────────────────────────

  const addFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    saveFolders([...folders, { id: Date.now().toString(), name, createdAt: Date.now() }]);
    setNewFolderName(''); setNewFolderModal(false);
  };

  const openFolderMenu = (f: Folder) => { setFolderMenuTarget(f); setFolderMenuModal(true); };

  const startRename = () => {
    if (!folderMenuTarget) return;
    setRenameFolderVal(folderMenuTarget.name);
    setFolderMenuModal(false); setRenameFolderModal(true);
  };

  const doRename = () => {
    const name = renameFolderVal.trim();
    if (!name || !folderMenuTarget) return;
    saveFolders(folders.map(f => f.id === folderMenuTarget.id ? { ...f, name } : f));
    setRenameFolderModal(false); setFolderMenuTarget(null);
  };

  const startDeleteFolder = () => { setFolderMenuModal(false); setDelFolderModal(true); };

  const doDeleteFolder = () => {
    if (!folderMenuTarget) return;
    saveFolders(folders.filter(f => f.id !== folderMenuTarget.id));
    setSummaries(prev => {
      const next = prev.map(s => s.folderId === folderMenuTarget.id ? { ...s, folderId: undefined } : s);
      saveField('summaries', next);
      return next;
    });
    if (selFolder === folderMenuTarget.id) setSelFolder(null);
    setDelFolderModal(false); setFolderMenuTarget(null);
  };

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = summaries
    .filter(s => selFolder === null || s.folderId === selFolder)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const accentText = theme.mode === 'dark' ? '#000' : '#fff';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>

      {/* Folder chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={[s.folderBar, { borderBottomColor: theme.border }]}
        contentContainerStyle={s.folderChips}>
        <TouchableOpacity
          style={[s.chip, { backgroundColor: selFolder === null ? theme.accent : theme.surface, borderColor: selFolder === null ? theme.accent : theme.border }]}
          onPress={() => setSelFolder(null)}>
          <Text style={[s.chipText, { color: selFolder === null ? accentText : theme.text }]}>הכל</Text>
        </TouchableOpacity>
        {folders.map(f => {
          const active = selFolder === f.id;
          return (
            <TouchableOpacity key={f.id}
              style={[s.chip, { backgroundColor: active ? theme.accent : theme.surface, borderColor: active ? theme.accent : theme.border }]}
              onPress={() => setSelFolder(f.id)}
              onLongPress={() => openFolderMenu(f)}>
              <MaterialCommunityIcons name="folder-outline" size={14} color={active ? accentText : theme.accent} />
              <Text style={[s.chipText, { color: active ? accentText : theme.text }]}>{f.name}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[s.chip, s.chipAdd, { borderColor: theme.border }]}
          onPress={() => { setNewFolderName(''); setNewFolderModal(true); }}>
          <MaterialCommunityIcons name="folder-plus-outline" size={16} color={theme.accent} />
        </TouchableOpacity>
      </ScrollView>

      {/* Import status — always visible, outside scroll */}
      {importing && (
        <View style={[s.statusBanner, { backgroundColor: theme.accent + '22', borderColor: theme.accent }]}>
          <MaterialCommunityIcons name="cloud-upload-outline" size={16} color={theme.accent} />
          <Text style={{ color: theme.accent, fontSize: 13, flex: 1, textAlign: 'right' }}>
            מעלה קובץ...
          </Text>
        </View>
      )}
      {!importing && importError !== '' && (
        <View style={[s.statusBanner, { backgroundColor: '#FF444422', borderColor: '#FF4444' }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#FF4444" />
          <Text style={{ color: '#FF4444', fontSize: 13, flex: 1, textAlign: 'right' }}>{importError}</Text>
          <TouchableOpacity onPress={() => setImportError('')}>
            <MaterialCommunityIcons name="close" size={16} color="#FF4444" />
          </TouchableOpacity>
        </View>
      )}

      {/* Summary list */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {filtered.length === 0 && (
          <View style={s.empty}>
            <MaterialCommunityIcons name="note-text-outline" size={52} color={theme.textSub + '55'} />
            <Text style={[s.emptyText, { color: theme.textSub }]}>אין סיכומים עדיין</Text>
            <Text style={[s.emptyHint, { color: theme.textSub + '88' }]}>לחץ/י + ליצירת סיכום או ייבוא קובץ</Text>
          </View>
        )}

        {filtered.map(sum => (
          <TouchableOpacity key={sum.id}
            style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => openEdit(sum)}
            onLongPress={() => askDelete(sum.id)}
            activeOpacity={0.75}>
            <View style={s.cardHeader}>
              {sum.type === 'file' && <MaterialCommunityIcons name={getFileIcon(sum.mimeType)} size={18} color={theme.accent} />}
              <Text style={[s.cardTitle, { color: theme.text }]}>{sum.title}</Text>
              <Text style={[s.cardDate,  { color: theme.textSub }]}>{formatDate(sum.updatedAt)}</Text>
            </View>
            {sum.type === 'text' && sum.content.length > 0 && (
              <Text style={[s.cardPreview, { color: theme.textSub }]} numberOfLines={2}>
                {sum.content.replace(/[#*`>•]/g, '').trim()}
              </Text>
            )}
            {sum.type === 'file' && (
              <Text style={[s.cardPreview, { color: theme.textSub }]}>
                {sum.content ? sum.content.slice(0, 80) : 'לחץ/י לפתיחה ועריכת הערות'}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* FAB backdrop */}
      {fabOpen && <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setFabOpen(false)} />}

      {fabOpen && (
        <View style={s.fabMenu}>
          <TouchableOpacity style={[s.fabItem, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => openNew()}>
            <MaterialCommunityIcons name="note-plus-outline" size={20} color={theme.accent} />
            <Text style={[s.fabItemLabel, { color: theme.text }]}>סיכום חדש</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.fabItem, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={importFile}>
            <MaterialCommunityIcons name="file-import-outline" size={20} color={theme.accent} />
            <Text style={[s.fabItemLabel, { color: theme.text }]}>ייבא קובץ</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={[s.fab, { backgroundColor: theme.accent }]} onPress={() => setFabOpen(v => !v)} activeOpacity={0.85}>
        <MaterialCommunityIcons name={fabOpen ? 'close' : 'plus'} size={28} color={accentText} />
      </TouchableOpacity>

      {/* ── Delete summary confirm ────────────────────────────────────────── */}
      <Modal visible={confirmModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.confirmPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="trash-can-outline" size={36} color="#FF4444" />
            <Text style={[s.confirmTitle, { color: theme.text }]}>מחיקת סיכום</Text>
            <Text style={[s.confirmMsg,   { color: theme.textSub }]}>האם למחוק את הסיכום לצמיתות?</Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={[s.confirmCancel, { borderColor: theme.border }]} onPress={() => setConfirmModal(false)}>
                <Text style={{ color: theme.textSub, fontWeight: '600', fontSize: 15 }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmDel} onPress={doDelete}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>מחק</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── New folder ───────────────────────────────────────────────────── */}
      <Modal visible={newFolderModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.panelTitle, { color: theme.text }]}>תיקייה חדשה</Text>
            <TextInput
              style={[s.panelInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="שם התיקייה" placeholderTextColor={theme.textSub}
              value={newFolderName} onChangeText={setNewFolderName}
              textAlign="right" autoFocus onSubmitEditing={addFolder} />
            <View style={s.panelBtns}>
              <TouchableOpacity onPress={() => setNewFolderModal(false)} style={s.panelCancel}>
                <Text style={{ color: theme.textSub, fontWeight: '600' }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addFolder} style={[s.panelOk, { backgroundColor: theme.accent }]}>
                <Text style={{ color: accentText, fontWeight: '700' }}>צור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Folder action sheet ──────────────────────────────────────────── */}
      <Modal visible={folderMenuModal} transparent animationType="fade">
        <TouchableOpacity style={s.sheetOverlay} activeOpacity={1} onPress={() => setFolderMenuModal(false)}>
          <View style={[s.actionSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.sheetTitle, { color: theme.textSub }]} numberOfLines={1}>{folderMenuTarget?.name}</Text>
            <TouchableOpacity style={[s.sheetBtn, { borderBottomColor: theme.border }]} onPress={startRename}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.accent} />
              <Text style={[s.sheetBtnText, { color: theme.text }]}>שנה שם</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetBtn} onPress={startDeleteFolder}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FF4444" />
              <Text style={[s.sheetBtnText, { color: '#FF4444' }]}>מחק תיקייה</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Rename folder ────────────────────────────────────────────────── */}
      <Modal visible={renameFolderModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.panelTitle, { color: theme.text }]}>שנה שם תיקייה</Text>
            <TextInput
              style={[s.panelInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="שם חדש" placeholderTextColor={theme.textSub}
              value={renameFolderVal} onChangeText={setRenameFolderVal}
              textAlign="right" autoFocus onSubmitEditing={doRename} />
            <View style={s.panelBtns}>
              <TouchableOpacity onPress={() => setRenameFolderModal(false)} style={s.panelCancel}>
                <Text style={{ color: theme.textSub, fontWeight: '600' }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={doRename} style={[s.panelOk, { backgroundColor: theme.accent }]}>
                <Text style={{ color: accentText, fontWeight: '700' }}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete folder confirm ─────────────────────────────────────────── */}
      <Modal visible={delFolderModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.confirmPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="trash-can-outline" size={36} color="#FF4444" />
            <Text style={[s.confirmTitle, { color: theme.text }]}>מחיקת תיקייה</Text>
            <Text style={[s.confirmMsg, { color: theme.textSub }]}>
              למחוק את "{folderMenuTarget?.name}"?{'\n'}הסיכומים בתיקייה לא יימחקו.
            </Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={[s.confirmCancel, { borderColor: theme.border }]} onPress={() => setDelFolderModal(false)}>
                <Text style={{ color: theme.textSub, fontWeight: '600', fontSize: 15 }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmDel} onPress={doDeleteFolder}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>מחק</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── File viewer ──────────────────────────────────────────────────── */}
      <Modal visible={fileModal} animationType="slide">
        <View style={[s.editorWrap, { backgroundColor: theme.bg }]}>
          <View style={[s.editorBar, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setFileModal(false)} style={s.editorBack}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.accent} />
              <Text style={[s.editorBackText, { color: theme.accent }]}>סיכומים</Text>
            </TouchableOpacity>
            <View style={s.editorActions}>
              {viewingFile && (
                <TouchableOpacity onPress={() => askDelete(viewingFile.id)} style={s.delBtn}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FF4444" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={saveFileNotes} style={[s.saveBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: accentText, fontWeight: '700', fontSize: 14 }}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View style={[s.fileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <MaterialCommunityIcons name={getFileIcon(viewingFile?.mimeType)} size={40} color={theme.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[s.fileName, { color: theme.text }]}>{viewingFile?.fileName ?? viewingFile?.title}</Text>
                <Text style={[s.fileType, { color: theme.textSub }]}>{viewingFile?.mimeType ?? 'קובץ'}</Text>
              </View>
              <TouchableOpacity
                onPress={() => viewingFile?.downloadURL && Linking.openURL(viewingFile.downloadURL)}
                style={[s.openBtn, { backgroundColor: theme.accent }]}>
                <MaterialCommunityIcons name="open-in-new" size={16} color={accentText} />
                <Text style={{ color: accentText, fontWeight: '700', fontSize: 13 }}>פתח</Text>
              </TouchableOpacity>
            </View>
            <Text style={[s.notesLabel, { color: theme.textSub }]}>הערות</Text>
            <TextInput
              style={[s.notesInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
              placeholder="הוסף הערות לקובץ זה..." placeholderTextColor={theme.textSub}
              value={fileNotes} onChangeText={setFileNotes}
              multiline textAlign="right" textAlignVertical="top" blurOnSubmit={false} />
          </ScrollView>
        </View>
      </Modal>

      {/* ── Text editor ──────────────────────────────────────────────────── */}
      <Modal visible={editModal} animationType="slide">
        <KeyboardAvoidingView
          style={[s.editorWrap, { backgroundColor: theme.bg }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          <View style={[s.editorBar, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setEditModal(false)} style={s.editorBack}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.accent} />
              <Text style={[s.editorBackText, { color: theme.accent }]}>סיכומים</Text>
            </TouchableOpacity>
            <View style={s.editorActions}>
              {editing && (
                <TouchableOpacity onPress={() => askDelete(editing.id)} style={s.delBtn}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FF4444" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setPreviewMode(v => !v)}
                style={[s.previewToggle, { borderColor: theme.border, backgroundColor: previewMode ? theme.accent + '22' : 'transparent' }]}>
                <MaterialCommunityIcons name={previewMode ? 'pencil-outline' : 'eye-outline'} size={18} color={previewMode ? theme.accent : theme.textSub} />
                <Text style={{ color: previewMode ? theme.accent : theme.textSub, fontSize: 12, fontWeight: '600' }}>
                  {previewMode ? 'עריכה' : 'תצוגה'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveSummary} style={[s.saveBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: accentText, fontWeight: '700', fontSize: 14 }}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Folder chips inside editor */}
          {folders.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={[s.editorFolderBar, { borderBottomColor: theme.border }]}
              contentContainerStyle={s.editorFolderChips}>
              <TouchableOpacity
                style={[s.chip, { backgroundColor: editFolder === undefined ? theme.accent : theme.surface, borderColor: editFolder === undefined ? theme.accent : theme.border }]}
                onPress={() => setEditFolder(undefined)}>
                <Text style={[s.chipText, { color: editFolder === undefined ? accentText : theme.text }]}>ללא תיקייה</Text>
              </TouchableOpacity>
              {folders.map(f => {
                const active = editFolder === f.id;
                return (
                  <TouchableOpacity key={f.id}
                    style={[s.chip, { backgroundColor: active ? theme.accent : theme.surface, borderColor: active ? theme.accent : theme.border }]}
                    onPress={() => setEditFolder(f.id)}>
                    <MaterialCommunityIcons name="folder-outline" size={14} color={active ? accentText : theme.accent} />
                    <Text style={[s.chipText, { color: active ? accentText : theme.text }]}>{f.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {previewMode ? (
            <View style={{ flex: 1 }}>
              <TextInput
                style={[s.titleInput, { color: theme.text, borderBottomColor: theme.border, marginHorizontal: 20, marginTop: 16 }]}
                placeholder="כותרת הסיכום" placeholderTextColor={theme.textSub}
                value={editTitle} onChangeText={setEditTitle} textAlign="right" />
              <MarkdownPreview content={editContent} theme={theme} />
            </View>
          ) : (
            <View style={s.editorBody}>
              <TextInput
                style={[s.titleInput, { color: theme.text, borderBottomColor: theme.border }]}
                placeholder="כותרת הסיכום" placeholderTextColor={theme.textSub}
                value={editTitle} onChangeText={setEditTitle}
                textAlign="right" blurOnSubmit={false} returnKeyType="next" />
              <TextInput
                style={[s.contentInput, { color: theme.text }]}
                placeholder="כתוב את הסיכום כאן..." placeholderTextColor={theme.textSub}
                value={editContent} onChangeText={setEditContent}
                multiline textAlign="right" textAlignVertical="top"
                blurOnSubmit={false} />
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10, padding: 12, margin: 12, marginBottom: 0,
  },

  folderBar:   { borderBottomWidth: 1, flexGrow: 0 },
  folderChips: { padding: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipAdd:  { paddingHorizontal: 8 },

  empty:     { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '600' },
  emptyHint: { fontSize: 12 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 12,
  },

  card:        { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10, gap: 6 },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle:   { fontSize: 15, fontWeight: '700', textAlign: 'right', flex: 1 },
  cardDate:    { fontSize: 11 },
  cardPreview: { fontSize: 13, lineHeight: 18, textAlign: 'right' },

  fabMenu: { position: 'absolute', bottom: 90, right: 16, gap: 8, zIndex: 10 },
  fabItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  fabItemLabel: { fontSize: 14, fontWeight: '600' },
  fab: {
    position: 'absolute', bottom: 20, right: 16,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    elevation: 4, zIndex: 11,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4,
  },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },

  confirmPanel:  { width: '100%', borderRadius: 20, borderWidth: 1, padding: 28, alignItems: 'center', gap: 10 },
  confirmTitle:  { fontSize: 19, fontWeight: '800' },
  confirmMsg:    { fontSize: 14, textAlign: 'center' },
  confirmBtns:   { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  confirmCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  confirmDel:    { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#FF4444' },

  panel:       { width: '100%', borderRadius: 18, borderWidth: 1, padding: 24, gap: 14 },
  panelTitle:  { fontSize: 18, fontWeight: '700', textAlign: 'right' },
  panelInput:  { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  panelBtns:   { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  panelCancel: { paddingHorizontal: 16, paddingVertical: 10 },
  panelOk:     { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  actionSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, paddingBottom: 24,
  },
  sheetTitle:   { fontSize: 12, fontWeight: '600', textAlign: 'center', paddingVertical: 14, letterSpacing: 0.5 },
  sheetBtn:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  sheetBtnText: { fontSize: 16, fontWeight: '600' },

  editorWrap:    { flex: 1 },
  editorBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  editorBack:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editorBackText:{ fontSize: 14, fontWeight: '600' },
  editorActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  delBtn:        { padding: 6 },
  previewToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  saveBtn:       { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },

  editorFolderBar:   { borderBottomWidth: 1, flexGrow: 0 },
  editorFolderChips: { padding: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },

  editorBody:   { flex: 1, padding: 20 },
  titleInput:   { borderBottomWidth: 1, paddingBottom: 12, marginBottom: 16, fontSize: 20, fontWeight: '700' },
  contentInput: { flex: 1, lineHeight: 24, fontSize: 15, textAlignVertical: 'top' },

  fileCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1 },
  fileName:  { fontSize: 15, fontWeight: '700', textAlign: 'right' },
  fileType:  { fontSize: 12, textAlign: 'right', marginTop: 2 },
  openBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  notesLabel:{ fontSize: 13, fontWeight: '700', textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.5 },
  notesInput:{ borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 160, fontSize: 15, lineHeight: 22 },
});

export default SummariesScreen;
