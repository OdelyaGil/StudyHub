import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import LearningScreen   from './LearningScreen';
import FlashcardsScreen from './FlashcardsScreen';
import LinksScreen      from './LinksScreen';
import SummariesScreen  from './SummariesScreen';
import QuizBankScreen   from './QuizBankScreen';
import GlossaryScreen   from './GlossaryScreen';

const CATEGORIES = [
  { key: 'topics',     icon: 'brain',              label: 'נושאי לימוד',      active: true  },
  { key: 'quizbank',   icon: 'help-circle-outline', label: 'בנק שאלות',        active: true  },
  { key: 'glossary',   icon: 'book-alphabet',       label: 'מילון מונחים',     active: true  },
  { key: 'summaries',  icon: 'note-text-outline',   label: 'סיכומים',          active: true  },
  { key: 'flashcards', icon: 'cards-outline',       label: 'כרטיסיות',         active: true  },
  { key: 'links',      icon: 'link-variant',        label: 'קישורים שימושיים', active: true  },
];

type ActiveModal = 'topics' | 'summaries' | 'flashcards' | 'links' | 'quizbank' | 'glossary' | null;

const MODAL_TITLE: Record<string, string> = {
  topics:     'נושאי לימוד',
  summaries:  'סיכומים',
  flashcards: 'כרטיסיות',
  links:      'קישורים שימושיים',
  quizbank:   'בנק שאלות',
  glossary:   'מילון מונחים',
};

const ACTIVE_KEYS: ActiveModal[] = ['topics', 'summaries', 'flashcards', 'links', 'quizbank', 'glossary'];

const LibraryScreen = () => {
  const theme = useTheme();
  const [modal, setModal] = useState<ActiveModal>(null);

  const openModal = (key: string) => {
    if ((ACTIVE_KEYS as string[]).includes(key)) setModal(key as ActiveModal);
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>

        <Text style={[s.pageTitle,    { color: theme.text }]}>ספריית משאבים</Text>
        <Text style={[s.pageSubtitle, { color: theme.textSub }]}>כל החומרים שלך במקום אחד</Text>

        <View style={s.grid}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[s.catCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => openModal(cat.key)}
              activeOpacity={0.75}
            >
              <View style={[s.catIcon, { backgroundColor: theme.accent + '22' }]}>
                <MaterialCommunityIcons name={cat.icon as any} size={28} color={theme.accent} />
              </View>
              <Text style={[s.catLabel, { color: theme.text }]}>{cat.label}</Text>
              <Text style={[s.catSub, { color: theme.accent }]}>פעיל</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>

      {/* Full-screen modal shared by all categories */}
      <Modal visible={modal !== null} animationType="slide">
        <View style={{ flex: 1 }}>
          <View style={[s.modalBar, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setModal(null)} style={s.backBtn}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.accent} />
              <Text style={[s.backText, { color: theme.accent }]}>ספריה</Text>
            </TouchableOpacity>
            <Text style={[s.modalTitle, { color: theme.text }]}>
              {modal ? MODAL_TITLE[modal] : ''}
            </Text>
            <View style={{ width: 80 }} />
          </View>

          {modal === 'topics'     && <LearningScreen />}
          {modal === 'flashcards' && <FlashcardsScreen />}
          {modal === 'links'      && <LinksScreen />}
          {modal === 'summaries'  && <SummariesScreen />}
          {modal === 'quizbank'   && <QuizBankScreen />}
          {modal === 'glossary'   && <GlossaryScreen />}
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  container:    { flex: 1 },
  pageTitle:    { fontSize: 22, fontWeight: '800', textAlign: 'right', marginBottom: 4 },
  pageSubtitle: { fontSize: 13, textAlign: 'right', marginBottom: 20 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  catCard: {
    width: '47%', borderRadius: 16, padding: 16,
    borderWidth: 1, alignItems: 'center', gap: 8,
  },
  catIcon:  { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  catLabel: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  catSub:   { fontSize: 10, fontWeight: '600' },
  modalBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  backBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 80 },
  backText:   { fontSize: 14, fontWeight: '600' },
  modalTitle: { fontSize: 16, fontWeight: '700' },
});

export default LibraryScreen;
