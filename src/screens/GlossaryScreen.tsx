import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadField, saveField } from '../utils/firestore';
import { useTheme } from '../context/ThemeContext';

interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  course?: string;
  createdAt: number;
}

const GlossaryScreen = () => {
  const theme = useTheme();
  const [terms,  setTerms]  = useState<GlossaryTerm[]>([]);
  const [search, setSearch] = useState('');

  // Add
  const [addModal,  setAddModal]  = useState(false);
  const [newTerm,   setNewTerm]   = useState('');
  const [newDef,    setNewDef]    = useState('');
  const [newCourse, setNewCourse] = useState('');

  // Menu
  const [menuModal,  setMenuModal]  = useState(false);
  const [menuTarget, setMenuTarget] = useState<GlossaryTerm | null>(null);

  // Edit
  const [editModal,  setEditModal]  = useState(false);
  const [editTerm,   setEditTerm]   = useState('');
  const [editDef,    setEditDef]    = useState('');
  const [editCourse, setEditCourse] = useState('');

  // Delete
  const [deleteModal, setDeleteModal] = useState(false);

  const load = useCallback(async () => {
    const data = await loadField('glossary');
    setTerms(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = (next: GlossaryTerm[]) => {
    setTerms(next);
    saveField('glossary', next);
  };

  // ── Add ──────────────────────────────────────────────────────────────────────
  const addTerm = () => {
    const t = newTerm.trim(), d = newDef.trim();
    if (!t || !d) return;
    persist([...terms, {
      id: Date.now().toString(), term: t, definition: d,
      course: newCourse.trim() || undefined, createdAt: Date.now(),
    }]);
    setNewTerm(''); setNewDef(''); setNewCourse('');
    setAddModal(false);
  };

  // ── Menu ──────────────────────────────────────────────────────────────────────
  const openMenu = (t: GlossaryTerm) => { setMenuTarget(t); setMenuModal(true); };

  const openEdit = () => {
    if (!menuTarget) return;
    setEditTerm(menuTarget.term);
    setEditDef(menuTarget.definition);
    setEditCourse(menuTarget.course ?? '');
    setMenuModal(false); setEditModal(true);
  };

  const saveEdit = () => {
    const t = editTerm.trim(), d = editDef.trim();
    if (!t || !d || !menuTarget) return;
    persist(terms.map(item =>
      item.id === menuTarget.id
        ? { ...item, term: t, definition: d, course: editCourse.trim() || undefined }
        : item,
    ));
    setEditModal(false); setMenuTarget(null);
  };

  const openDelete = () => { setMenuModal(false); setDeleteModal(true); };

  const confirmDelete = () => {
    if (!menuTarget) return;
    persist(terms.filter(t => t.id !== menuTarget.id));
    setDeleteModal(false); setMenuTarget(null);
  };

  // ── Filtered + sorted ────────────────────────────────────────────────────────
  const q = search.toLowerCase();
  const filtered = terms
    .filter(t =>
      q === '' ||
      t.term.toLowerCase().includes(q) ||
      t.definition.toLowerCase().includes(q) ||
      (t.course ?? '').toLowerCase().includes(q),
    )
    .sort((a, b) => a.term.localeCompare(b.term, 'he'));

  const accentText = theme.mode === 'dark' ? '#000' : '#fff';

  // ── Shared form fields ────────────────────────────────────────────────────────
  const FormFields = ({
    term, setTerm, def, setDef, course, setCourse, autoFocus,
  }: {
    term: string; setTerm: (v: string) => void;
    def: string;  setDef:  (v: string) => void;
    course: string; setCourse: (v: string) => void;
    autoFocus?: boolean;
  }) => (
    <>
      <TextInput
        style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
        placeholder="מונח" placeholderTextColor={theme.textSub}
        value={term} onChangeText={setTerm}
        textAlign="right" autoFocus={autoFocus}
      />
      <TextInput
        style={[s.input, s.inputMulti, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
        placeholder="הגדרה" placeholderTextColor={theme.textSub}
        value={def} onChangeText={setDef}
        multiline textAlign="right" textAlignVertical="top"
      />
      <TextInput
        style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
        placeholder="קורס (אופציונלי)" placeholderTextColor={theme.textSub}
        value={course} onChangeText={setCourse}
        textAlign="right"
      />
    </>
  );

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>

      {/* Search bar */}
      <View style={[s.searchBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={theme.textSub} />
        <TextInput
          style={[s.searchInput, { color: theme.text }]}
          placeholder="חפש מונח..." placeholderTextColor={theme.textSub}
          value={search} onChangeText={setSearch}
          textAlign="right"
        />
        {search !== '' && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialCommunityIcons name="close" size={18} color={theme.textSub} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {terms.length === 0 && (
          <View style={s.empty}>
            <MaterialCommunityIcons name="book-alphabet" size={52} color={theme.textSub + '55'} />
            <Text style={[s.emptyText, { color: theme.textSub }]}>אין מונחים עדיין</Text>
            <Text style={[s.emptyHint, { color: theme.textSub + '88' }]}>לחץ + להוספת מונח</Text>
          </View>
        )}

        {filtered.length === 0 && terms.length > 0 && (
          <View style={s.empty}>
            <MaterialCommunityIcons name="magnify" size={40} color={theme.textSub + '55'} />
            <Text style={[s.emptyText, { color: theme.textSub }]}>לא נמצאו תוצאות</Text>
          </View>
        )}

        {filtered.map(t => (
          <View key={t.id} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={s.cardMain}>
              <View style={s.cardTop}>
                <Text style={[s.termText, { color: theme.text }]}>{t.term}</Text>
                {t.course && (
                  <View style={[s.chip, { backgroundColor: theme.accent + '22' }]}>
                    <Text style={[s.chipText, { color: theme.accent }]}>{t.course}</Text>
                  </View>
                )}
              </View>
              <Text style={[s.defText, { color: theme.textSub }]}>{t.definition}</Text>
            </View>
            <TouchableOpacity onPress={() => openMenu(t)} style={s.menuBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="dots-vertical" size={20} color={theme.textSub} />
            </TouchableOpacity>
          </View>
        ))}
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
            <Text style={[s.panelTitle, { color: theme.text }]}>מונח חדש</Text>
            <FormFields term={newTerm} setTerm={setNewTerm} def={newDef} setDef={setNewDef}
              course={newCourse} setCourse={setNewCourse} autoFocus />
            <View style={s.panelBtns}>
              <TouchableOpacity onPress={() => { setAddModal(false); setNewTerm(''); setNewDef(''); setNewCourse(''); }} style={s.cancelBtn}>
                <Text style={{ color: theme.textSub, fontWeight: '600' }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addTerm} style={[s.confirmBtn, { backgroundColor: theme.accent }]}>
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
            <Text style={[s.sheetTitle, { color: theme.textSub }]} numberOfLines={1}>{menuTarget?.term}</Text>
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
            <Text style={[s.panelTitle, { color: theme.text }]}>עריכת מונח</Text>
            <FormFields term={editTerm} setTerm={setEditTerm} def={editDef} setDef={setEditDef}
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
            <Text style={[s.confirmTitle, { color: theme.text }]}>מחיקת מונח</Text>
            <Text style={[s.confirmMsg, { color: theme.textSub }]}>למחוק את "{menuTarget?.term}"?</Text>
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

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },

  empty:     { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '600' },
  emptyHint: { fontSize: 12 },

  card:     { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  cardMain: { flex: 1, padding: 14, gap: 6 },
  cardTop:  { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },
  termText: { fontSize: 16, fontWeight: '800', textAlign: 'right', flex: 1 },
  defText:  { fontSize: 13, lineHeight: 18, textAlign: 'right' },
  chip:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  chipText: { fontSize: 11, fontWeight: '600' },
  menuBtn:  { padding: 14 },

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

export default GlossaryScreen;
