import { initializeApp } from 'firebase/app';
import { Platform } from 'react-native';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBiID_R3pGklffRvDELn_xeHJs8feWfNXI',
  authDomain: 'studyhub-3a9f6.firebaseapp.com',
  projectId: 'studyhub-3a9f6',
  storageBucket: 'studyhub-3a9f6.firebasestorage.app',
  messagingSenderId: '491988797167',
  appId: '1:491988797167:web:14ea8a8a239ba6705fbd1a',
};

const app = initializeApp(firebaseConfig);

export const auth = Platform.OS === 'web'
  ? getAuth(app)
  : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

export const db      = getFirestore(app);
export const storage = getStorage(app);
