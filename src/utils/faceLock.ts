import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Local-only privacy gate: WebAuthn's platform authenticator (Face ID / Touch ID /
// Windows Hello) is used purely to prove "the person holding this device can pass
// its biometric check" before revealing an already-logged-in session. This is NOT
// a replacement for the Firebase email/password login and never talks to a server —
// success is "the browser resolved the ceremony", nothing is verified remotely.
// Web/PWA only: there is no native build of this app yet, and RN's TS lib doesn't
// carry DOM types, so every Web API access below goes through an `any` cast, same
// convention already used for Notification/document elsewhere in this codebase.

const credKey    = (uid: string) => `faceLockCredId:${uid}`;
const enabledKey = (uid: string) => `faceLockEnabled:${uid}`;

const toBase64 = (buf: ArrayBuffer): string => {
  let binary = '';
  new Uint8Array(buf).forEach(b => { binary += String.fromCharCode(b); });
  return (globalThis as any).btoa(binary);
};
const fromBase64 = (b64: string): ArrayBuffer => {
  const binary = (globalThis as any).atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};
const randomChallenge = (): Uint8Array => {
  const arr = new Uint8Array(32);
  (globalThis as any).crypto.getRandomValues(arr);
  return arr;
};

export const isFaceLockSupported = async (): Promise<boolean> => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const PKC = (globalThis as any).PublicKeyCredential;
  if (!PKC || typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
  try { return await PKC.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; }
};

export const isFaceLockEnabled = async (uid: string): Promise<boolean> => {
  if (Platform.OS !== 'web') return false;
  try {
    const [enabled, id] = await Promise.all([
      AsyncStorage.getItem(enabledKey(uid)),
      AsyncStorage.getItem(credKey(uid)),
    ]);
    return enabled === '1' && !!id;
  } catch { return false; }
};

// Runs the WebAuthn registration ceremony (triggers the OS Face ID/Touch ID
// prompt) and remembers the resulting credential id for this device+account.
export const registerFaceLock = async (uid: string, label: string): Promise<boolean> => {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !(navigator as any).credentials) return false;
  try {
    const cred: any = await (navigator as any).credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: 'StudyHub' },
        user: {
          id: new TextEncoder().encode(uid),
          name: label,
          displayName: label,
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
      },
    });
    if (!cred) return false;
    await AsyncStorage.setItem(credKey(uid), toBase64(cred.rawId));
    await AsyncStorage.setItem(enabledKey(uid), '1');
    return true;
  } catch {
    return false;
  }
};

// Runs the WebAuthn assertion ceremony (triggers the biometric prompt again) to
// unlock. Resolves true only if the device's own platform authenticator succeeded.
export const verifyFaceLock = async (uid: string): Promise<boolean> => {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !(navigator as any).credentials) return false;
  try {
    const id = await AsyncStorage.getItem(credKey(uid));
    if (!id) return false;
    const assertion = await (navigator as any).credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        allowCredentials: [{ id: fromBase64(id), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
};

export const disableFaceLock = async (uid: string): Promise<void> => {
  try { await AsyncStorage.multiRemove([credKey(uid), enabledKey(uid)]); } catch { /* best-effort */ }
};
