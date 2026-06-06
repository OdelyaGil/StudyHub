import { doc, getDoc, setDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// These fields grow large over time and are routed to separate subcollection
// documents (/users/{uid}/store/{field}) so each gets its own 1 MB budget
// instead of all competing inside a single user document.
const ARRAY_FIELDS = new Set([
  'tasks', 'grades', 'schedule', 'summaries', 'glossary',
  'quizBank', 'links', 'flashcards', 'chats', 'learnings',
  'photoURL', // profile photo (large base64 blob — kept in its own subcollection doc)
]);

const userRef  = (uid: string) => doc(db, 'users', uid);
const storeRef = (uid: string, field: string) => doc(db, 'users', uid, 'store', field);

// ── In-memory TTL cache ───────────────────────────────────────────────────────
// Avoids redundant Firestore reads when multiple screens navigate quickly and
// all call loadField for the same data (e.g. tasks on Home + Tasks screens).
const CACHE_TTL = 30_000; // 30 seconds
const _cache    = new Map<string, { value: any; at: number }>();

const ck       = (uid: string, f: string) => `${uid}:${f}`;
const cacheGet = (uid: string, f: string) => {
  const e = _cache.get(ck(uid, f));
  if (!e) return undefined;
  if (Date.now() - e.at > CACHE_TTL) { _cache.delete(ck(uid, f)); return undefined; }
  return e.value;
};
const cacheSet = (uid: string, f: string, v: any) =>
  _cache.set(ck(uid, f), { value: v, at: Date.now() });
const cacheDel = (uid: string, f: string) => _cache.delete(ck(uid, f));

// ── Public API ────────────────────────────────────────────────────────────────

export const loadField = async (field: string) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;

  const cached = cacheGet(uid, field);
  if (cached !== undefined) return cached;

  if (ARRAY_FIELDS.has(field)) {
    const snap = await getDoc(storeRef(uid, field));
    if (snap.exists()) {
      cacheSet(uid, field, snap.data().value ?? null);
      return snap.data().value ?? null;
    }

    // Lazy migration: first access moves the data from the old single document
    // to the new subcollection document transparently.
    const oldSnap = await getDoc(userRef(uid));
    if (oldSnap.exists() && oldSnap.data()[field] != null) {
      const data = oldSnap.data()[field];
      await setDoc(storeRef(uid, field), { value: data });
      cacheSet(uid, field, data);
      return data;
    }
    cacheSet(uid, field, null);
    return null;
  }

  const snap = await getDoc(userRef(uid));
  const value = snap.exists() ? (snap.data()[field] ?? null) : null;
  cacheSet(uid, field, value);
  return value;
};

export const saveField = async (field: string, value: any) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  cacheSet(uid, field, value); // optimistic cache update

  if (ARRAY_FIELDS.has(field)) {
    await setDoc(storeRef(uid, field), { value });
    return;
  }

  await setDoc(userRef(uid), { [field]: value }, { merge: true });
};

// Atomically append one item to an array field using a transaction so that
// two concurrent callers (e.g. rapid double-tap) cannot overwrite each other.
export const clearCache = () => _cache.clear();

// Deletes every store subcollection document for a user and clears the cache.
// Call this before deleting the root user document on account deletion.
export const deleteAllUserStoreData = async (uid: string) => {
  await Promise.all([...ARRAY_FIELDS].map(f => deleteDoc(storeRef(uid, f))));
  for (const f of ARRAY_FIELDS) _cache.delete(ck(uid, f));
};

export const appendToArrayField = async (field: string, item: any) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  cacheDel(uid, field); // invalidate so next read fetches fresh data

  if (ARRAY_FIELDS.has(field)) {
    const ref = storeRef(uid, field);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const arr  = snap.exists() ? (snap.data().value ?? []) : [];
      tx.set(ref, { value: [...arr, item] });
    });
    return;
  }

  await runTransaction(db, async (tx) => {
    const ref  = userRef(uid);
    const snap = await tx.get(ref);
    const arr  = snap.exists() ? (snap.data()[field] ?? []) : [];
    tx.set(ref, { [field]: [...arr, item] }, { merge: true });
  });
};
