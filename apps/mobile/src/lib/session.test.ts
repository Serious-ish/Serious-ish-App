import * as SecureStore from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';

import { encryptedStorage } from './encryptedStorage';
import { clearPhotoCache } from './photo-cache';
import { queryClient } from './queryClient';
import { signOut } from './session';
import { supabase } from './supabase';

jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn(), init: jest.fn() }));
jest.mock('./photo-cache', () => ({ clearPhotoCache: jest.fn(async () => {}) }));
jest.mock('./supabase', () => ({
  supabase: { auth: { signOut: jest.fn(async () => ({ error: null })) } },
}));
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n)),
}));
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    WHEN_UNLOCKED: 'when-unlocked',
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock('expo-sqlite/kv-store', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => void store.set(k, v)),
      removeItem: jest.fn(async (k: string) => void store.delete(k)),
    },
  };
});

const session = JSON.stringify({ access_token: 'secret-access-token', user: { id: 'member-1' } });

describe('the stored session (Frontend Specification 8.3)', () => {
  it('reads back what it stored', async () => {
    await encryptedStorage.setItem('sb-auth-token', session);
    await expect(encryptedStorage.getItem('sb-auth-token')).resolves.toBe(session);
  });

  it('keeps only the key in the secure store, and only ciphertext in local storage', async () => {
    await encryptedStorage.setItem('sb-auth-token', session);
    const [, stored] = jest.mocked(Storage.setItem).mock.lastCall!;
    expect(stored).not.toContain('secret-access-token');
    expect(stored).toMatch(/^[0-9a-f]+$/);
    const [, key, options] = jest.mocked(SecureStore.setItemAsync).mock.lastCall!;
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(options).toEqual({ keychainAccessible: 'when-unlocked' });
  });

  it('uses a new key for every write', async () => {
    await encryptedStorage.setItem('sb-auth-token', session);
    const first = jest.mocked(SecureStore.setItemAsync).mock.lastCall![1];
    await encryptedStorage.setItem('sb-auth-token', session);
    expect(jest.mocked(SecureStore.setItemAsync).mock.lastCall![1]).not.toBe(first);
  });

  it('removing it deletes both the key and the ciphertext', async () => {
    await encryptedStorage.setItem('sb-auth-token', session);
    await encryptedStorage.removeItem('sb-auth-token');
    await expect(encryptedStorage.getItem('sb-auth-token')).resolves.toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('session-key.sb-auth-token');
    expect(Storage.removeItem).toHaveBeenCalledWith('session.sb-auth-token');
  });
});

describe('signOut (FT-008)', () => {
  it('ends the session, clears cached cards and photos, and keeps the appearance choice', async () => {
    const clear = jest.spyOn(queryClient, 'clear');
    await signOut();
    expect(supabase!.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(clear).toHaveBeenCalled();
    expect(clearPhotoCache).toHaveBeenCalled();
    expect(Storage.removeItem).not.toHaveBeenCalledWith('appearance');
  });

  it('still clears the phone when the server cannot be reached', async () => {
    jest.mocked(supabase!.auth.signOut).mockRejectedValueOnce(new Error('offline'));
    await signOut();
    expect(supabase!.auth.signOut).toHaveBeenLastCalledWith({ scope: 'local' });
    expect(clearPhotoCache).toHaveBeenCalled();
  });
});
