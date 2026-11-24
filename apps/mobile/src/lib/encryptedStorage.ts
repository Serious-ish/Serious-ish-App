import aesjs from 'aes-js';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';

// The signed-in session (Frontend Specification 8.3). It is larger than the phone's secure store
// allows, so the session is encrypted with AES-256 and kept in local storage, and only the key is
// kept in the secure store. A fresh key is made for every write. This is the pattern in Supabase's
// Expo guide, with expo-crypto for the random key and the app's own local storage.
const secureKey = (key: string) => `session-key.${key}`;
const localKey = (key: string) => `session.${key}`;

const cipher = (key: Uint8Array) => new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));

export const encryptedStorage = {
  async getItem(key: string): Promise<string | null> {
    const [hexKey, hexValue] = await Promise.all([
      SecureStore.getItemAsync(secureKey(key)),
      Storage.getItem(localKey(key)),
    ]);
    if (!hexKey || !hexValue) return null;
    const bytes = cipher(aesjs.utils.hex.toBytes(hexKey)).decrypt(
      aesjs.utils.hex.toBytes(hexValue),
    );
    return aesjs.utils.utf8.fromBytes(bytes);
  },

  async setItem(key: string, value: string): Promise<void> {
    const keyBytes = getRandomBytes(32);
    const encrypted = cipher(keyBytes).encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(secureKey(key), aesjs.utils.hex.fromBytes(keyBytes), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
    await Storage.setItem(localKey(key), aesjs.utils.hex.fromBytes(encrypted));
  },

  async removeItem(key: string): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(secureKey(key)),
      Storage.removeItem(localKey(key)),
    ]);
  },
};
