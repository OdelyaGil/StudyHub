import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export const loadField = async (field: string) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data()[field] ?? null) : null;
};

export const saveField = async (field: string, value: any) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await setDoc(doc(db, 'users', uid), { [field]: value }, { merge: true });
};
