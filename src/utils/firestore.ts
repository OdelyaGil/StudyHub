import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// These fields grow large over time and are routed to separate subcollection
// documents (/users/{uid}/store/{field}) so each gets its own 1 MB budget
// instead of all competing inside a single user document.
const ARRAY_FIELDS = new Set([
  'tasks', 'grades', 'schedule', 'summaries', 'glossary',
  'quizBank', 'links', 'flashcards', 'chats', 'learnings',
]);

const userRef  = (uid: string) => doc(db, 'users', uid);
const storeRef = (uid: string, field: string) => doc(db, 'users', uid, 'store', field);

export const loadField = async (field: string) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;

  if (ARRAY_FIELDS.has(field)) {
    const snap = await getDoc(storeRef(uid, field));
    if (snap.exists()) return snap.data().value ?? null;

    // Lazy migration: first access moves the data from the old single document
    // to the new subcollection document transparently.
    const oldSnap = await getDoc(userRef(uid));
    if (oldSnap.exists() && oldSnap.data()[field] != null) {
      const data = oldSnap.data()[field];
      await setDoc(storeRef(uid, field), { value: data });
      return data;
    }
    return null;
  }

  const snap = await getDoc(userRef(uid));
  return snap.exists() ? (snap.data()[field] ?? null) : null;
};

export const saveField = async (field: string, value: any) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  if (ARRAY_FIELDS.has(field)) {
    await setDoc(storeRef(uid, field), { value });
    return;
  }

  await setDoc(userRef(uid), { [field]: value }, { merge: true });
};

// Atomically append one item to an array field using a transaction so that
// two concurrent callers (e.g. rapid double-tap) cannot overwrite each other.
export const appendToArrayField = async (field: string, item: any) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

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
