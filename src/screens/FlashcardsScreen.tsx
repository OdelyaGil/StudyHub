import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert,
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
  const [addSetModal, setAddSetModal] = useState(false);
  const [newSetName, setNewSetName]   = useState('');
  const [addCardModal, setAddCardModal] = useState(false);
  const [cardFront, setCardFront]     = useState('');
  const [cardBack, setCardBack]       = useState('');
  const [editingCard, setEditingCard] = useState<FlashCard | null>(null);

  const load = useCallback(async () => {
    const data = await loadField('flashcards');
    setSets(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = async (next: FlashSet[]) => {
    setSets(next);
    await saveField('flashcards', next);
  };

  const currentSet = sets.find(s => s.id === currentSetId) ?? null;

  const createSet = async () => {
    const name = newSetName.trim();
    if (!name) return;
    const newSet: FlashSet = { id: Date.now().toString(), name, cards: [], createdAt: Date.now() };
    await persist([...sets, newSet]);
    setNewSetName('');
    setAddSetModal(false);
  };

  const deleteSet = (id: string) => {
    Alert.alert('מחיקה', 'למחוק את הסט?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק', style: 'destructive',
        onPress: async () => {
          await persist(sets.filter(s => s.id !== id));
          if (currentSetId === id) { setCurrentSetId(null); setFlashView('sets'); }
        },
      },
    ]);
  };

  const openAddCard = (card?: FlashCard) => {
    setEditingCard(card ?? null);
    setCardFront(card?.front ?? '');
    setCardBack(card?.back ?? '');
    setAddCardModal(true);
  };

  const saveCard = async () => {
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
    await persist(sets.map(s => s.id === currentSetId ? { ...s, cards: updatedCards } : s));
    setAddCardModal(false);
  };

  const deleteCard = (cardId: string) => {
    if (!currentSet) return;
    Alert.alert('מחיקה', 'למחוק את הכרטיסייה?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק', style: 'destructive',
        onPress: async () => {
          await persist(sets.map(s =>
            s.id === currentSetId ? { ...s, cards: s.cards.filter(c => c.id !== cardId) } : s,
          ));
        },
      },
    ]);
  };

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

  // Add set modal shared between views
  const addSetModalEl = (
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
  );

  // ── Sets list ──────────────────────────────────────────────────────────────
  if (flashView === 'sets') return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {sets.length === 0 && (
          <View style={s.empty}>
            <MaterialCommunityIcons name="cards-outline" size={52} color={theme.textSub + '55'} />
            <Text style={[s.emptyText, { color: theme.textSub }]}>אין סטים עדיין</Text>
            <Text style={[s.emptyHint, { color: theme.textSub + '88' }]}>לחץ + ליצירת סט ראשון</Text>
          </View>
        )}
        {sets.map(set => (
          <TouchableOpacity
            key={set.id}
            style={[s.setCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => { setCurrentSetId(set.id); setFlashView('set'); }}
            onLongPress={() => deleteSet(set.id)}
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
        ))}
      </ScrollView>
      <TouchableOpacity style={[s.fab, { backgroundColor: theme.accent }]} onPress={() => setAddSetModal(true)} activeOpacity={0.85}>
        <MaterialCommunityIcons name="plus" size={28} color={theme.mode === 'dark' ? '#000' : '#fff'} />
      </TouchableOpacity>
      {addSetModalEl}
    </View>
  );

  // ── Set detail ─────────────────────────────────────────────────────────────
  if (flashView === 'set' && currentSet) return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <View style={[s.innerBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => setFlashView('sets')} style={s.backRow}>
          <MaterialCommunityIcons name="chevron-right" size={22} color={theme.accent} />
          <Text style={[s.backText, { color: theme.accent }]}>סטים</Text>
        </TouchableOpacity>
        <Text style={[s.innerTitle, { color: theme.text }]} numberOfLines={1}>{currentSet.name}</Text>
        {currentSet.cards.length > 0 ? (
          <TouchableOpacity onPress={startStudy} style={[s.studyStartBtn, { backgroundColor: theme.accent }]}>
            <Text style={{ color: theme.mode === 'dark' ? '#000' : '#fff', fontWeight: '700', fontSize: 13 }}>לימוד</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 60 }} />}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {currentSet.cards.length === 0 && (
          <View style={s.empty}>
            <MaterialCommunityIcons name="card-plus-outline" size={48} color={theme.textSub + '55'} />
            <Text style={[s.emptyText, { color: theme.textSub }]}>הוסף כרטיסיות לסט</Text>
          </View>
        )}
        {currentSet.cards.map((card, i) => (
          <TouchableOpacity
            key={card.id}
            style={[s.cardItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => openAddCard(card)}
            onLongPress={() => deleteCard(card.id)}
            activeOpacity={0.75}
          >
            <Text style={[s.cardNum, { color: theme.textSub }]}>{i + 1}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[s.cardFrontText, { color: theme.text }]}>{card.front}</Text>
              <Text style={[s.cardBackText, { color: theme.textSub }]}>{card.back}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={[s.fab, { backgroundColor: theme.accent }]} onPress={() => openAddCard()} activeOpacity={0.85}>
        <MaterialCommunityIcons name="plus" size={28} color={theme.mode === 'dark' ? '#000' : '#fff'} />
      </TouchableOpacity>

      <Modal visible={addCardModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.panelTitle, { color: theme.text }]}>{editingCard ? 'עריכת כרטיסייה' : 'כרטיסייה חדשה'}</Text>
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
    </View>
  );

  // ── Study mode ─────────────────────────────────────────────────────────────
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
              size={56}
              color={theme.accent}
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
              <Text style={[s.tapHint, { color: theme.textSub + '88' }]}>לחץ להצגת התשובה</Text>
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
  container:   { flex: 1 },
  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 20 },
  empty:       { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText:   { fontSize: 15, fontWeight: '600' },
  emptyHint:   { fontSize: 12 },

  setCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10,
  },
  setIcon:  { width: 46, height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  setName:  { fontSize: 15, fontWeight: '700', textAlign: 'right' },
  setCount: { fontSize: 12, textAlign: 'right', marginTop: 2 },

  cardItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8,
  },
  cardNum:       { fontSize: 13, fontWeight: '700', marginTop: 2, minWidth: 22, textAlign: 'center' },
  cardFrontText: { fontSize: 14, fontWeight: '600', textAlign: 'right' },
  cardBackText:  { fontSize: 13, textAlign: 'right', marginTop: 2 },

  innerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  backRow:       { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 60 },
  backText:      { fontSize: 14, fontWeight: '600' },
  innerTitle:    { fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  studyStartBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },

  progressOuter: { height: 3 },
  progressInner: { height: 3 },

  studyCard: {
    width: '100%', minHeight: 220,
    borderRadius: 20, borderWidth: 1.5,
    padding: 28, alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  studyCardLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  studyCardText:  { fontSize: 20, fontWeight: '700', textAlign: 'center', lineHeight: 30 },
  tapHint:        { fontSize: 12, marginTop: 12 },

  studyActionBtns: { flexDirection: 'row', gap: 14, width: '100%' },
  studyActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 14, borderWidth: 1,
  },

  resultsCard: {
    alignItems: 'center', padding: 32, borderRadius: 20, borderWidth: 1, gap: 10, width: '100%',
  },
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

export default FlashcardsScreen;
