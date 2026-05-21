import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import LearningScreen from './LearningScreen';

const CATEGORIES = [
  { key: 'topics',   icon: 'brain',            label: 'נושאי לימוד' },
  { key: 'code',     icon: 'code-braces',       label: 'קטעי קוד' },
  { key: 'videos',   icon: 'play-circle-outline', label: 'סרטוני הסבר' },
  { key: 'docs',     icon: 'file-document-outline', label: 'מסמכים' },
  { key: 'steg',     icon: 'eye-off-outline',   label: 'סטגנוגרפיה' },
  { key: 'algo',     icon: 'graph-outline',     label: 'אלגוריתמים' },
];

const LibraryScreen = () => {
  const theme = useTheme();
  const [showTopics, setShowTopics] = useState(false);

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>

        <Text style={[s.pageTitle, { color: theme.text }]}>ספריית משאבים</Text>
        <Text style={[s.pageSubtitle, { color: theme.textSub }]}>כל החומרים שלך במקום אחד</Text>

        {/* Categories grid */}
        <View style={s.grid}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[s.catCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => cat.key === 'topics' ? setShowTopics(true) : null}
              activeOpacity={0.75}
            >
              <View style={[s.catIcon, { backgroundColor: theme.accent + '22' }]}>
                <MaterialCommunityIcons
                  name={cat.icon as any}
                  size={28}
                  color={theme.accent}
                />
              </View>
              <Text style={[s.catLabel, { color: theme.text }]}>{cat.label}</Text>
              {cat.key === 'topics' ? (
                <Text style={[s.catSub, { color: theme.accent }]}>פעיל</Text>
              ) : (
                <Text style={[s.catSub, { color: theme.textSub }]}>בקרוב</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick tips */}
        <View style={[s.tipCard, { backgroundColor: theme.surface, borderColor: theme.accent + '44' }]}>
          <MaterialCommunityIcons name="lightbulb-outline" size={20} color={theme.accent} />
          <Text style={[s.tipText, { color: theme.textSub }]}>
            לחצי על "נושאי לימוד" לניהול הנושאים שלך — סמני אילו ידועים ואילו צריכים חזרה.
          </Text>
        </View>
      </ScrollView>

      {/* Topics modal */}
      <Modal visible={showTopics} animationType="slide">
        <View style={{ flex: 1 }}>
          <View style={[s.modalBar, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowTopics(false)} style={s.backBtn}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.accent} />
              <Text style={[s.backText, { color: theme.accent }]}>ספריה</Text>
            </TouchableOpacity>
            <Text style={[s.modalTitle, { color: theme.text }]}>נושאי לימוד</Text>
            <View style={{ width: 80 }} />
          </View>
          <LearningScreen />
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
  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 14, borderWidth: 1,
    padding: 14,
  },
  tipText:    { flex: 1, fontSize: 12, lineHeight: 18, textAlign: 'right' },
  modalBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  backBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 80 },
  backText:   { fontSize: 14, fontWeight: '600' },
  modalTitle: { fontSize: 16, fontWeight: '700' },
});

export default LibraryScreen;
