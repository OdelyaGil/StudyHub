import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadField, saveField } from '../utils/firestore';
import { useTheme } from '../context/ThemeContext';

interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

interface Question {
  id: string;
  folderId?: string;
  question: string;
  answer: string;
  course?: string;
  createdAt: number;
}

const QuizBankScreen = () => {
  const theme = useTheme();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [folders,   setFolders]   = useState<Folder[]>([]);
  const [selFolder, setSelFolder] = useState<string | null>(null);
  const [revealed,  setRevealed]  = useState<Set<string>>(new Set());

  // ── Add question ──
  const [addModal,  setAddModal]  = useState(false);
  const [newQ,      setNewQ]      = useState('');
  const [newA,      setNewA]      = useState('');
  const [newCourse, setNewCourse] = useState('');
  const [newFolder, setNewFolder] = useState<string | undefined>();

  // ── Question menu / edit / delete ──
  const [menuModal,    setMenuModal]    = useState(false);
  const [menuTarget,   setMenuTarget]   = useState<Question | null>(null);
  const [editModal,    setEditModal]    = useState(false);
  const [editQ,        setEditQ]        = useState('');
  const [editA,        setEditA]        = useState('');
  const [editCourse,   setEditCourse]   = useState('');
  const [editFolderId, setEditFolderId] = useState<string | undefined>();
  const [deleteModal,  setDeleteModal]  = useState(false);

  // ── Folder modals ──
  const [newFolderModal,    setNewFolderModal]    = useState(false);
  const [newFolderName,     setNewFolderName]     = useState('');
  const [folderMenuModal,   setFolderMenuModal]   = useState(false);
  const [folderMenuTarget,  setFolderMenuTarget]  = useState<Folder | null>(null);
  const [renameFolderModal, setRenameFolderModal] = useState(false);
  const [renameFolderVal,   setRenameFolderVal]   = useState('');
  const [delFolderModal,    setDelFolderModal]    = useState(false);

  const load = useCallback(async () => {
    try {
      const [qData, fData] = await Promise.all([
        loadField('quizBank'),
        loadField('quizBankFolders'),
      ]);
      setQuestions(Array.isArray(qData) ? qData : []);
      setFolders(Array.isArray(fData) ? fData : []);
    } catch (e) {
      console.error('QuizBankScreen load:', e);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const persistQ = (next: Question[]) => { setQuestions(next); saveField('quizBank', next); };
  const persistF = (next: Folder[])   => { setFolders(next);   saveField('quizBankFolders', next); };

  // ── Reveal toggle ─────────────────────────────────────────────────────────────
  const toggleReveal = (id: string) => {
    setRevealed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Question CRUD ─────────────────────────────────────────────────────────────
  const openAdd = () => {
    setNewQ(''); setNewA(''); setNewCourse('');
    setNewFolder(selFolder ?? undefined);
    setAddModal(true);
  };

  const addQuestion = () => {
    const q = newQ.trim(), a = newA.trim();
    if (!q || !a) return;
    persistQ([...questions, {
      id: Date.now().toString(), folderId: newFolder,
      question: q, answer: a,
      course: newCourse.trim() || undefined, createdAt: Date.now(),
    }]);
    setAddModal(false);
  };

  const openMenu = (q: Question) => { setMenuTarget(q); setMenuModal(true); };

  const openEdit = () => {
    if (!menuTarget) return;
    setEditQ(menuTarget.question);
    setEditA(menuTarget.answer);
    setEditCourse(menuTarget.course ?? '');
    setEditFolderId(menuTarget.folderId);
    setMenuModal(false); setEditModal(true);
  };

  const saveEdit = () => {
    const q = editQ.trim(), a = editA.trim();
    if (!q || !a || !menuTarget) return;
    persistQ(questions.map(item =>
      item.id === menuTarget.id
        ? { ...item, question: q, answer: a, course: editCourse.trim() || undefined, folderId: editFolderId }
        : item,
    ));
    setEditModal(false); setMenuTarget(null);
  };

  const openDelete = () => { setMenuModal(false); setDeleteModal(true); };

  const confirmDelete = () => {
    if (!menuTarget) return;
    persistQ(questions.filter(q => q.id !== menuTarget.id));
    setDeleteModal(false); setMenuTarget(null);
  };

  // ── Folder CRUD ───────────────────────────────────────────────────────────────
  const addFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    persistF([...folders, { id: Date.now().toString(), name, createdAt: Date.now() }]);
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
    persistF(folders.map(f => f.id === folderMenuTarget.id ? { ...f, name } : f));
    setRenameFolderModal(false); setFolderMenuTarget(null);
  };

  const startDelFolder = () => { setFolderMenuModal(false); setDelFolderModal(true); };

  const doDelFolder = () => {
    if (!folderMenuTarget) return;
    persistF(folders.filter(f => f.id !== folderMenuTarget.id));
    setQuestions(prev => {
      const next = prev.map(q => q.folderId === folderMenuTarget.id ? { ...q, folderId: undefined } : q);
      saveField('quizBank', next);
      return next;
    });
    if (selFolder === folderMenuTarget.id) setSelFolder(null);
    setDelFolderModal(false); setFolderMenuTarget(null);
  };

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const filtered = questions.filter(q => selFolder === null || q.folderId === selFolder);
  const accentText = theme.mode === 'dark' ? '#000' : '#fff';

  // ── Folder chip row (reused in add + edit modals) ────────────────────────────
  const FolderPicker = ({ value, onChange }: { value: string | undefined; onChange: (id: string | undefined) => void }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pickerChips}>
      <TouchableOpacity
        style={[s.chip, { backgroundColor: value === undefined ? theme.accent : theme.surface, borderColor: value === undefined ? theme.accent : theme.border }]}
        onPress={() => onChange(undefined)}>
        <Text style={[s.chipText, { color: value === undefined ? accentText : theme.text }]}>ללא תיקייה</Text>
      </TouchableOpacity>
      {folders.map(f => {
        const active = value === f.id;
        return (
          <TouchableOpacity key={f.id}
            style={[s.chip, { backgroundColor: active ? theme.accent : theme.surface, borderColor: active ? theme.accent : theme.border }]}
            onPress={() => onChange(f.id)}>
            <MaterialCommunityIcons name="folder-outline" size={13} color={active ? accentText : theme.accent} />
            <Text style={[s.chipText, { color: active ? accentText : theme.text }]}>{f.name}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>

      {/* Folder filter chips */}
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
              <MaterialCommunityIcons name="folder-outline" size={13} color={active ? accentText : theme.accent} />
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

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {questions.length === 0 && (
          <View style={s.empty}>
            <MaterialCommunityIcons name="help-circle-outline" size={52} color={theme.textSub + '55'} />
            <Text style={[s.emptyText, { color: theme.textSub }]}>אין שאלות עדיין</Text>
            <Text style={[s.emptyHint, { color: theme.textSub + '88' }]}>לחץ/י + להוספת שאלה</Text>
          </View>
        )}

        {filtered.map(q => {
          const isRevealed = revealed.has(q.id);
          return (
            <View key={q.id} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <TouchableOpacity style={s.cardBody} onPress={() => toggleReveal(q.id)} activeOpacity={0.75}>
                <View style={s.qHeader}>
                  {q.course && (
                    <View style={[s.chip, { backgroundColor: theme.accent + '22', borderColor: 'transparent' }]}>
                      <Text style={[s.chipText, { color: theme.accent }]}>{q.course}</Text>
                    </View>
                  )}
                  <MaterialCommunityIcons
                    name={isRevealed ? 'chevron-up' : 'chevron-down'}
                    size={18} color={theme.accent} />
                </View>
                <Text style={[s.questionText, { color: theme.text }]}>{q.question}</Text>
                {isRevealed ? (
                  <View style={[s.answerBox, { borderTopColor: theme.border, backgroundColor: theme.accent + '11' }]}>
                    <Text style={[s.answerLabel, { color: theme.accent }]}>תשובה</Text>
                    <Text style={[s.answerText, { color: theme.text }]}>{q.answer}</Text>
                  </View>
                ) : (
                  <Text style={[s.tapHint, { color: theme.textSub }]}>לחץ/י לגילוי התשובה</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openMenu(q)} style={s.menuBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="dots-vertical" size={20} color={theme.textSub} />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={[s.fab, { backgroundColor: theme.accent }]}
        onPress={openAdd} activeOpacity={0.85}>
        <MaterialCommunityIcons name="plus" size={28} color={accentText} />
      </TouchableOpacity>

      {/* ── Add question ── */}
      <Modal visible={addModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.panelTitle, { color: theme.text }]}>שאלה חדשה</Text>
            {folders.length > 0 && <FolderPicker value={newFolder} onChange={setNewFolder} />}
            <TextInput
              style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="קורס (אופציונלי)" placeholderTextColor={theme.textSub}
              value={newCourse} onChangeText={setNewCourse} textAlign="right" />
            <TextInput
              style={[s.input, s.inputMulti, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="שאלה" placeholderTextColor={theme.textSub}
              value={newQ} onChangeText={setNewQ}
              multiline textAlign="right" textAlignVertical="top" autoFocus />
            <TextInput
              style={[s.input, s.inputMulti, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="תשובה" placeholderTextColor={theme.textSub}
              value={newA} onChangeText={setNewA}
              multiline textAlign="right" textAlignVertical="top" />
            <View style={s.panelBtns}>
              <TouchableOpacity onPress={() => setAddModal(false)} style={s.cancelBtn}>
                <Text style={{ color: theme.textSub, fontWeight: '600' }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addQuestion} style={[s.confirmBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: accentText, fontWeight: '700' }}>הוסף</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Question action sheet ── */}
      <Modal visible={menuModal} transparent animationType="fade">
        <TouchableOpacity style={s.sheetOverlay} activeOpacity={1} onPress={() => setMenuModal(false)}>
          <View style={[s.actionSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.sheetTitle, { color: theme.textSub }]} numberOfLines={2}>{menuTarget?.question}</Text>
            <TouchableOpacity style={[s.sheetBtn, { borderBottomColor: theme.border }]} onPress={openEdit}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.accent} />
              <Text style={[s.sheetBtnText, { color: theme.text }]}>ערוך</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetBtn} onPress={openDelete}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FF4444" />
              <Text style={[s.sheetBtnText, { color: '#FF4444' }]}>מחק</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Edit question ── */}
      <Modal visible={editModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.panelTitle, { color: theme.text }]}>עריכת שאלה</Text>
            {folders.length > 0 && <FolderPicker value={editFolderId} onChange={setEditFolderId} />}
            <TextInput
              style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="קורס (אופציונלי)" placeholderTextColor={theme.textSub}
              value={editCourse} onChangeText={setEditCourse} textAlign="right" autoFocus />
            <TextInput
              style={[s.input, s.inputMulti, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="שאלה" placeholderTextColor={theme.textSub}
              value={editQ} onChangeText={setEditQ}
              multiline textAlign="right" textAlignVertical="top" />
            <TextInput
              style={[s.input, s.inputMulti, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="תשובה" placeholderTextColor={theme.textSub}
              value={editA} onChangeText={setEditA}
              multiline textAlign="right" textAlignVertical="top" />
            <View style={s.panelBtns}>
              <TouchableOpacity onPress={() => { setEditModal(false); setMenuTarget(null); }} style={s.cancelBtn}>
                <Text style={{ color: theme.textSub, fontWeight: '600' }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEdit} style={[s.confirmBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: accentText, fontWeight: '700' }}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete question confirm ── */}
      <Modal visible={deleteModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.confirmPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="trash-can-outline" size={36} color="#FF4444" />
            <Text style={[s.confirmTitle, { color: theme.text }]}>מחיקת שאלה</Text>
            <Text style={[s.confirmMsg, { color: theme.textSub }]}>למחוק את השאלה?</Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={[s.confirmCancel, { borderColor: theme.border }]} onPress={() => setDeleteModal(false)}>
                <Text style={{ color: theme.textSub, fontWeight: '600', fontSize: 15 }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmDel} onPress={confirmDelete}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>מחק</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── New folder ── */}
      <Modal visible={newFolderModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.panelTitle, { color: theme.text }]}>תיקייה חדשה</Text>
            <TextInput
              style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="שם התיקייה" placeholderTextColor={theme.textSub}
              value={newFolderName} onChangeText={setNewFolderName}
              textAlign="right" autoFocus onSubmitEditing={addFolder} />
            <View style={s.panelBtns}>
              <TouchableOpacity onPress={() => setNewFolderModal(false)} style={s.cancelBtn}>
                <Text style={{ color: theme.textSub, fontWeight: '600' }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addFolder} style={[s.confirmBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: accentText, fontWeight: '700' }}>צור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Folder action sheet ── */}
      <Modal visible={folderMenuModal} transparent animationType="fade">
        <TouchableOpacity style={s.sheetOverlay} activeOpacity={1} onPress={() => setFolderMenuModal(false)}>
          <View style={[s.actionSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.sheetTitle, { color: theme.textSub }]} numberOfLines={1}>{folderMenuTarget?.name}</Text>
            <TouchableOpacity style={[s.sheetBtn, { borderBottomColor: theme.border }]} onPress={startRename}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.accent} />
              <Text style={[s.sheetBtnText, { color: theme.text }]}>שנה שם</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetBtn} onPress={startDelFolder}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FF4444" />
              <Text style={[s.sheetBtnText, { color: '#FF4444' }]}>מחק תיקייה</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Rename folder ── */}
      <Modal visible={renameFolderModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.panelTitle, { color: theme.text }]}>שנה שם תיקייה</Text>
            <TextInput
              style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="שם חדש" placeholderTextColor={theme.textSub}
              value={renameFolderVal} onChangeText={setRenameFolderVal}
              textAlign="right" autoFocus onSubmitEditing={doRename} />
            <View style={s.panelBtns}>
              <TouchableOpacity onPress={() => setRenameFolderModal(false)} style={s.cancelBtn}>
                <Text style={{ color: theme.textSub, fontWeight: '600' }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={doRename} style={[s.confirmBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: accentText, fontWeight: '700' }}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete folder confirm ── */}
      <Modal visible={delFolderModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.confirmPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="trash-can-outline" size={36} color="#FF4444" />
            <Text style={[s.confirmTitle, { color: theme.text }]}>מחיקת תיקייה</Text>
            <Text style={[s.confirmMsg, { color: theme.textSub }]}>
              למחוק את "{folderMenuTarget?.name}"?{'\n'}השאלות בתיקייה לא יימחקו.
            </Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={[s.confirmCancel, { borderColor: theme.border }]} onPress={() => setDelFolderModal(false)}>
                <Text style={{ color: theme.textSub, fontWeight: '600', fontSize: 15 }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmDel} onPress={doDelFolder}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>מחק</Text>
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

  folderBar:   { borderBottomWidth: 1, flexGrow: 0 },
  folderChips: { padding: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipAdd:  { paddingHorizontal: 8 },

  pickerChips: { flexDirection: 'row', gap: 8, paddingVertical: 4 },

  empty:     { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '600' },
  emptyHint: { fontSize: 12 },

  card:     { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  cardBody: { flex: 1, padding: 14, gap: 8 },
  qHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },

  questionText: { fontSize: 15, fontWeight: '600', textAlign: 'right', lineHeight: 22 },
  tapHint:      { fontSize: 12, textAlign: 'right' },
  answerBox:    { borderTopWidth: 1, paddingTop: 10, gap: 4 },
  answerLabel:  { fontSize: 11, fontWeight: '700', textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.5 },
  answerText:   { fontSize: 14, textAlign: 'right', lineHeight: 20 },
  menuBtn:      { padding: 14 },

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
  input:      { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  panelBtns:  { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  cancelBtn:  { paddingHorizontal: 16, paddingVertical: 10 },
  confirmBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  actionSheet:  { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, paddingBottom: 24 },
  sheetTitle:   { fontSize: 12, fontWeight: '600', textAlign: 'center', paddingHorizontal: 24, paddingVertical: 14, letterSpacing: 0.5 },
  sheetBtn:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  sheetBtnText: { fontSize: 16, fontWeight: '600' },

  confirmPanel:  { width: '100%', borderRadius: 20, borderWidth: 1, padding: 28, alignItems: 'center', gap: 10 },
  confirmTitle:  { fontSize: 19, fontWeight: '800' },
  confirmMsg:    { fontSize: 14, textAlign: 'center' },
  confirmBtns:   { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  confirmCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  confirmDel:    { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#FF4444' },
});

export default QuizBankScreen;
