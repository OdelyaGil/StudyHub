import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const MOCK_CHATS = [
  { id: 1, name: 'קבוצת אלגוריתמים', last: 'מתי ההגשה?', time: '14:30', unread: 3 },
  { id: 2, name: 'ד"ר כהן',          last: 'שאלה על בחינה', time: '11:00', unread: 1 },
  { id: 3, name: 'פרויקט סטגנוגרפיה', last: 'תראי את הקוד', time: 'אתמול', unread: 0 },
  { id: 4, name: 'חדו"א — שנה א',    last: 'מישהי פתרה 5?', time: 'אתמול', unread: 0 },
];

const ChatsScreen = () => {
  const theme = useTheme();

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      {/* Search bar */}
      <View style={[s.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <MaterialCommunityIcons name="magnify" size={18} color={theme.textSub} />
        <Text style={[s.searchPlaceholder, { color: theme.textSub }]}>חיפוש שיחה...</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>

        {/* Section label */}
        <Text style={[s.sectionLabel, { color: theme.textSub }]}>הודעות</Text>

        {MOCK_CHATS.map(chat => (
          <TouchableOpacity
            key={chat.id}
            style={[s.chatRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            activeOpacity={0.75}
          >
            {/* Avatar */}
            <View style={[s.avatar, { backgroundColor: theme.accent + '22', borderColor: theme.accent + '55' }]}>
              <Text style={[s.avatarText, { color: theme.accent }]}>
                {chat.name[0]}
              </Text>
            </View>
            {/* Content */}
            <View style={s.chatContent}>
              <View style={s.chatHeader}>
                <Text style={[s.chatTime, { color: theme.textSub }]}>{chat.time}</Text>
                <Text style={[s.chatName, { color: theme.text }]}>{chat.name}</Text>
              </View>
              <Text style={[s.chatLast, { color: theme.textSub }]} numberOfLines={1}>
                {chat.last}
              </Text>
            </View>
            {/* Unread badge */}
            {chat.unread > 0 && (
              <View style={[s.unreadBadge, { backgroundColor: theme.accent }]}>
                <Text style={s.unreadText}>{chat.unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Forums section */}
        <Text style={[s.sectionLabel, { color: theme.textSub, marginTop: 24 }]}>פורומים לקורסים</Text>

        {['חדו"א', 'אלגוריתמים', 'מבוא למדמ"ח'].map(course => (
          <TouchableOpacity
            key={course}
            style={[s.forumRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name="forum-outline" size={20} color={theme.accent} />
            <Text style={[s.forumName, { color: theme.text }]}>{course}</Text>
            <MaterialCommunityIcons name="chevron-left" size={18} color={theme.textSub} />
          </TouchableOpacity>
        ))}

        {/* Coming soon */}
        <View style={[s.comingSoon, { borderColor: theme.accent + '33' }]}>
          <MaterialCommunityIcons name="rocket-launch-outline" size={32} color={theme.accent + '66'} />
          <Text style={[s.comingSoonText, { color: theme.textSub }]}>
            תכונת השיחות בפיתוח — בקרוב!
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container:        { flex: 1 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginVertical: 12,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchPlaceholder: { fontSize: 14 },
  sectionLabel:      { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, textAlign: 'right' },
  chatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1,
    padding: 12, marginBottom: 8,
  },
  avatar:       { width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  avatarText:   { fontSize: 18, fontWeight: '700' },
  chatContent:  { flex: 1 },
  chatHeader:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  chatName:     { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  chatTime:     { fontSize: 11 },
  chatLast:     { fontSize: 12, textAlign: 'right' },
  unreadBadge:  { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  unreadText:   { color: '#000', fontSize: 10, fontWeight: '800' },
  forumRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, borderWidth: 1,
    padding: 14, marginBottom: 8,
  },
  forumName:    { flex: 1, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  comingSoon: {
    alignItems: 'center', padding: 24, marginTop: 16,
    borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', gap: 10,
  },
  comingSoonText: { fontSize: 13, textAlign: 'center' },
});

export default ChatsScreen;
