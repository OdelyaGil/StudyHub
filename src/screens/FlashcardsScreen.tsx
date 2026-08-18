import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadField, saveField } from '../utils/firestore';
import { useTheme } from '../context/ThemeContext';

interface FlashCard {
  id: string;
  front: string;
  back: string;
}

interface FlashSet {
  id: string;
  name: string;
  cards: FlashCard[];
  createdAt: number;
}

type FlashView = 'sets' | 'set' | 'study';

const FlashcardsScreen = () => {
  const theme = useTheme();
  const [sets, setSets]               = useState<FlashSet[]>([]);
  const [currentSetId, setCurrentSetId] = useState<string | null>(null);
  const [flashView, setFlashView]     = useState<FlashView>('sets');
  const [cardIndex, setCardIndex]     = useState(0);
  const [showBack, setShowBack]       = useState(false);
  const [known, setKnown]             = useState<Set<string>>(new Set());

  // ── Set modals ──────────────────────────────────────────────────────────────
  const [addSetModal, setAddSetModal]     = useState(false);
  const [newSetName, setNewSetName]       = useState('');
  const [setMenuModal, setSetMenuModal]   = useState(false);
  const [menuTarget, setMenuTarget]       = useState<FlashSet | null>(null);
  const [renameSetModal, setRenameSetModal] = useState(false);
  const [renameSetName, setRenameSetName] = useState('');
  const [deleteSetModal, setDeleteSetModal] = useState(false);

  // ── Card modals ─────────────────────────────────────────────────────────────
  const [addCardModal, setAddCardModal]     = useState(false);
  const [cardFront, setCardFront]           = useState('');
  const [cardBack, setCardBack]             = useState('');
  const [editingCard, setEditingCard]       = useState<FlashCard | null>(null);
  const [deleteCardModal, setDeleteCardModal] = useState(false);
  const [deleteCardId, setDeleteCardId]     = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await loadField('flashcards');
    setSets(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const persistSets = (next: FlashSet[]) => {
    setSets(next);
    saveField('flashcards', next);
  };

  const currentSet = sets.find(s => s.id === currentSetId) ?? null;

  // ── Set actions ─────────────────────────────────────────────────────────────
  const createSet = () => {
    const name = newSetName.trim();
    if (!name) return;
    persistSets([...sets, { id: Date.now().toString(), name, cards: [], createdAt: Date.now() }]);
    setNewSetName('');
    setAddSetModal(false);
  };

  const openSetMenu = (set: FlashSet) => {
    setMenuTarget(set);
    setSetMenuModal(true);
  };

  const openRenameSet = () => {
    setSetMenuModal(false);
    setRenameSetName(menuTarget?.name ?? '');
    setRenameSetModal(true);
  };

  const confirmRenameSet = () => {
    const name = renameSetName.trim();
    if (!name || !menuTarget) return;
    persistSets(sets.map(s => s.id === menuTarget.id ? { ...s, name } : s));
    setRenameSetModal(false);
    setMenuTarget(null);
  };

  const openDeleteSet = () => {
    setSetMenuModal(false);
    setDeleteSetModal(true);
  };

  const confirmDeleteSet = () => {
    if (!menuTarget) return;
    persistSets(sets.filter(s => s.id !== menuTarget.id));
    if (currentSetId === menuTarget.id) { setCurrentSetId(null); setFlashView('sets'); }
    setDeleteSetModal(false);
    setMenuTarget(null);
  };

  // ── Card actions ─────────────────────────────────────────────────────────────
  const openAddCard = (card?: FlashCard) => {
    setEditingCard(card ?? null);
    setCardFront(card?.front ?? '');
    setCardBack(card?.back ?? '');
    setAddCardModal(true);
  };

  const saveCard = () => {
    if (!currentSet || !cardFront.trim() || !cardBack.trim()) return;
    const f = cardFront.trim();
    const b = cardBack.trim();
    let updatedCards: FlashCard[];
    if (editingCard) {
      updatedCards = currentSet.cards.map(c =>
        c.id === editingCard.id ? { ...c, front: f, back: b } : c,
      );
    } else {
      updatedCards = [...currentSet.cards, { id: Date.now().toString(), front: f, back: b }];
    }
    persistSets(sets.map(s => s.id === currentSetId ? { ...s, cards: updatedCards } : s));
    setAddCardModal(false);
  };

  const askDeleteCard = (cardId: string) => {
    setAddCardModal(false);
    setDeleteCardId(cardId);
    setDeleteCardModal(true);
  };

  const confirmDeleteCard = () => {
    if (!currentSet || !deleteCardId) return;
    persistSets(sets.map(s =>
      s.id === currentSetId ? { ...s, cards: s.cards.filter(c => c.id !== deleteCardId) } : s,
    ));
    setDeleteCardModal(false);
    setDeleteCardId(null);
  };

  // ── Study ────────────────────────────────────────────────────────────────────
  const startStudy = () => {
    setCardIndex(0);
    setShowBack(false);
    setKnown(new Set());
    setFlashView('study');
  };

  const nextCard = (didKnow: boolean) => {
    if (!currentSet) return;
    const newKnown = new Set(known);
    if (didKnow) newKnown.add(currentSet.cards[cardIndex].id);
    setKnown(newKnown);
    if (cardIndex < currentSet.cards.length - 1) {
      setCardIndex(i => i + 1);
      setShowBack(false);
    } else {
      setKnown(newKnown);
      setCardIndex(currentSet.cards.length);
    }
  };

  // ── Shared modals (rendered in every view) ───────────────────────────────────
  const sharedModals = (
    <>
      {/* Create set */}
      <Modal visible={addSetModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.panelTitle, { color: theme.text }]}>סט חדש</Text>
            <TextInput
              style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="שם הסט (למשל: חדו״א)"
              placeholderTextColor={theme.textSub}
              value={newSetName}
              onChangeText={setNewSetName}
              textAlign="right"
              autoFocus
              onSubmitEditing={createSet}
            />
            <View style={s.panelBtns}>
              <TouchableOpacity onPress={() => { setAddSetModal(false); setNewSetName(''); }} style={s.cancelBtn}>
                <Text style={{ color: theme.textSub, fontWeight: '600' }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={createSet} style={[s.confirmBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: theme.mode === 'dark' ? '#000' : '#fff', fontWeight: '700' }}>צור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Set action menu */}
      <Modal visible={setMenuModal} transparent animationType="fade">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setSetMenuModal(false)}>
          <View style={[s.actionSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.actionSheetTitle, { color: theme.textSub }]} numberOfLines={1}>
              {menuTarget?.name}
            </Text>
            <TouchableOpacity style={[s.actionBtn, { borderBottomColor: theme.border }]} onPress={openRenameSet}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.accent} />
              <Text style={[s.actionBtnText, { color: theme.text }]}>שנה שם</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={openDeleteSet}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FF4444" />
              <Text style={[s.actionBtnText, { color: '#FF4444' }]}>מחק סט</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Rename set */}
      <Modal visible={renameSetModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.panelTitle, { color: theme.text }]}>שנה שם סט</Text>
            <TextInput
              style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="שם חדש"
              placeholderTextColor={theme.textSub}
              value={renameSetName}
              onChangeText={setRenameSetName}
              textAlign="right"
              autoFocus
              onSubmitEditing={confirmRenameSet}
            />
            <View style={s.panelBtns}>
              <TouchableOpacity onPress={() => setRenameSetModal(false)} style={s.cancelBtn}>
                <Text style={{ color: theme.textSub, fontWeight: '600' }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmRenameSet} style={[s.confirmBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: theme.mode === 'dark' ? '#000' : '#fff', fontWeight: '700' }}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete set confirm */}
      <Modal visible={deleteSetModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.confirmPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="trash-can-outline" size={36} color="#FF4444" />
            <Text style={[s.confirmTitle, { color: theme.text }]}>מחיקת סט</Text>
            <Text style={[s.confirmMsg, { color: theme.textSub }]}>
              למחוק את "{menuTarget?.name}" וכל הכרטיסיות שלו?
            </Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={[s.confirmCancel, { borderColor: theme.border }]} onPress={() => setDeleteSetModal(false)}>
                <Text style={{ color: theme.textSub, fontWeight: '600', fontSize: 15 }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmDelete} onPress={confirmDeleteSet}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>מחק</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete card confirm */}
      <Modal visible={deleteCardModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.confirmPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="trash-can-outline" size={36} color="#FF4444" />
            <Text style={[s.confirmTitle, { color: theme.text }]}>מחיקת כרטיסייה</Text>
            <Text style={[s.confirmMsg, { color: theme.textSub }]}>למחוק את הכרטיסייה לצמיתות?</Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={[s.confirmCancel, { borderColor: theme.border }]} onPress={() => setDeleteCardModal(false)}>
                <Text style={{ color: theme.textSub, fontWeight: '600', fontSize: 15 }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmDelete} onPress={confirmDeleteCard}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>מחק</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );

  // ── Sets list ────────────────────────────────────────────────────────────────
  if (flashView === 'sets') return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {sets.length === 0 && (
          <View style={s.empty}>
            <MaterialCommunityIcons name="cards-outline" size={52} color={theme.textSub + '55'} />
            <Text style={[s.emptyText, { color: theme.textSub }]}>אין סטים עדיין</Text>
            <Text style={[s.emptyHint, { color: theme.textSub + '88' }]}>לחץ/י + ליצירת סט ראשון</Text>
          </View>
        )}
        {sets.map(set => (
          <View
            key={set.id}
            style={[s.setCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <TouchableOpacity
              style={s.setCardMain}
              onPress={() => { setCurrentSetId(set.id); setFlashView('set'); }}
              activeOpacity={0.75}
            >
              <View style={[s.setIcon, { backgroundColor: theme.accent + '22' }]}>
                <MaterialCommunityIcons name="cards" size={26} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.setName, { color: theme.text }]}>{set.name}</Text>
                <Text style={[s.setCount, { color: theme.textSub }]}>{set.cards.length} כרטיסיות</Text>
              </View>
              <MaterialCommunityIcons name="chevron-left" size={20} color={theme.textSub} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openSetMenu(set)} style={s.menuBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="dots-vertical" size={20} color={theme.textSub} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      <TouchableOpacity style={[s.fab, { backgroundColor: theme.accent }]} onPress={() => setAddSetModal(true)} activeOpacity={0.85}>
        <MaterialCommunityIcons name="plus" size={28} color={theme.mode === 'dark' ? '#000' : '#fff'} />
      </TouchableOpacity>
      {sharedModals}
    </View>
  );

  // ── Set detail ───────────────────────────────────────────────────────────────
  if (flashView === 'set' && currentSet) return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <View style={[s.innerBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => setFlashView('sets')} style={s.backRow}>
          <MaterialCommunityIcons name="chevron-right" size={22} color={theme.accent} />
          <Text style={[s.backText, { color: theme.accent }]}>סטים</Text>
        </TouchableOpacity>
        <Text style={[s.innerTitle, { color: theme.text }]} numberOfLines={1}>{currentSet.name}</Text>
        <View style={s.innerBarRight}>
          <TouchableOpacity onPress={() => openSetMenu(currentSet)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="dots-vertical" size={22} color={theme.textSub} />
          </TouchableOpacity>
          {currentSet.cards.length > 0 && (
            <TouchableOpacity onPress={startStudy} style={[s.studyStartBtn, { backgroundColor: theme.accent }]}>
              <Text style={{ color: theme.mode === 'dark' ? '#000' : '#fff', fontWeight: '700', fontSize: 13 }}>לימוד</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {currentSet.cards.length === 0 && (
          <View style={s.empty}>
            <MaterialCommunityIcons name="card-plus-outline" size={48} color={theme.textSub + '55'} />
            <Text style={[s.emptyText, { color: theme.textSub }]}>הוסף כרטיסיות לסט</Text>
          </View>
        )}
        {currentSet.cards.map((card, i) => (
          <View
            key={card.id}
            style={[s.cardItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={[s.cardNum, { color: theme.textSub }]}>{i + 1}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[s.cardFrontText, { color: theme.text }]}>{card.front}</Text>
              <Text style={[s.cardBackText, { color: theme.textSub }]}>{card.back}</Text>
            </View>
            <View style={s.cardActions}>
              <TouchableOpacity onPress={() => openAddCard(card)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.textSub} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setDeleteCardId(card.id); setDeleteCardModal(true); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <MaterialCommunityIcons name="trash-can-outline" size={18} color="#FF4444" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={[s.fab, { backgroundColor: theme.accent }]} onPress={() => openAddCard()} activeOpacity={0.85}>
        <MaterialCommunityIcons name="plus" size={28} color={theme.mode === 'dark' ? '#000' : '#fff'} />
      </TouchableOpacity>

      {/* Add / edit card modal */}
      <Modal visible={addCardModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={s.cardModalHeader}>
              <Text style={[s.panelTitle, { color: theme.text }]}>{editingCard ? 'עריכת כרטיסייה' : 'כרטיסייה חדשה'}</Text>
              {editingCard && (
                <TouchableOpacity onPress={() => askDeleteCard(editingCard.id)}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FF4444" />
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="שאלה (צד קדמי)"
              placeholderTextColor={theme.textSub}
              value={cardFront}
              onChangeText={setCardFront}
              textAlign="right"
              multiline
              autoFocus
            />
            <TextInput
              style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="תשובה (צד אחורי)"
              placeholderTextColor={theme.textSub}
              value={cardBack}
              onChangeText={setCardBack}
              textAlign="right"
              multiline
            />
            <View style={s.panelBtns}>
              <TouchableOpacity onPress={() => setAddCardModal(false)} style={s.cancelBtn}>
                <Text style={{ color: theme.textSub, fontWeight: '600' }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveCard} style={[s.confirmBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: theme.mode === 'dark' ? '#000' : '#fff', fontWeight: '700' }}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {sharedModals}
    </View>
  );

  // ── Study mode ───────────────────────────────────────────────────────────────
  if (flashView === 'study' && currentSet) {
    const isDone = cardIndex >= currentSet.cards.length;

    if (isDone) {
      const total = currentSet.cards.length;
      const knownCount = known.size;
      return (
        <View style={[s.container, s.centeredView, { backgroundColor: theme.bg }]}>
          <View style={[s.resultsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MaterialCommunityIcons
              name={knownCount === total ? 'trophy-outline' : 'chart-bar'}
              size={56} color={theme.accent}
            />
            <Text style={[s.resultsTitle, { color: theme.text }]}>סיימת!</Text>
            <Text style={[s.resultsScore, { color: theme.accent }]}>{knownCount}/{total} ידעת</Text>
            {knownCount < total && (
              <Text style={[s.resultsHint, { color: theme.textSub }]}>
                {total - knownCount} כרטיסיות לחזרה נוספת
              </Text>
            )}
            <TouchableOpacity onPress={startStudy} style={[s.resultsBtn, { backgroundColor: theme.accent }]}>
              <Text style={{ color: theme.mode === 'dark' ? '#000' : '#fff', fontWeight: '700', fontSize: 15 }}>שוב</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFlashView('set')} style={{ marginTop: 4 }}>
              <Text style={{ color: theme.textSub, fontSize: 14 }}>חזור לסט</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const card = currentSet.cards[cardIndex];
    return (
      <View style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={[s.innerBar, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => setFlashView('set')} style={s.backRow}>
            <MaterialCommunityIcons name="chevron-right" size={22} color={theme.accent} />
            <Text style={[s.backText, { color: theme.accent }]}>{currentSet.name}</Text>
          </TouchableOpacity>
          <Text style={[s.innerTitle, { color: theme.textSub }]}>
            {cardIndex + 1} / {currentSet.cards.length}
          </Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={[s.progressOuter, { backgroundColor: theme.border }]}>
          <View style={[s.progressInner, {
            backgroundColor: theme.accent,
            width: `${(cardIndex / currentSet.cards.length) * 100}%` as any,
          }]} />
        </View>

        <View style={s.centeredView}>
          <TouchableOpacity
            style={[s.studyCard, { backgroundColor: theme.surface, borderColor: showBack ? theme.accent + '99' : theme.border }]}
            onPress={() => setShowBack(v => !v)}
            activeOpacity={0.9}
          >
            <Text style={[s.studyCardLabel, { color: theme.textSub }]}>
              {showBack ? 'תשובה' : 'שאלה'}
            </Text>
            <Text style={[s.studyCardText, { color: theme.text }]}>
              {showBack ? card.back : card.front}
            </Text>
            {!showBack && (
              <Text style={[s.tapHint, { color: theme.textSub + '88' }]}>לחץ/י להצגת התשובה</Text>
            )}
          </TouchableOpacity>

          {showBack && (
            <View style={s.studyActionBtns}>
              <TouchableOpacity
                style={[s.studyActionBtn, { backgroundColor: '#FF4444' + '18', borderColor: '#FF4444' + '66' }]}
                onPress={() => nextCard(false)}
              >
                <MaterialCommunityIcons name="close" size={22} color="#FF4444" />
                <Text style={{ color: '#FF4444', fontWeight: '700', fontSize: 14 }}>לא ידעתי</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.studyActionBtn, { backgroundColor: '#22CC66' + '18', borderColor: '#22CC66' + '66' }]}
                onPress={() => nextCard(true)}
              >
                <MaterialCommunityIcons name="check" size={22} color="#22CC66" />
                <Text style={{ color: '#22CC66', fontWeight: '700', fontSize: 14 }}>ידעתי!</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }

  return null;
};

const s = StyleSheet.create({
  container:    { flex: 1 },
  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 20 },
  empty:        { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText:    { fontSize: 15, fontWeight: '600' },
  emptyHint:    { fontSize: 12 },

  setCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, marginBottom: 10,
    overflow: 'hidden',
  },
  setCardMain: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, padding: 14 },
  menuBtn:     { padding: 14 },
  setIcon:     { width: 46, height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  setName:     { fontSize: 15, fontWeight: '700', textAlign: 'right' },
  setCount:    { fontSize: 12, textAlign: 'right', marginTop: 2 },

  cardItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8,
  },
  cardNum:       { fontSize: 13, fontWeight: '700', minWidth: 22, textAlign: 'center' },
  cardFrontText: { fontSize: 14, fontWeight: '600', textAlign: 'right' },
  cardBackText:  { fontSize: 13, textAlign: 'right', marginTop: 2 },
  cardActions:   { flexDirection: 'row', gap: 14, alignItems: 'center' },

  cardModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  innerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  innerBarRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backRow:        { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 60 },
  backText:       { fontSize: 14, fontWeight: '600' },
  innerTitle:     { fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  studyStartBtn:  { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },

  progressOuter: { height: 3 },
  progressInner: { height: 3 },

  studyCard: {
    width: '100%', minHeight: 220, borderRadius: 20, borderWidth: 1.5,
    padding: 28, alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  studyCardLabel:  { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  studyCardText:   { fontSize: 20, fontWeight: '700', textAlign: 'center', lineHeight: 30 },
  tapHint:         { fontSize: 12, marginTop: 12 },
  studyActionBtns: { flexDirection: 'row', gap: 14, width: '100%' },
  studyActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 14, borderWidth: 1,
  },

  resultsCard:  { alignItems: 'center', padding: 32, borderRadius: 20, borderWidth: 1, gap: 10, width: '100%' },
  resultsTitle: { fontSize: 24, fontWeight: '800' },
  resultsScore: { fontSize: 36, fontWeight: '800' },
  resultsHint:  { fontSize: 13, textAlign: 'center' },
  resultsBtn:   { paddingHorizontal: 36, paddingVertical: 14, borderRadius: 14, marginTop: 8 },

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
  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16,
  },
  panelBtns:  { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  cancelBtn:  { paddingHorizontal: 16, paddingVertical: 10 },
  confirmBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },

  actionSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1,
    paddingBottom: 24,
  },
  actionSheetTitle: {
    fontSize: 12, fontWeight: '600', textAlign: 'center',
    paddingVertical: 14, letterSpacing: 0.5,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1,
  },
  actionBtnText: { fontSize: 16, fontWeight: '600' },

  confirmPanel: {
    width: '100%', borderRadius: 20, borderWidth: 1,
    padding: 28, alignItems: 'center', gap: 10,
  },
  confirmTitle: { fontSize: 19, fontWeight: '800' },
  confirmMsg:   { fontSize: 14, textAlign: 'center' },
  confirmBtns:  { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  confirmCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center',
  },
  confirmDelete: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#FF4444',
  },
});

export default FlashcardsScreen;
