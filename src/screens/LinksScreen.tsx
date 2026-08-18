import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadField, saveField } from '../utils/firestore';
import { useTheme } from '../context/ThemeContext';

interface SavedLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  createdAt: number;
}

const getDomain = (u: string) => {
  try { return new URL(u).hostname; } catch { return u; }
};

const LinksScreen = () => {
  const theme = useTheme();
  const [links, setLinks]         = useState<SavedLink[]>([]);
  const [addModal, setAddModal]   = useState(false);
  const [title, setTitle]         = useState('');
  const [url, setUrl]             = useState('');
  const [desc, setDesc]           = useState('');

  // Menu + edit + delete
  const [menuModal, setMenuModal]     = useState(false);
  const [menuTarget, setMenuTarget]   = useState<SavedLink | null>(null);
  const [editModal, setEditModal]     = useState(false);
  const [editTitle, setEditTitle]     = useState('');
  const [editUrl, setEditUrl]         = useState('');
  const [editDesc, setEditDesc]       = useState('');
  const [deleteModal, setDeleteModal] = useState(false);

  const load = useCallback(async () => {
    const data = await loadField('links');
    setLinks(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = (next: SavedLink[]) => {
    setLinks(next);
    saveField('links', next);
  };

  // ── Add ────────────────────────────────────────────────────────────────────
  const closeAdd = () => {
    setAddModal(false);
    setTitle(''); setUrl(''); setDesc('');
  };

  const addLink = () => {
    const t = title.trim();
    const u = url.trim();
    if (!t || !u) return;
    persist([...links, {
      id: Date.now().toString(),
      title: t,
      url: u.startsWith('http') ? u : 'https://' + u,
      description: desc.trim() || undefined,
      createdAt: Date.now(),
    }]);
    closeAdd();
  };

  // ── Menu ───────────────────────────────────────────────────────────────────
  const openMenu = (link: SavedLink) => {
    setMenuTarget(link);
    setMenuModal(true);
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const openEdit = () => {
    if (!menuTarget) return;
    setEditTitle(menuTarget.title);
    setEditUrl(menuTarget.url);
    setEditDesc(menuTarget.description ?? '');
    setMenuModal(false);
    setEditModal(true);
  };

  const saveEdit = () => {
    const t = editTitle.trim();
    const u = editUrl.trim();
    if (!t || !u || !menuTarget) return;
    persist(links.map(l => l.id === menuTarget.id ? {
      ...l,
      title: t,
      url: u.startsWith('http') ? u : 'https://' + u,
      description: editDesc.trim() || undefined,
    } : l));
    setEditModal(false);
    setMenuTarget(null);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const openDeleteConfirm = () => {
    setMenuModal(false);
    setDeleteModal(true);
  };

  const confirmDelete = () => {
    if (!menuTarget) return;
    persist(links.filter(l => l.id !== menuTarget.id));
    setDeleteModal(false);
    setMenuTarget(null);
  };

  const openLink = (u: string) => {
    Linking.openURL(u).catch(() => {});
  };

  // ── Shared input modal rows ─────────────────────────────────────────────────
  const inputFields = (t: string, setT: (v: string) => void, u: string, setU: (v: string) => void, d: string, setD: (v: string) => void) => (
    <>
      <TextInput
        style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
        placeholder="כותרת"
        placeholderTextColor={theme.textSub}
        value={t}
        onChangeText={setT}
        textAlign="right"
        autoFocus
      />
      <TextInput
        style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
        placeholder="כתובת URL"
        placeholderTextColor={theme.textSub}
        value={u}
        onChangeText={setU}
        autoCapitalize="none"
        keyboardType="url"
      />
      <TextInput
        style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
        placeholder="תיאור (אופציונלי)"
        placeholderTextColor={theme.textSub}
        value={d}
        onChangeText={setD}
        textAlign="right"
      />
    </>
  );

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {links.length === 0 && (
          <View style={s.empty}>
            <MaterialCommunityIcons name="link-variant-off" size={52} color={theme.textSub + '55'} />
            <Text style={[s.emptyText, { color: theme.textSub }]}>אין קישורים עדיין</Text>
            <Text style={[s.emptyHint, { color: theme.textSub + '88' }]}>לחץ/י + להוספת קישור</Text>
          </View>
        )}
        {links.map(link => (
          <View
            key={link.id}
            style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <TouchableOpacity
              style={s.cardMain}
              onPress={() => openLink(link.url)}
              activeOpacity={0.75}
            >
              <View style={[s.favicon, { backgroundColor: theme.accent + '20' }]}>
                <MaterialCommunityIcons name="link-variant" size={22} color={theme.accent} />
              </View>
              <View style={s.cardContent}>
                <Text style={[s.cardTitle, { color: theme.text }]}>{link.title}</Text>
                <Text style={[s.cardDomain, { color: theme.accent }]} numberOfLines={1}>
                  {getDomain(link.url)}
                </Text>
                {link.description ? (
                  <Text style={[s.cardDesc, { color: theme.textSub }]} numberOfLines={2}>
                    {link.description}
                  </Text>
                ) : null}
              </View>
              <MaterialCommunityIcons name="open-in-new" size={16} color={theme.textSub} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openMenu(link)} style={s.menuBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="dots-vertical" size={20} color={theme.textSub} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={[s.fab, { backgroundColor: theme.accent }]} onPress={() => setAddModal(true)} activeOpacity={0.85}>
        <MaterialCommunityIcons name="plus" size={28} color={theme.mode === 'dark' ? '#000' : '#fff'} />
      </TouchableOpacity>

      {/* Add modal */}
      <Modal visible={addModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.panelTitle, { color: theme.text }]}>קישור חדש</Text>
            {inputFields(title, setTitle, url, setUrl, desc, setDesc)}
            <View style={s.panelBtns}>
              <TouchableOpacity onPress={closeAdd} style={s.cancelBtn}>
                <Text style={{ color: theme.textSub, fontWeight: '600' }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={addLink} style={[s.confirmBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: theme.mode === 'dark' ? '#000' : '#fff', fontWeight: '700' }}>הוסף</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Action sheet */}
      <Modal visible={menuModal} transparent animationType="fade">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setMenuModal(false)}>
          <View style={[s.actionSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.actionSheetTitle, { color: theme.textSub }]} numberOfLines={1}>
              {menuTarget?.title}
            </Text>
            <TouchableOpacity style={[s.actionBtn, { borderBottomColor: theme.border }]} onPress={openEdit}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.accent} />
              <Text style={[s.actionBtnText, { color: theme.text }]}>ערוך</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={openDeleteConfirm}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FF4444" />
              <Text style={[s.actionBtnText, { color: '#FF4444' }]}>מחק</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit modal */}
      <Modal visible={editModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.panelTitle, { color: theme.text }]}>עריכת קישור</Text>
            {inputFields(editTitle, setEditTitle, editUrl, setEditUrl, editDesc, setEditDesc)}
            <View style={s.panelBtns}>
              <TouchableOpacity onPress={() => setEditModal(false)} style={s.cancelBtn}>
                <Text style={{ color: theme.textSub, fontWeight: '600' }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEdit} style={[s.confirmBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: theme.mode === 'dark' ? '#000' : '#fff', fontWeight: '700' }}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete confirm */}
      <Modal visible={deleteModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.confirmPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="trash-can-outline" size={36} color="#FF4444" />
            <Text style={[s.confirmTitle, { color: theme.text }]}>מחיקת קישור</Text>
            <Text style={[s.confirmMsg, { color: theme.textSub }]}>למחוק את "{menuTarget?.title}"?</Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={[s.confirmCancel, { borderColor: theme.border }]} onPress={() => setDeleteModal(false)}>
                <Text style={{ color: theme.textSub, fontWeight: '600', fontSize: 15 }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmDelete} onPress={confirmDelete}>
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

  card: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden',
  },
  cardMain:    { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, padding: 14 },
  menuBtn:     { padding: 14 },
  favicon:     { width: 42, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardContent: { flex: 1 },
  cardTitle:   { fontSize: 14, fontWeight: '700', textAlign: 'right', marginBottom: 2 },
  cardDomain:  { fontSize: 11, fontWeight: '600', textAlign: 'right' },
  cardDesc:    { fontSize: 12, textAlign: 'right', marginTop: 3 },

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
    borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, paddingBottom: 24,
  },
  actionSheetTitle: {
    fontSize: 12, fontWeight: '600', textAlign: 'center', paddingVertical: 14, letterSpacing: 0.5,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1,
  },
  actionBtnText: { fontSize: 16, fontWeight: '600' },

  confirmPanel: {
    width: '100%', borderRadius: 20, borderWidth: 1, padding: 28, alignItems: 'center', gap: 10,
  },
  confirmTitle: { fontSize: 19, fontWeight: '800' },
  confirmMsg:   { fontSize: 14, textAlign: 'center' },
  confirmBtns:  { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  confirmCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  confirmDelete: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#FF4444' },
});

export default LinksScreen;
