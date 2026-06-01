import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadField, saveField } from '../utils/firestore';
import { useTheme } from '../context/ThemeContext';

interface Question {
  id: string;
  question: string;
  answer: string;
  course?: string;
  createdAt: number;
}

const QuizBankScreen = () => {
  const theme = useTheme();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [revealed,  setRevealed]  = useState<Set<string>>(new Set());

  // Add
  const [addModal,  setAddModal]  = useState(false);
  const [newQ,      setNewQ]      = useState('');
  const [newA,      setNewA]      = useState('');
  const [newCourse, setNewCourse] = useState('');

  // Menu
  const [menuModal,  setMenuModal]  = useState(false);
  const [menuTarget, setMenuTarget] = useState<Question | null>(null);

  // Edit
  const [editModal,  setEditModal]  = useState(false);
  const [editQ,      setEditQ]      = useState('');
  const [editA,      setEditA]      = useState('');
  const [editCourse, setEditCourse] = useState('');

  // Delete
  const [deleteModal, setDeleteModal] = useState(false);

  const load = useCallback(async () => {
    const data = await loadField('quizBank');
    setQuestions(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = (next: Question[]) => {
    setQuestions(next);
    saveField('quizBank', next);
  };

  const toggleReveal = (id: string) => {
    setRevealed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Add ──────────────────────────────────────────────────────────────────────
  const addQuestion = () => {
    const q = newQ.trim(), a = newA.trim();
    if (!q || !a) return;
    persist([...questions, {
      id: Date.now().toString(), question: q, answer: a,
      course: newCourse.trim() || undefined, createdAt: Date.now(),
    }]);
    setNewQ(''); setNewA(''); setNewCourse('');
    setAddModal(false);
  };

  // ── Menu ──────────────────────────────────────────────────────────────────────
  const openMenu = (q: Question) => { setMenuTarget(q); setMenuModal(true); };

  const openEdit = () => {
    if (!menuTarget) return;
    setEditQ(menuTarget.question);
    setEditA(menuTarget.answer);
    setEditCourse(menuTarget.course ?? '');
    setMenuModal(false); setEditModal(true);
  };

  const saveEdit = () => {
    const q = editQ.trim(), a = editA.trim();
    if (!q || !a || !menuTarget) return;
    persist(questions.map(item =>
      item.id === menuTarget.id
        ? { ...item, question: q, answer: a, course: editCourse.trim() || undefined }
        : item,
    ));
    setEditModal(false); setMenuTarget(null);
  };

  const openDelete = () => { setMenuModal(false); setDeleteModal(true); };

  const confirmDelete = () => {
    if (!menuTarget) return;
    persist(questions.filter(q => q.id !== menuTarget.id));
    setDeleteModal(false); setMenuTarget(null);
  };

  const accentText = theme.mode === 'dark' ? '#000' : '#fff';

  // ── Shared form fields ────────────────────────────────────────────────────────
  const FormFields = ({
    q, setQ, a, setA, course, setCourse, autoFocus,
  }: {
    q: string; setQ: (v: string) => void;
    a: string; setA: (v: string) => void;
    course: string; setCourse: (v: string) => void;
    autoFocus?: boolean;
  }) => (
    <>
      <TextInput
        style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
        placeholder="קורס (אופציונלי)" placeholderTextColor={theme.textSub}
        value={course} onChangeText={setCourse} textAlign="right"
      />
      <TextInput
        style={[s.input, s.inputMulti, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
        placeholder="שאלה" placeholderTextColor={theme.textSub}
        value={q} onChangeText={setQ}
        multiline textAlign="right" textAlignVertical="top"
        autoFocus={autoFocus}
      />
      <TextInput
        style={[s.input, s.inputMulti, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
        placeholder="תשובה" placeholderTextColor={theme.textSub}
        value={a} onChangeText={setA}
        multiline textAlign="right" textAlignVertical="top"
      />
    </>
  );

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {questions.length === 0 && (
          <View style={s.empty}>
            <MaterialCommunityIcons name="help-circle-outline" size={52} color={theme.textSub + '55'} />
            <Text style={[s.emptyText, { color: theme.textSub }]}>אין שאלות עדיין</Text>
            <Text style={[s.emptyHint, { color: theme.textSub + '88' }]}>לחץ + להוספת שאלה</Text>
          </View>
        )}

        {questions.map(q => {
          const isRevealed = revealed.has(q.id);
          return (
            <View key={q.id} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <TouchableOpacity style={s.cardBody} onPress={() => toggleReveal(q.id)} activeOpacity={0.75}>
                {/* Header row */}
                <View style={s.qHeader}>
                  {q.course && (
                    <View style={[s.chip, { backgroundColor: theme.accent + '22' }]}>
                      <Text style={[s.chipText, { color: theme.accent }]}>{q.course}</Text>
                    </View>
                  )}
                  <MaterialCommunityIcons
                    name={isRevealed ? 'chevron-up' : 'chevron-down'}
                    size={18} color={theme.accent}
                  />
                </View>

                <Text style={[s.questionText, { color: theme.text }]}>{q.question}</Text>

                {isRevealed ? (
                  <View style={[s.answerBox, { borderTopColor: theme.border, backgroundColor: theme.accent + '11' }]}>
                    <Text style={[s.answerLabel, { color: theme.accent }]}>תשובה</Text>
                    <Text style={[s.answerText, { color: theme.text }]}>{q.answer}</Text>
                  </View>
                ) : (
                  <Text style={[s.tapHint, { color: theme.textSub }]}>לחץ לגילוי התשובה</Text>
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
        onPress={() => setAddModal(true)} activeOpacity={0.85}>
        <MaterialCommunityIcons name="plus" size={28} color={accentText} />
      </TouchableOpacity>

      {/* ── Add ── */}
      <Modal visible={addModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.panelTitle, { color: theme.text }]}>שאלה חדשה</Text>
            <FormFields q={newQ} setQ={setNewQ} a={newA} setA={setNewA}
              course={newCourse} setCourse={setNewCourse} autoFocus />
            <View style={s.panelBtns}>
              <TouchableOpacity onPress={() => { setAddModal(false); setNewQ(''); setNewA(''); setNewCourse(''); }} style={s.cancelBtn}>
                <Text style={{ color: theme.textSub, fontWeight: '600' }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addQuestion} style={[s.confirmBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: accentText, fontWeight: '700' }}>הוסף</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Action sheet ── */}
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

      {/* ── Edit ── */}
      <Modal visible={editModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.panelTitle, { color: theme.text }]}>עריכת שאלה</Text>
            <FormFields q={editQ} setQ={setEditQ} a={editA} setA={setEditA}
              course={editCourse} setCourse={setEditCourse} autoFocus />
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

      {/* ── Delete confirm ── */}
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
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  empty:     { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '600' },
  emptyHint: { fontSize: 12 },

  card:    { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  cardBody:{ flex: 1, padding: 14, gap: 8 },
  qHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
  chip:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  chipText:{ fontSize: 11, fontWeight: '600' },

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

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  panel:      { width: '100%', borderRadius: 18, borderWidth: 1, padding: 24, gap: 14 },
  panelTitle: { fontSize: 18, fontWeight: '700', textAlign: 'right' },
  input:      { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
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
