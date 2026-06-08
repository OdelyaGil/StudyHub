import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { loadField, saveField } from '../utils/firestore';
import { useTheme } from '../context/ThemeContext';
import { useCustomAlert } from '../hooks/useCustomAlert';

interface DriveItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  mimeType?: string;
  size?: number;
  downloadURL?: string;
  folderId: string | null;
  createdAt: number;
}

const collectIds = (id: string, allItems: DriveItem[]): Set<string> => {
  const result = new Set<string>([id]);
  allItems
    .filter(i => i.folderId === id)
    .forEach(child => collectIds(child.id, allItems).forEach(cid => result.add(cid)));
  return result;
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (mimeType?: string): React.ComponentProps<typeof MaterialCommunityIcons>['name'] => {
  if (!mimeType) return 'file-outline';
  if (mimeType.startsWith('image/')) return 'file-image-outline';
  if (mimeType.startsWith('video/')) return 'file-video-outline';
  if (mimeType.startsWith('audio/')) return 'file-music-outline';
  if (mimeType.includes('pdf')) return 'file-pdf-box';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'file-word-outline';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'file-excel-outline';
  if (mimeType.includes('presentation')) return 'file-powerpoint-outline';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return 'zip-box-outline';
  if (mimeType.startsWith('text/')) return 'file-document-outline';
  return 'file-outline';
};

const DriveScreen = () => {
  const theme = useTheme();
  const { showAlert, showDestructiveConfirm, alertNode } = useCustomAlert(theme.accent);
  const [items, setItems]               = useState<DriveItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath]     = useState<DriveItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [uploading, setUploading]       = useState(false);
  const [fabOpen, setFabOpen]           = useState(false);
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName]   = useState('');
  const [renameModal, setRenameModal]   = useState(false);
  const [renameTarget, setRenameTarget] = useState<DriveItem | null>(null);
  const [renameName, setRenameName]     = useState('');
  const [actionItem, setActionItem]     = useState<DriveItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await loadField('drive');
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const persist = async (next: DriveItem[]) => {
    setItems(next);
    await saveField('drive', next);
  };

  const visibleItems = items
    .filter(i => i.folderId === currentFolderId)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, 'he');
    });

  const navigateInto = (folder: DriveItem) => {
    setCurrentFolderId(folder.id);
    setFolderPath(prev => [...prev, folder]);
  };

  const navigateTo = (index: number) => {
    if (index < 0) {
      setCurrentFolderId(null);
      setFolderPath([]);
    } else {
      setCurrentFolderId(folderPath[index].id);
      setFolderPath(prev => prev.slice(0, index + 1));
    }
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const folder: DriveItem = {
      id: Date.now().toString(),
      name,
      type: 'folder',
      folderId: currentFolderId,
      createdAt: Date.now(),
    };
    await persist([...items, folder]);
    setNewFolderName('');
    setNewFolderModal(false);
  };

  const uploadFile = async () => {
    setFabOpen(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const uid = auth.currentUser?.uid;
      if (!uid) { showAlert('שגיאה', 'יש להתחבר מחדש'); return; }
      setUploading(true);
      const fileId = Date.now().toString();
      // Convert to base64 data URI and store in Firestore (avoids Storage CORS)
      const response = await fetch(asset.uri);
      const blob     = await response.blob();
      const base64   = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      await setDoc(doc(db, 'users', uid, 'driveFiles', fileId), { value: base64 });
      const file: DriveItem = {
        id: fileId,
        name: asset.name,
        type: 'file',
        mimeType: asset.mimeType ?? undefined,
        size: asset.size ?? undefined,
        folderId: currentFolderId,
        createdAt: Date.now(),
      };
      await persist([...items, file]);
    } catch {
      showAlert('שגיאה', 'לא ניתן להעלות את הקובץ');
    } finally {
      setUploading(false);
    }
  };

  const deleteItem = (item: DriveItem) => {
    const msg = `למחוק את "${item.name}"?${item.type === 'folder' ? '\nכל התוכן בתיקייה יימחק.' : ''}`;
    showDestructiveConfirm('מחיקה', msg, 'מחק', async () => {
      const uid  = auth.currentUser?.uid;
      if (!uid) return;
      const ids  = collectIds(item.id, items);
      const next = items.filter(i => !ids.has(i.id));
      // Delete Firestore content docs first, then update metadata
      for (const id of ids) {
        const f = items.find(i => i.id === id && i.type === 'file');
        if (f) {
          try { await deleteDoc(doc(db, 'users', uid, 'driveFiles', id)); } catch {}
        }
      }
      await persist(next);
    });
  };

  const startRename = (item: DriveItem) => {
    setRenameTarget(item);
    setRenameName(item.name);
    setRenameModal(true);
  };

  const confirmRename = async () => {
    if (!renameTarget) return;
    const name = renameName.trim();
    if (!name) return;
    await persist(items.map(i => i.id === renameTarget.id ? { ...i, name } : i));
    setRenameModal(false);
    setRenameTarget(null);
  };

  const openFile = async (item: DriveItem) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const snap   = await getDoc(doc(db, 'users', uid, 'driveFiles', item.id));
      const base64 = snap.data()?.value as string | undefined;
      if (!base64) { showAlert('שגיאה', 'לא ניתן לפתוח את הקובץ'); return; }
      if (Platform.OS === 'web') {
        const [meta, b64] = base64.split(',');
        const mime  = meta.replace('data:', '').replace(';base64', '');
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const blob  = new Blob([bytes], { type: mime });
        const url   = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    } catch {
      showAlert('שגיאה', 'לא ניתן לפתוח את הקובץ');
    }
  };

  const onItemLongPress = (item: DriveItem) => setActionItem(item);

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>

      {/* Breadcrumb */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[s.breadcrumb, { borderBottomColor: theme.border }]}
        contentContainerStyle={s.breadcrumbContent}
      >
        <TouchableOpacity onPress={() => navigateTo(-1)}>
          <Text style={[s.crumbItem, { color: folderPath.length ? theme.accent : theme.text }]}>
            קבצים
          </Text>
        </TouchableOpacity>
        {folderPath.map((f, i) => (
          <React.Fragment key={f.id}>
            <MaterialCommunityIcons name="chevron-left" size={14} color={theme.textSub} />
            <TouchableOpacity onPress={() => navigateTo(i)}>
              <Text style={[s.crumbItem, {
                color: i === folderPath.length - 1 ? theme.text : theme.accent,
              }]}>
                {f.name}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </ScrollView>

      {/* File grid */}
      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 48 }} />
      ) : (
        <ScrollView contentContainerStyle={s.grid}>
          {visibleItems.length === 0 && (
            <View style={s.emptyState}>
              <MaterialCommunityIcons name="folder-open-outline" size={60} color={theme.textSub + '55'} />
              <Text style={[s.emptyTitle, { color: theme.textSub }]}>ריק</Text>
              <Text style={[s.emptyHint, { color: theme.textSub + '88' }]}>לחץ/י + להוספת קבצים ותיקיות</Text>
            </View>
          )}
          {visibleItems.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              activeOpacity={0.75}
              onPress={() => item.type === 'folder' ? navigateInto(item) : openFile(item)}
              onLongPress={() => onItemLongPress(item)}
            >
              <View style={[s.cardIcon, {
                backgroundColor: item.type === 'folder'
                  ? theme.accent + '22'
                  : theme.textSub + '18',
              }]}>
                <MaterialCommunityIcons
                  name={item.type === 'folder' ? 'folder' : getFileIcon(item.mimeType)}
                  size={34}
                  color={item.type === 'folder' ? theme.accent : theme.textSub}
                />
              </View>
              <Text style={[s.cardName, { color: theme.text }]} numberOfLines={2}>
                {item.name}
              </Text>
              {item.type === 'file' && item.size != null && (
                <Text style={[s.cardSize, { color: theme.textSub }]}>
                  {formatSize(item.size)}
                </Text>
              )}
              {item.type === 'folder' && (
                <Text style={[s.cardSize, { color: theme.textSub }]}>
                  {items.filter(i => i.folderId === item.id).length} פריטים
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Upload progress bar */}
      {uploading && (
        <View style={[s.uploadBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ActivityIndicator color={theme.accent} size="small" />
          <Text style={[s.uploadText, { color: theme.text }]}>מעלה קובץ...</Text>
        </View>
      )}

      {/* FAB backdrop */}
      {fabOpen && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setFabOpen(false)}
        />
      )}

      {/* FAB menu */}
      {fabOpen && (
        <View style={s.fabMenu}>
          <TouchableOpacity
            style={[s.fabMenuItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => { setFabOpen(false); setNewFolderModal(true); }}
          >
            <MaterialCommunityIcons name="folder-plus-outline" size={20} color={theme.accent} />
            <Text style={[s.fabMenuLabel, { color: theme.text }]}>תיקייה חדשה</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.fabMenuItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={uploadFile}
          >
            <MaterialCommunityIcons name="upload-outline" size={20} color={theme.accent} />
            <Text style={[s.fabMenuLabel, { color: theme.text }]}>העלה קובץ</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FAB button */}
      <TouchableOpacity
        style={[s.fab, { backgroundColor: theme.accent }]}
        onPress={() => setFabOpen(v => !v)}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons
          name={fabOpen ? 'close' : 'plus'}
          size={28}
          color={theme.mode === 'dark' ? '#000' : '#fff'}
        />
      </TouchableOpacity>

      {/* New folder modal */}
      <Modal visible={newFolderModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.panelTitle, { color: theme.text }]}>תיקייה חדשה</Text>
            <TextInput
              style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="שם התיקייה"
              placeholderTextColor={theme.textSub}
              value={newFolderName}
              onChangeText={setNewFolderName}
              textAlign="right"
              autoFocus
              onSubmitEditing={createFolder}
            />
            <View style={s.panelBtns}>
              <TouchableOpacity onPress={() => { setNewFolderModal(false); setNewFolderName(''); }} style={s.cancelBtn}>
                <Text style={{ color: theme.textSub, fontWeight: '600' }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={createFolder} style={[s.confirmBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: theme.mode === 'dark' ? '#000' : '#fff', fontWeight: '700' }}>צור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Item action sheet (long-press menu) */}
      <Modal visible={!!actionItem} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.panelTitle, { color: theme.text }]} numberOfLines={1}>{actionItem?.name}</Text>
            <TouchableOpacity
              style={[s.confirmBtn, { backgroundColor: theme.accent, marginBottom: 8 }]}
              onPress={() => { const t = actionItem; setActionItem(null); if (t) startRename(t); }}
            >
              <Text style={{ color: theme.mode === 'dark' ? '#000' : '#fff', fontWeight: '700', textAlign: 'center' }}>שנה שם</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.confirmBtn, { backgroundColor: '#EF4444', marginBottom: 8 }]}
              onPress={() => { const t = actionItem; setActionItem(null); if (t) deleteItem(t); }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>מחק</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setActionItem(null)}>
              <Text style={{ color: theme.textSub, fontWeight: '600', textAlign: 'center' }}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rename modal */}
      <Modal visible={renameModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={[s.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.panelTitle, { color: theme.text }]}>שנה שם</Text>
            <TextInput
              style={[s.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="שם חדש"
              placeholderTextColor={theme.textSub}
              value={renameName}
              onChangeText={setRenameName}
              textAlign="right"
              autoFocus
              onSubmitEditing={confirmRename}
            />
            <View style={s.panelBtns}>
              <TouchableOpacity onPress={() => setRenameModal(false)} style={s.cancelBtn}>
                <Text style={{ color: theme.textSub, fontWeight: '600' }}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmRename} style={[s.confirmBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: theme.mode === 'dark' ? '#000' : '#fff', fontWeight: '700' }}>שמור</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {alertNode}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },

  breadcrumb:        { borderBottomWidth: 1, maxHeight: 46 },
  breadcrumbContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  crumbItem:         { fontSize: 13, fontWeight: '600' },

  grid:      { padding: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 100 },
  card:      { width: '47%', borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', gap: 8 },
  cardIcon:  { width: 60, height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  cardName:  { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  cardSize:  { fontSize: 11, textAlign: 'center' },

  emptyState: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 10, width: '100%' },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyHint:  { fontSize: 12 },

  uploadBar:  {
    position: 'absolute', bottom: 90, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1,
  },
  uploadText: { fontSize: 13, fontWeight: '600' },

  fabMenu:     { position: 'absolute', bottom: 90, right: 16, gap: 8, zIndex: 10 },
  fabMenuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
  },
  fabMenuLabel: { fontSize: 14, fontWeight: '600' },
  fab: {
    position: 'absolute', bottom: 20, right: 16,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4,
    zIndex: 11,
  },

  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  panel:      { width: '100%', borderRadius: 18, borderWidth: 1, padding: 24, gap: 16 },
  panelTitle: { fontSize: 18, fontWeight: '700', textAlign: 'right' },
  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15,
  },
  panelBtns:  { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  cancelBtn:  { paddingHorizontal: 16, paddingVertical: 10 },
  confirmBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
});

export default DriveScreen;
